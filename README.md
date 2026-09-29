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

There is also an optional **vocabulary & grammar section** in `study/`:
picture cards, verb forms and grammar sheets, with its own editor. It is
self-contained, and removing it means deleting that folder and one marked line
in `index.html`. See [`study/README.md`](study/README.md).

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

## Installing it as an app

Once the drill is served over HTTPS (GitHub Pages is enough), it can be
installed like an app on phones and computers: its own icon, its own window
with no browser bars, and it keeps working with no connection. Nothing goes
through an app store.

| Device | How |
|---|---|
| iPhone / iPad | open the site in **Safari** → Share → *Add to Home Screen* |
| Android | open it in **Chrome** → ⋮ menu → *Install app* (or *Add to Home screen*) |
| Windows / Mac | open it in **Chrome** or **Edge** → the install icon at the right of the address bar, or ⋮ → *Install Hear the Difference* |
| Mac, Safari | File → *Add to Dock* |

Only the drill is the app. The editor is not part of it: the installed app never
links to it, never saves a copy of it, and never works offline for it.

How it works:

- `manifest.webmanifest` names the app and points at its icons.
- `sw.js`, a service worker registered by `assets/js/app.js`, saves the drill
  and every recording the deck names on first visit, then answers from that
  copy whenever the network cannot. Pages, scripts and the deck are fetched
  fresh whenever there is a connection, so **publishing and pushing a new deck
  is all it takes to update everyone's app**: it shows on their next launch
  with a connection. Recordings are served from the saved copy first and
  refreshed in the background.
- New recordings named by a newer deck are saved as soon as that deck arrives,
  so they play offline without having been played online first.
- `VERSION` at the top of `sw.js` exists to throw every saved copy away. Routine
  deck and code changes do not need it bumped.

Opening `index.html` straight off disk is unchanged: service workers need
http(s), so off disk the app layer switches itself off.

Progress lives in the browser the app runs in, as before. On a phone or
computer that is the app's own storage; *Export progress* moves it between
devices. On your own machine, an installed drill shares storage with the
browser it was installed from — so an editor draft in that browser shadows the
published deck there too (see below).

The icons in `assets/icons/` are the swirl from the CG Langues logo, without
the lettering. `cg-swirl.png` is the master: the swirl alone on a transparent
background at 1024px, cut from the full logo. Every other icon is drawn from it:

| File | Size | For |
|---|---|---|
| `cg-favicon-64.png` | 64 | the browser tab, on both pages |
| `cg-icon-192.png`, `cg-icon-512.png` | 192, 512 | desktop and general app icon, transparent |
| `cg-icon-maskable-512.png` | 512 | Android, which crops icons to its own shape: the swirl sits small in the middle of a white square so no crop clips it |
| `cg-apple-touch-icon.png` | 180 | iPhone and iPad home screen, on white (iOS fills transparency with black) |

When changing the icon, give the new files new names rather than overwriting
these. Browsers that already installed the app only notice an icon change when
the manifest points at a different file.

### A note on hosting the editor

The drill does not link to the editor and does not mention it. `editor.html` is
the deck owner's page: reach it by typing the URL. Nothing on the public page
advertises that it exists, so a learner following the site's link to the drill
never sees a way in.

That is a matter of presentation, not access. Publishing anything on Pages puts
it on the public web, deck and editor alike, and `/editor.html` stays reachable
to anyone who guesses it. This is harmless, and the reason is worth
understanding rather than trusting: there is no server and no database, so a
visitor opening the editor only ever edits a draft in their own browser. They
cannot change what anyone else sees, and *Publish to project…* writes to a
folder on their own machine. The published deck only ever changes when someone
commits and pushes. If the page should not be reachable at all, it has to be
kept out of what Pages serves — hiding the link cannot do it.

The loop, once hosted, is: open `editor.html` yourself → publish into your local
clone → commit and push → Pages redeploys.

