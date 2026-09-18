# Hear the Difference

A listening drill for English minimal pairs: the dropped **/h/**, the voiced
**/ð/**, and long vs short **i**. You hear a recording and choose which of two
near-identical phrases was actually said. Answers feed a small spaced-repetition
scheduler so the pairs you keep missing come back sooner.

Two pages, no build step, no dependencies:

| | |
|---|---|
| `index.html` | the drill |
| `editor.html` | add and edit cards, attach or record audio, publish back to the project |

## Running it

Three ways, all of which work:

1. **Double-click `index.html`.** No server, no install.
2. **Serve the folder** — `python3 -m http.server 8000`, then
   <http://localhost:8000>.
3. **GitHub Pages.** The repo is a static site with no build step, so Pages can
   serve it as-is from the default branch. Push, enable Pages in
   *Settings → Pages* against `main` / root, and the drill is at the site root
   with the editor at `/editor.html`.

Nothing is uploaded anywhere in any of the three: the deck is fetched as static
files and your progress stays in your own browser.

### A note on hosting the editor

Publishing anything on Pages puts it on the public web, deck and editor alike.
That is harmless here but worth understanding: there is no server and no
database, so a visitor opening `editor.html` only ever edits a draft in their
own browser. They cannot change what anyone else sees, and *Publish to
project…* writes to a folder on their own machine. The published deck only ever
changes when someone commits and pushes.

The loop, once hosted, is: edit on the site → publish into your local clone →
commit and push → Pages redeploys.

### After publishing, the drill needs a reload

*Publish to project…* writes files to disk. It cannot reach into a page that is
already open, so a drill tab loaded before the publish still holds the old deck
until you reload it — hard-reload (Ctrl/Cmd+Shift+R) if a plain one is not
enough, since the browser may have cached `data/deck.js`. A hosted copy needs a
commit and push on top of that; publishing never touches a web server.

Publishing replaces the deck wholesale, so it first checks that the folder you
picked really is the project (it looks for `index.html`) and warns before a
write that would leave fewer cards than the deck already on disk. If a publish
ever does go wrong, `data/deck.js` is in git: `git checkout data/deck.js`.

Microphone recording needs a secure context. HTTPS (Pages), `http://localhost`
and `file://` all qualify; plain `http://` to a LAN address does not, and the
editor will say so and fall back to *Choose file…*.

## Layout

```
index.html            the drill
editor.html           the deck editor
assets/favicon.svg    site icon
assets/css/app.css    shared shell: theme tokens, type, buttons, layout
assets/css/editor.css editor-only styles
assets/js/deck.js     shared data layer — load, audio lookup, draft, publish, zip
assets/js/quiz.js     the drill
assets/js/editor.js   the editor
data/deck.js          the deck: groups + cards, audio referenced by path
audio/<group>/*.mp3   the recordings
tools/extract_audio.py  one-shot migration from the old single-file build
tools/theme-scrape.js   console script: lift another site's look into the tokens above
```

## Changing the typeface

`app.css` declares two type roles on `:root` and every rule uses those rather
than a typeface name:

```css
--display: Manrope, system-ui, sans-serif;  /* headings, the drilled words, the score */
--ui:      Poppins, system-ui, sans-serif;  /* everything functional */
```

Re-theming is therefore two lines plus the Google Fonts `<link>` in `index.html`
and `editor.html`. Keep a real fallback stack on each token: a webfont that
fails to load should degrade to something close, not to Times.

Both faces come from cglangues.fr, which the drill is meant to sit alongside.
The site sets body copy in Poppins and takes some headings in Manrope, and the
two roles are kept apart on purpose: the drilled words are the thing you are
being asked to look at, so they should not be in the same voice as the buttons.
Setting `--display` to Poppins as well is a one-line change if you would rather
they matched exactly. Manrope stops at 800, which is why the brand and the
score are 800 rather than 900.

## Where the colours came from

`tools/theme-scrape.js` was run against cglangues.fr and its output is the
`:root` block, with three adjustments this app needs and a marketing site does
not:

- The site's mint `#8dd9bf` is a fill, never a label. It sits at 1.5:1 on the
  page and 1.6:1 under white, so the eleven rules that set text in the accent —
  and the primary button — would have been unreadable. `--accent` keeps the
  mint and now carries the progress rail; `--accent-deep` is the same hue
  darkened until it carries text (4.6:1 on paper, 5.0:1 under white), and that
  is what every label and every solid fill uses.
- `--good-soft` and the new `--bad-soft` are the correct/wrong answer fills,
  blended until the verdict text on them clears 4.5:1. The wrong-answer fill
  used to be a hard-coded pink that belonged to the old warm palette.
- `--radius` and `--shadow` carry the site's flatness: 10px corners and a soft,
  shallow shadow in place of the hard offset blocks the old look used. The
  paper grain went with them — it existed to make a warm paper feel like paper,
  and against a flat grey it only reads as dirt.

Contrast was checked for every pair that carries meaning. If you re-scrape
against a different site, check the same ones: text on `--paper`, text on
`--paper-2`, `--paper-2` on `--accent-deep`, and the two verdict fills.

## Matching another site's look

