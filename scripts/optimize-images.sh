#!/usr/bin/env bash
#
# Convert oversized raster assets to WebP at the size they are actually rendered.
#
# The problem this solves: every raster in src/assets was shipped at its original
# generated resolution regardless of display size — 1088x1248 PNGs for 28px
# avatars, a 960x1115 logo painted at 80px. The landing page alone transferred
# ~9 MB, most of it pixels no one ever sees.
#
# Target widths below are ~2.5-3x the largest CSS size each image renders at, so
# they stay sharp on retina. Verified render sizes are noted per entry; if a
# layout changes, update the number here rather than re-uploading a 2 MB source.
#
# ── Size an asset for its LARGEST consumer, not its most obvious one ─────────
# An image imported in more than one place must be sized for the biggest render
# of the lot. The testimonial portraits below are the cautionary tale: they were
# cut to 96px for the 28px avatar row in Hero, but the same four files also feed
# the CircularTestimonials carousel at ~269x288 — a 5.6x upscale on a retina
# screen, and visibly blurry. Where the two uses are far apart, emit two variants
# (4th field) rather than compromising on one width. Before adding an entry:
#   grep -rn "<asset-basename>" src --include="*.ts" --include="*.tsx"
# and note every render size you find, so the next person can check your work.
#
# ── Keep the source files ───────────────────────────────────────────────────
# Every source listed below is committed alongside its .webp, and must stay that
# way. An earlier pass followed this script's own closing advice and deleted them
# once the imports pointed at .webp — which left the script unable to run at all
# (30 of 34 entries reported "skip (missing)"), and left no way to re-encode
# anything without going back through git history to find the originals. That is
# exactly what happened when the testimonial portraits turned out to be sized for
# the wrong consumer and had to be regenerated.
#
# The sources cost working-tree bytes but essentially nothing on clone: they are
# already in the repository's history, so re-adding them points new trees at
# blobs the pack already contains.
#
# Requires cwebp (brew install webp). Safe to re-run: it skips anything already
# converted and never touches the original until the WebP exists. Encoding is
# deterministic, so regenerating a file that already exists reproduces it
# byte-for-byte and creates no diff noise. That skip is the trap when
# *re-encoding* though — delete the outputs you want rebuilt first, or the run
# will report "skip (exists)" and change nothing.
set -euo pipefail
cd "$(dirname "$0")/.."

command -v cwebp >/dev/null || { echo "cwebp not found — brew install webp"; exit 1; }

# path|target_width|quality[|output_suffix]   (width 0 = keep original dimensions)
#
# output_suffix appends to the basename, so one source can produce several sizes:
#   foo.png|768|82           -> foo.webp
#   foo.png|96|82|-avatar    -> foo-avatar.webp
JOBS=$(cat <<'LIST'
# Testimonial portraits — TWO renders, far apart. Sources were recovered from
# git (origin/af-prod) after an earlier pass deleted them; 776px is the narrowest
# of the four, which is why the large variant caps at 768 and never upscales.
#   carousel: CircularTestimonials, ~269x288  -> 768 (~2.9x)
#   avatars:  Hero + payment/MethodStep, 28px ->  96 (~3.4x)
src/assets/testimonial-images/abhishek-shukla.png|768|82
src/assets/testimonial-images/shoba-patil.png|768|82
src/assets/testimonial-images/amitav.png|768|82
src/assets/testimonial-images/harsha-gupta.jpg|768|82
src/assets/testimonial-images/abhishek-shukla.png|96|82|-avatar
src/assets/testimonial-images/shoba-patil.png|96|82|-avatar
src/assets/testimonial-images/amitav.png|96|82|-avatar
src/assets/testimonial-images/harsha-gupta.jpg|96|82|-avatar
src/assets/vedicfinance-logo.png|240|88
src/assets/hero-book.png|500|82
src/assets/insights-images/surprise-wealth-gains.png|500|82
src/assets/insights-images/your-income-growth.png|500|82
src/assets/insights-images/dasha-risk-meter.png|500|82
src/assets/af-asset1.png|500|82
src/assets/biz-card.png|750|82
src/assets/trader-card.png|750|82
src/assets/planet-bg.png|1200|80
src/assets/astrologer.png|1200|80
src/assets/luxury-property.png|640|82
src/assets/gold-jewelry.png|640|82
src/assets/gold-necklace.png|640|82
src/assets/luxury-car.png|640|82
src/assets/investement-options/property.png|512|82
src/assets/investement-options/car.png|512|82
src/assets/investement-options/gold.png|512|82
src/assets/investement-options/loan.png|512|82
LIST
)

# The 12 zodiac PNGs are all 1024x1024 and render between 16px and 96px.
for sign in aries taurus gemini cancer leo virgo libra scorpio sagittarius capricon aquaris pisces; do
  JOBS="$JOBS
src/assets/horoscopes/${sign}.png|256|84"
done

before=0; after=0
while IFS='|' read -r src width quality suffix; do
  [ -z "$src" ] && continue
  case "$src" in \#*) continue ;; esac
  [ -f "$src" ] || { echo "skip (missing): $src"; continue; }
  out="${src%.*}${suffix:-}.webp"
  b=$(wc -c < "$src" | tr -d ' ')
  if [ -f "$out" ]; then echo "skip (exists): $out"; continue; fi
  if [ "$width" = "0" ]; then
    cwebp -quiet -q "$quality" "$src" -o "$out"
  else
    cwebp -quiet -q "$quality" -resize "$width" 0 "$src" -o "$out"
  fi
  a=$(wc -c < "$out" | tr -d ' ')
  before=$((before + b)); after=$((after + a))
  printf '%-56s %7s KB -> %6s KB\n' "$(basename "$out")" "$((b/1024))" "$((a/1024))"
done <<< "$JOBS"

echo
echo "total: $((before/1024)) KB -> $((after/1024)) KB  (saved $(( (before-after)/1024 )) KB)"
echo "Originals stay in the repo — see the note at the top of this file. Do not delete them."