The drill prefers a draft over the published deck when one is present in the
browser it is opened in. It used to say so on the page; that notice named the
editor, so it is gone. The behaviour is unchanged, which means a draft in your
own browser still shadows the published deck silently — clear it from the
editor if the drill looks unexpectedly out of date.

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
assets/icons/         app and tab icons, and the swirl they are drawn from
assets/fonts/         Manrope and Poppins, served locally so the app works offline
assets/css/fonts.css  the @font-face rules for those files
assets/js/app.js      registers the service worker (drill only)
manifest.webmanifest  app name, colours and icons for installing
sw.js                 service worker: offline copy of the drill and recordings
assets/cg-langues-logo.png  the school's mark, shown in the drill's topbar
assets/css/app.css    shared shell: theme tokens, type, buttons, layout
assets/css/editor.css editor-only styles
assets/js/deck.js     shared data layer — load, audio lookup, draft, publish, zip
assets/js/quiz.js     the drill
assets/js/editor.js   the editor
data/deck.js          the deck: groups + cards, audio referenced by path
audio/<group>/*.mp3   the recordings
tools/extract_audio.py  one-shot migration from the old single-file build
tools/theme-scrape.js   console script: lift another site's look into the tokens above
tools/make_ai_audio.py  AI stand-in recordings for pair words nobody has recorded yet
audio/ai/               those stand-ins; audio/words/ holds real recordings made for comparing
study/                  optional vocabulary & grammar section (see study/README.md)
```

## Changing the typeface

`app.css` declares two type roles on `:root` and every rule uses those rather
than a typeface name:

```css
--display: Manrope, system-ui, sans-serif;  /* headings, the drilled words, the score */
--ui:      Poppins, system-ui, sans-serif;  /* everything functional */
```

Re-theming is therefore two lines plus the font files. The faces are served
from `assets/fonts/` rather than Google Fonts, so the installed app looks right
offline: swapping one means dropping its `.woff2` files in there, pointing
`assets/css/fonts.css` at them, and listing them in `CORE` in `sw.js` so they
are saved for offline use. Keep a real fallback stack on each token: a webfont that
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

The topbar follows the site's header rather than the drill's old one: the mark
top left at the column's edge, the drill's name beside it, and the whole band
white and full-width over a grey page. Sampling the site's own screenshot gave
`#fefefe` for the header and `#f6f6f6` for the band under it, which is the
`--paper-2` over `--paper` the scrape had already found. The bar breaks out of
the 760px column with `100vw` and pads itself back to the column's edges, so
the mark lines up with the text below it at every width; `body` already hides
horizontal overflow, so that cannot scroll the page sideways.

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

## Comparing the pair

Once the learner has answered, clicking either word plays it, and a button
under each option does the same, so the two can be heard side by side. Each
word uses, in order:

1. a recording made for comparing, in the editor's *Word recordings for
   comparing* section, stored in `data/deck.js` under `words` and published to
   `audio/words/` — or, until someone records the word, an **AI stand-in**
   under `audio/ai/` (see below), which the button labels *AI voice*;
2. the recording of the card whose answer is that word;
3. the device's built-in text-to-speech voice, as a stand-in. The button is
   labelled *computer voice* so it is never mistaken for a real recording, and
   the voice varies by device (a British one that works offline is preferred).

Of the 94 words in the pairs, 75 already play a real recording through
their cards. The other 19 have AI stand-ins, made by
`tools/make_ai_audio.py` with Kokoro-82M (Apache-2.0, British voice
`bf_emma`) run locally. Their pronunciation was checked from the phonemes the
model is given (*hair* /heə/ against *air*, *Dis* /dɪs/, *Dough* /dəʊ/
against *Though* /ðəʊ/), and their loudness matched to the existing
recordings. They are mono MP3 at 64 kbps, 4–14 KB each. Rerun the script
after adding pairs and it fills only the new gaps; its docstring has the
setup.

Recording over a stand-in in the editor replaces it. The old
`audio/ai/<word>.mp3` is then unused and can be deleted. The editor section lists the words still needing a real recording with **Record** and **Choose file…** on each, and also lets
any word be given a better take than its card's. The same controls sit on
every card in the editor, under *Words for comparing*, for that card's two
words; a recording made there is kept at once, without saving the card.

```js
"words": { "hair": "audio/words/hair.mp3" }
```

Keys are the word as written, lower-cased, with spaces tidied.

## Keyboard

`R` replay · `1`/`2` answer · then click a word, or `A`/`B`, to hear each word of the pair, and
`1`–`4` to rate (Again / Hard / Good / Easy), or `Space` for Good.
