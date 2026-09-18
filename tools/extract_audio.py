#!/usr/bin/env python3
"""One-shot migration: split the original single-file build into a static site.

Reads the `<script id="cards-data">` island out of the legacy
`hear-the-difference.html`, writes every base64 data URI to `audio/<group>/<slug>.mp3`
and rewrites the card list as `data/cards.json` with file references instead.

Kept in the repo so the transformation is auditable and repeatable rather than a
one-off thing that happened in someone's terminal.

Usage:  python3 tools/extract_audio.py [legacy.html]
"""
from __future__ import annotations

import base64
import hashlib
import json
import pathlib
import re
import sys
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parent.parent
AUDIO_DIR = ROOT / "audio"
DATA_DIR = ROOT / "data"

# An MP3 that is nothing but an ID3 tag has no audio frames in it. Ten cards in
# the original deck are exactly that: a silent recording you cannot answer.
EMPTY_MP3_MAX_BYTES = 512

GROUPS = [
    {
        "id": "h",
        "label": "Dropped H",
        "ipa": "/h/",
        "ipaNote": "",
        "title": "The dropped H",
        "blurb": "Whether the breath at the start is there at all.",
        "example": "heat · eat",
    },
    {
        "id": "th",
        "label": "Voiced TH",
        "ipa": "/ð/",
        "ipaNote": "vs /d/,/z/",
        "title": "The voiced TH",
        "blurb": "The soft buzz that becomes a hard d or z.",
        "example": "they · day",
    },
    {
        "id": "i",
        "label": "Long vs short i",
        "ipa": "/iː/",
        "ipaNote": "vs /ɪ/",
        "title": "Long vs short i",
        "blurb": "The tense ee against the lax, clipped ih.",
        "example": "sheep · ship",
    },
]


def slugify(text: str, fallback: str = "card") -> str:
    """Filesystem-safe, lowercase, ASCII slug. Used for audio filenames only."""
    norm = unicodedata.normalize("NFKD", text)
    norm = norm.encode("ascii", "ignore").decode("ascii").lower()
    norm = re.sub(r"[^a-z0-9]+", "-", norm).strip("-")
    return (norm or fallback)[:60]


def legacy_id(card: dict) -> str:
    """The card key the original build wrote into localStorage.

    Reused verbatim as the card `id` so anyone with saved spaced-repetition
    progress keeps it across this refactor.
    """
    return f"{card['g']}|{card['o1']}|{card['o2']}>{card['ans']}"


def read_legacy_cards(html_path: pathlib.Path) -> list[dict]:
    html = html_path.read_text(encoding="utf-8")
    match = re.search(
        r'<script id="cards-data" type="application/json">(.*?)</script>',
        html,
        re.S,
    )
    if not match:
        sys.exit(f"no <script id='cards-data'> island found in {html_path}")
    return json.loads(match.group(1))


DECK_HEADER = """\
/* Hear the Difference — deck data.
 *
 * Plain JSON wrapped in one assignment so the app loads with a <script> tag and
 * therefore works when index.html is opened straight off disk (file:// blocks
 * fetch() of a sibling .json). Edit by hand or with editor.html.
 */
window.HTD_DECK = """


def render_deck(deck: dict) -> str:
    return DECK_HEADER + json.dumps(deck, ensure_ascii=False, indent=2) + ";\n"


def main() -> None:
    html_path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "hear-the-difference.html"
    legacy = read_legacy_cards(html_path)

    AUDIO_DIR.mkdir(exist_ok=True)
    DATA_DIR.mkdir(exist_ok=True)

    written: dict[str, str] = {}  # sha1 -> relative path, so identical takes share a file
    used_names: set[str] = set()
    cards: list[dict] = []
    silent: list[str] = []
    reused = 0

    for card in legacy:
        group = card["g"]
        blob = base64.b64decode(card["a"].split(",", 1)[1])
        digest = hashlib.sha1(blob).hexdigest()

        if len(blob) <= EMPTY_MP3_MAX_BYTES:
            # Tag-only MP3: no audio. Record the card with no recording attached
            # rather than shipping silence the learner has to guess at.
            audio_rel = None
            silent.append(card["ans"])
        elif digest in written:
            audio_rel = written[digest]
            reused += 1
        else:
            name = slugify(card["ans"])
            candidate, n = name, 2
            while f"{group}/{candidate}" in used_names:
                candidate, n = f"{name}-{n}", n + 1
            used_names.add(f"{group}/{candidate}")

            audio_rel = f"audio/{group}/{candidate}.mp3"
            path = ROOT / audio_rel
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(blob)
            written[digest] = audio_rel

        cards.append(
            {
                "id": legacy_id(card),
                "group": group,
                "options": [card["o1"], card["o2"]],
                "answer": card["ans"],
                "audio": audio_rel,
            }
        )

    deck = {
        "version": 1,
        "title": "Hear the Difference",
        "subtitle": "h · th · i",
        "groups": GROUPS,
        "cards": cards,
    }
    out = DATA_DIR / "deck.js"
    out.write_text(render_deck(deck), encoding="utf-8")

    total = sum((ROOT / c["audio"]).stat().st_size for c in cards if c["audio"])
    print(f"cards          {len(cards)}")
    print(f"audio files    {len(written)} ({total/1024:.0f} KB), {reused} card(s) reuse another card's take")
    print(f"missing audio  {len(silent)} card(s): {', '.join(silent) if silent else '—'}")
    print(f"wrote          {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
