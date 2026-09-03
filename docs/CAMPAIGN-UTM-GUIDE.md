# Campaign link tagging (UTM)

How to tag a marketing link so `/admin → Analytics → Campaigns` can tell you what
it produced.

An untagged link is not lost traffic — it still generates kundalis — but it lands
in one undifferentiated bucket called **direct**, and nothing afterwards can pull
it back apart. Tagging is a decision you make before you send, once.

---

## What you get for tagging

One row per campaign, per creative:

| Sessions | Kundali | Signed in | Pay started | Accounts | Paid | Revenue |
|---|---|---|---|---|---|---|

Read the row left to right and you have the whole funnel for that one link.

---

## The five parameters

Add them to the end of the URL, after a `?`, joined with `&`.

| Parameter | Answers | Required |
|---|---|---|
| `utm_source` | Which platform? | **yes** |
| `utm_medium` | What kind of placement? | **yes** |
| `utm_campaign` | Which push? One string, reused across every link in it | **yes** |
| `utm_content` | Which creative or variant? | for anything with more than one creative |
| `utm_term` | Which paid keyword? | paid search only — leave it off otherwise |

If you cannot say which column a value belongs in, do not add it.

`utm_content` is the one people skip and then miss. It is what separates three
Instagram creatives from each other; without it they are one row and you cannot
tell which image worked.

---

## Allowed values

Use these. Free text is what turns one campaign into three rows in the report.

**`utm_source`** — `whatsapp` · `instagram` · `facebook` · `youtube` ·
`linkedin` · `x` · `google` · `newsletter` · `sms` · `influencer` · `partner` ·
`qr`

**`utm_medium`** — `social` · `paid_social` · `cpc` · `organic_social` · `email`
· `message` · `status` · `referral` · `bio` · `story` · `print`

**`utm_campaign`** — `<yyyy-mm>-<theme>`, lowercase, hyphens between words:
`2026-09-diwali-kundali`, `2026-10-wealth-webinar`. Dating it means two campaigns
with the same theme a year apart never merge.

**`utm_content`** — the creative or placement variant: `story-1`, `reel-a`,
`bio-link`, `carousel-3`, `broadcast-2`.

Adding a new source or medium is fine — add it to this list in the same change,
so the next person picks the same word you did.

---

## What happens to your value

Every value is cleaned before it is stored. Knowing the rules saves a confusing
report later:

| You send | Stored as |
|---|---|
| `Whatsapp`, `WHATSAPP` | `whatsapp` — everything is lowercased |
| `Diwali Sale`, `Diwali+Sale` | `diwali-sale` — spaces and `+` become hyphens |
| `Diwali Sale!!` | `diwali-sale` — punctuation outside `a-z 0-9 . _ -` is dropped |
| a value over 64 characters | **nothing** — the field arrives empty |
| anything containing `@` or 7+ digits in a row | **nothing** — treated as personal data |

The last two are the ones to watch, because they fail **silently**: the row is
still recorded, that one field is just blank. A long campaign name does not get
shortened, it disappears — a clipped name would become a second campaign in the
report that looks exactly like a real one.

Lowercasing means our own reports never split `Whatsapp` and `whatsapp`. **GA4
still splits them**, because it matches case-sensitively and we cannot change
that. So type lowercase at the source and both tools agree.

---

## Worked examples

WhatsApp broadcast:

```
https://vedicfinance.ai/?utm_source=whatsapp&utm_medium=message&utm_campaign=2026-09-diwali-kundali&utm_content=broadcast-1
```

Instagram bio link:

```
https://vedicfinance.ai/?utm_source=instagram&utm_medium=bio&utm_campaign=2026-09-diwali-kundali&utm_content=bio-link
```

Instagram story, second creative:

```
https://vedicfinance.ai/?utm_source=instagram&utm_medium=story&utm_campaign=2026-09-diwali-kundali&utm_content=story-2
```

Same campaign name across all three — that is what makes them one campaign with
three creatives rather than three campaigns.

---

## Do not

- **Do not tag internal links.** A tagged link from one page of the site to
  another restarts attribution mid-session and credits the campaign twice.
- **Do not put a name, email or phone number in `utm_content`.** Mail-merge tools
  make this easy to do by accident. Such a value is dropped whole.
- **Do not invent a source.** `insta`, `ig` and `instagram` are three rows.
- **Do not tag `/admin` links or anything with `?embed=true`.** Nothing is
  recorded on those at all, by design.
- **Do not use a shortener that redirects with a meta-refresh or JavaScript.** It
  strips the parameters. A shortener must issue a real `301`/`302` to the full
  URL. Test one link before sending the batch.

---

## Checking it worked — before the send, not after

1. Open your link in a fresh browser profile.
2. The address bar should clean itself within a moment of loading — the `utm_`
   parameters disappear. That is the app banking them; it is not a failure.
3. Ask an engineer to confirm the row landed:
   `select utm_source, utm_medium, utm_campaign, utm_content from visitor_events
   where utm_campaign = '<your campaign>' order by created_at desc limit 5;`
4. Check all five values are what you typed, in lowercase, with none blank.

Do this once per campaign, with one link, before the broadcast goes out. A
missing value found afterwards cannot be recovered.

---

## Known limits, so a number is not misread

- **Paid and revenue are counted per user, from that user's *first* tagged
  visit** — not per session. Someone who clicks a WhatsApp link on Monday and
  pays on Wednesday is credited to WhatsApp, and that payment appears in
  Wednesday's window while the session appears in Monday's. `Paid` is therefore
  not a subset of `Sessions` in the same row.
- **`(pre-attribution)`** collects paying users who signed up before this existed.
  They are not `direct` — we simply never asked. The number shrinks over time.
- **In-app browsers** (WhatsApp, Instagram) sometimes hand the Google sign-in to
  Chrome or Safari instead of completing in place. When that happens the campaign
  is recorded for the visit but cannot follow the person into the account, so the
  session is attributed and the signup is not.

Technical detail lives in [ANALYTICS.md](../ANALYTICS.md) →
*Campaign attribution (UTM)*.
