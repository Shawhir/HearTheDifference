# Vocabulary & grammar (the `study/` folder)

A second section next to the listening drill: picture cards, verb forms and
grammar sheets. It lives entirely in this folder and nothing outside it
depends on it.

| | |
|---|---|
| `study/index.html` | the menu: card decks, then grammar sheets |
| `study/cards.html?deck=<id>` | the card player, for every deck |
| `study/editor.html` | add and edit decks, cards and sheets; publish back to the project |

As with the drill's editor, nothing links to `study/editor.html`: reach it by
typing the address. The same note about hosting applies (see the main README).

## Removing it

1. Delete the `study/` folder.
2. Delete the one marked line in `index.html` (the link under *Begin
   listening*).

That's all. The offline code in `sw.js` saves the study pages only when they
exist and skips them when they don't, so it needs no change. Learners'
listening progress is stored separately and is not affected.

## The two kinds of deck

**Picture cards** (`"kind": "picture"`). A card with two sides that turns
over when tapped (or with Space). The front shows the picture, or the hint
when a word has no picture. The back shows the word, the hint, and a *Hear it*
button when there is a recording. After it has turned, further taps turn it
back and forth so both sides can be looked at again before rating. Learners
can turn the deck round (*Word → picture*). The turn is a CSS 3D flip; with
the system's *reduce motion* setting on, it switches without the animation.

- `hint` is a translation (*une pomme*) or a sentence with a gap for words that
  can't be drawn (*I stayed at home ___ it was raining.*). A sentence with a
  gap is set larger when it is the front of the card, and on the back the gap
  is filled in with the word.
- A card needs a word, plus a picture or a hint. Anything less stays in the
  deck but is left out of study, and the editor marks it *incomplete*.

**Verb forms** (`"kind": "verb"`). The front shows the base form and its
meaning. Learners either type the past simple (and the past participle, when
the deck asks for it) and have it checked on a flat card, or flip the card
over to see the forms.

- Several accepted spellings go in one field, separated by a slash:
  `learned / learnt`. Checking ignores case and extra spaces.

Both kinds use the drill's spaced-repetition scheduler (Again / Hard / Good /
Easy), with progress stored under its own key. *Export progress* on the menu
moves it between devices.

## Grammar sheets

PDFs listed under the decks in the order set in the editor. Tapping one opens
it in the device's own PDF viewer. They are saved for offline use as soon as
the app sees them. The sample sheet is A5, which reads better on a phone than
A4 and still prints.

## The editor

It works like the drill's editor. Changes are a **draft in this browser**:
text in `localStorage`, pictures, recordings and PDFs in IndexedDB. The study
pages in the same browser show the draft straight away. Publishing turns it
into files:

- **Publish to project…** (Chrome, Edge; Brave with
  `brave://flags/#file-system-access-api` enabled). Pick the **project
  folder**, the one containing `index.html` and `study/`, not `study/` itself.
  It writes `study/data/study.js` and any new files, then clears the draft.
- **Download changes (.zip)** everywhere else. Unzip it over the project folder
  (it contains a `study/` folder), then *Discard draft*.

Then commit and push, as for the drill.

- **Pictures** are shrunk to at most 800px and re-encoded as WebP (JPEG where
  the browser can't write WebP), which usually lands at 20–80 KB even from a
  phone photo. SVG drawings are kept as they are. Drop a picture on the card
  or use *Choose picture…*. If the word box is empty it is filled from the
  file name.
- **Files are named after their card**: `study/images/<deck>/<word>.webp`,
  `study/audio/<deck>/<word>.webm`, `study/grammar/<title>.pdf`.
- **Replaced or deleted files stay on disk.** A zip can't delete anything, so
  after publishing, the editor lists the files the data no longer uses; delete
  those by hand if you want the space back.
- **Card ids never change.** Editing a card's word keeps its id, so learners
  keep their progress on it. Deleting a card or a deck loses that progress,
  and the editor asks first.

### Importing from a spreadsheet

For big decks (the 750 words), open *Import from a spreadsheet*, give the sheet
a header row, and paste the rows straight out of Excel, Numbers or Google
Sheets, or load a `.csv`. Commas, semicolons (French-locale Excel) and tabs
are all understood.

| Deck | Columns (header names) |
|---|---|
| Picture cards | `word`, `hint`, `image` |
| Verb forms | `base`, `past`, `participle`, `meaning` |

Common alternatives are accepted too (`translation`, `french`, `picture`,
`past simple`, `past participle`, `infinitive`…).

- Use *Add pictures…* to select the image files before importing. A row's
  `image` column names its file. Leave the column out and pictures are matched
  by name: `apple.jpg` goes with *apple*.
- A row whose word is already in the deck **updates** that card rather than
  adding a copy, so learners keep their progress. An empty cell leaves the
  card's existing value alone.
- The report lists rows skipped, pictures named but not supplied, pictures
  that matched no word, and cards left incomplete.

## Data

`study/data/study.js`, loaded with a `<script>` tag for the same reason as the
drill's `data/deck.js` (it keeps working off disk). The editor writes one card
per line, so a 750-card deck stays readable and a changed card is a one-line
diff. Paths are relative to `study/`.

```js
window.STUDY_DATA = {
  "version": 1,
  "decks": [
    { "id": "everyday-words", "kind": "picture", "title": "…", "blurb": "…", "cards": [
      { "id": "w-apple", "word": "apple", "hint": "une pomme", "image": "images/everyday-words/apple.svg", "audio": null }
    ] },
    { "id": "irregular-verbs", "kind": "verb", "title": "…", "blurb": "…", "participle": true, "cards": [
      { "id": "v-go", "base": "go", "past": "went", "participle": "gone", "meaning": "aller" }
    ] }
  ],
  "grammar": [
    { "id": "g-past-simple", "title": "The past simple", "blurb": "…", "file": "grammar/past-simple.pdf" }
  ]
};
```

## Offline

The installed app covers this section too. The menu, player and data are
saved when the app is installed and refreshed like the drill's. Pictures are
saved as they are viewed, and opening a deck fetches the rest of its pictures
in the background, so a deck works offline after one visit online. The whole
750-word set is not downloaded at install time.

## Layout

```
study/index.html     the menu
study/cards.html     the card player
study/editor.html    the editor (not linked from anywhere)
study/data/study.js  decks and grammar sheets
study/js/study.js    shared: data, draft media store, scheduler, offline
study/js/menu.js     the menu
study/js/cards.js    the player
study/js/editor.js   the editor (also uses the zip writer in ../assets/js/deck.js)
study/css/study.css  on top of ../assets/css/app.css (and editor.css in the editor)
study/images/        pictures, one folder per deck
study/grammar/       grammar sheet PDFs
```

The sample pictures are simple SVG drawings made for this project, so there is
no licence to track. For the full decks, check the licence of any picture set
you use: several popular pictogram sets forbid commercial use.