`tools/theme-scrape.js` exists for the case where the drill is an add-on to a
site that already has a look of its own, and should not arrive wearing this
one. Open the site — the published one, not a builder preview, which sandboxes
the page in an iframe the script cannot read — paste the whole file into the
DevTools console, and it writes out two files:

| | |
|---|---|
| `site-theme.css` | a `:root` block in the vocabulary above, to replace the one at the top of `app.css` |
| `site-theme.json` | the full harvest — palette, type, radii, shadows, spacing, buttons, logo |

It reads *computed* styles off elements that are actually on the page, so it
does not care what the CSS looks like or what the classes are called; that
matters on Wix, Squarespace and the like, where class names are hashed and
change on every publish. Where a site states its own theme the script prefers
that statement to the inference: Wix ships its palette as `--color_1`…`--color_36`
and its theme fonts as `--font_0`…`--font_10`, and both are read when present.

Some tokens are observed and some are derived, because a marketing site has no
opinion about what a wrong answer looks like. Every one carries a comment in
the output saying which it was, so the two or three worth a second look
announce themselves — `--good` and `--bad` usually, since a site with no green
and no red in its palette gets a pair built at the accent's own saturation.

The JSON is the more durable half. It is not specific to this project, so it
also serves any other add-on you dress to match the same site.

Nothing is uploaded and nothing leaves the tab: the script reads the page you
already have open and hands the two files to the browser's own download.

## The data

`data/deck.js` holds the whole deck:

```js
{
  "version": 1,
  "title": "Hear the Difference",
  "groups": [
    { "id": "h", "label": "Dropped H", "ipa": "/h/", "ipaNote": "",
      "title": "The dropped H", "blurb": "…", "example": "heat · eat" }
  ],
  "cards": [
    { "id": "h|air|hair>air", "group": "h",
      "options": ["air", "hair"], "answer": "air", "audio": "audio/h/air.mp3" }
  ]
}
```

- **`id` is permanent.** Spaced-repetition progress is keyed on it, so editing a
  card's text must not change it. Migrated cards keep the exact key the old
  build wrote to `localStorage`, so nobody loses their schedule in this refactor.
- **`audio` may be `null`.** Ten cards came across with silent recordings (see
  below). A card with no audio is stored, editable, and skipped by the drill —
  you cannot ask someone to identify a sound that isn't there.
- **Groups are data, not code.** The filter buttons, the cards on the front
  page and the results breakdown are all generated from `groups`. Adding a
  fourth contrast needs no code change.

## The editor

`editor.html` edits a **draft** of the deck rather than the files directly,
because a web page cannot write to your disk unasked. The draft lives in your
browser — card text in `localStorage`, recordings in IndexedDB (they are
megabytes; `localStorage` is a ~5 MB string store that throws when full). The
drill reads the draft too, so a card you just added is immediately playable.

Recordings come from a file (`Choose file…`) or straight from the microphone
(`Record`, via `MediaRecorder`).

Publishing turns the draft back into project files:

- **Publish to project…** — Chromium-family browsers only. Pick the project
  folder once and the editor writes `data/deck.js` and the new `audio/…` files
  in place, then clears the draft so the two can't drift apart. Commit the
  result.
- **Download changes (.zip)** — everywhere else. A zip laid out like the
  project; unzip it over the folder, then *Discard draft*.

**Brave** ships the File System Access API but disables it by default, so
*Publish to project…* is refused until you enable it at
`brave://flags/#file-system-access-api` (set to Enabled, then relaunch). Firefox
and Safari have not implemented it at all; there the zip is the only route.

Validation is deliberately narrow and refuses only what would produce a broken
card: two non-empty, distinct options, an answer that is one of them, and a
group that exists.

## Why the deck is a `.js` file, not `.json`

`data/deck.js` is plain JSON wrapped in one `window.HTD_DECK = …` assignment and
loaded with a `<script>` tag. The obvious alternative — `deck.json` plus
`fetch()` — breaks the moment anyone opens `index.html` straight off disk, since
`file://` pages get an opaque origin and CORS rejects fetching a sibling file.
The original build was a single self-contained page that worked offline by
double-click; the wrapper keeps that true while still splitting the data out.

The cost is that `jq` needs the first line stripped. That seemed a smaller price
than "it only works if you remember to start a server".

## What the migration did

`tools/extract_audio.py` produced this layout from the original 2.5 MB
single-file `hear-the-difference.html`, in which all 92 recordings were
base64 data URIs inside one 2.5 MB line. Rerun it against that file from git
history to reproduce the split.

- **92 cards → 73 MP3s.** Nine cards shared a take with another card; the
  extractor hashes the audio and points both at one file.
- **10 cards have no usable audio.** Their MP3s were 138 bytes: an ID3 tag with
  zero audio frames, i.e. silence. Rather than ship silence for the learner to
  guess at, those cards carry `"audio": null`, sit out of the drill, and show up
  in the editor as the obvious first thing to record:

  > I ate the cookies · Her hair smells good · I can hit perfectly · I can it
  > perfectly · The Hill child needs help · I study art at school · Though it
  > rained, we walked. · Dis is my book. · Dough it rained, we walked. ·
  > The beat is hard.

  The drill therefore offers 82 cards until those are recorded.

## Keyboard

`R` replay · `1`/`2` answer · then `1`–`4` to rate (Again / Hard / Good / Easy),
or `Space` for Good.
