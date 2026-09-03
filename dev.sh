#!/usr/bin/env bash
#
# VedicFinance — local dev launcher.
#
#   ./dev.sh            preflight, then start the Vite dev server on :8080
#   ./dev.sh --check    run every preflight check and exit (starts nothing)
#   ./dev.sh --fresh    reinstall dependencies (npm ci) first, then start
#   ./dev.sh --build    production build instead of dev server
#   ./dev.sh --preview  build, then serve the build
#
# Why this exists: your shell does not source nvm, so a bare `npm run dev`
# runs on whatever `node` is first on PATH (currently v25.9) instead of the
# Node 22 this project is built against. This script pins it every time.
#
set -euo pipefail

NODE_VERSION="22"
PORT="8080"

cd "$(dirname "${BASH_SOURCE[0]}")"

MODE="dev"
FRESH=0
for arg in "$@"; do
  case "$arg" in
    --check)   MODE="check" ;;
    --fresh)   FRESH=1 ;;
    --build)   MODE="build" ;;
    --preview) MODE="preview" ;;
    -h|--help) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) printf 'unknown option: %s (try --help)\n' "$arg" >&2; exit 2 ;;
  esac
done

say()  { printf '\033[1;36m▸\033[0m %s\n' "$1"; }
ok()   { printf '\033[1;32m✓\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$1"; }
die()  { printf '\033[1;31m✗\033[0m %s\n' "$1" >&2; exit 1; }

# ── 1. Pin Node — fnm first, nvm as fallback ────────────────────────────────
# Interactive shells auto-switch via fnm's --use-on-cd, but this script may run
# non-interactively (cron, CI, an IDE task) where that hook never fires. Pin it
# explicitly every time.
if command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env --shell bash)"
  if ! fnm use "$NODE_VERSION" >/dev/null 2>&1; then
    say "Node $NODE_VERSION not installed under fnm — installing (one-time download)"
    fnm install "$NODE_VERSION" >/dev/null
    fnm use "$NODE_VERSION" >/dev/null
  fi
  MANAGER="fnm"
else
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  mkdir -p "$NVM_DIR"
  # nvm.sh references unset variables; -u must be off while it loads.
  set +u
  if [ -s "/opt/homebrew/opt/nvm/nvm.sh" ]; then
    . "/opt/homebrew/opt/nvm/nvm.sh"
  elif [ -s "$NVM_DIR/nvm.sh" ]; then
    . "$NVM_DIR/nvm.sh"
  else
    set -u
    die "no Node version manager found. Install one with: brew install fnm"
  fi
  set -u
  if ! nvm use "$NODE_VERSION" >/dev/null 2>&1; then
    say "Node $NODE_VERSION not installed under nvm — installing (one-time download)"
    nvm install "$NODE_VERSION" >/dev/null
    nvm use "$NODE_VERSION" >/dev/null
  fi
  MANAGER="nvm"
fi
ok "node $(node -v)  npm v$(npm -v)  (via $MANAGER)"

# ── 2. Which branch am I on? ────────────────────────────────────────────────
if BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null); then
  ok "branch $BRANCH"
  [ "$BRANCH" = "main" ] && warn "'main' is a stale prototype — no Supabase, payments, or real astronomy. You probably want af-prod."
fi

# ── 3. Environment ──────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  warn "no .env — copying .env.example (you must fill in the values)"
  cp .env.example .env
fi

missing=""
for key in VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY; do
  value=$(grep -E "^${key}=" .env 2>/dev/null | head -1 | cut -d= -f2- || true)
  [ -z "$value" ] && missing="$missing $key"
done
if [ -n "$missing" ]; then
  warn "empty in .env:$missing"
  warn "public pages will render, but /auth /payment /kundali will bounce to /home"
else
  ok ".env has Supabase URL + anon key"
fi

# ── 4. Dependencies ─────────────────────────────────────────────────────────
if [ "$FRESH" -eq 1 ]; then
  say "reinstalling dependencies (--fresh)"
  npm ci
elif [ ! -d node_modules ]; then
  say "node_modules missing — running npm ci"
  npm ci
elif [ package-lock.json -nt node_modules/.package-lock.json ]; then
  # Fires after a branch switch: dependencies differ sharply across this repo's
  # branches (main has no fast-check / supabase-js / astronomy-engine), and a
  # stale install surfaces as a confusing "Failed to resolve import" error.
  say "lockfile is newer than node_modules — reinstalling"
  npm ci
else
  ok "dependencies up to date"
fi

# ── 5. Free the port ────────────────────────────────────────────────────────
if pids=$(lsof -ti:"$PORT" 2>/dev/null) && [ -n "$pids" ]; then
  warn "port $PORT in use by PID(s): $(echo "$pids" | tr '\n' ' ')— stopping"
  # shellcheck disable=SC2086
  kill $pids 2>/dev/null || true
  sleep 1
  if pids=$(lsof -ti:"$PORT" 2>/dev/null) && [ -n "$pids" ]; then
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
    sleep 1
  fi
  ok "port $PORT freed"
else
  ok "port $PORT free"
fi

# ── 6. Go ───────────────────────────────────────────────────────────────────
case "$MODE" in
  check)
    ok "preflight passed — nothing started (drop --check to run)"
    ;;
  build)
    say "npm run build"
    npm run build
    ;;
  preview)
    say "npm run build && npm run preview"
    npm run build
    npm run preview
    ;;
  dev)
    say "starting Vite → http://localhost:$PORT/   (Ctrl+C to stop)"
    exec npm run dev
    ;;
esac
