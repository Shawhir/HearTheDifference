"""Generate AI stand-in recordings for pair words nobody has recorded yet.

Every word in a pair can be played after answering (see "Comparing the pair"
in README.md). Words with no recording of their own and no card recording
fall back to the device's built-in voice; this script gives them a neural
voice instead, as a stand-in until a real recording is made in the editor.

It covers each option whole and, for sentences, each of their words, so a
learner can tap any word of an answered sentence and hear it on its own.

It writes audio/ai/<word>.mp3 and adds each to "words" in data/deck.js. A
word that already has any recording is left alone, so rerunning it after new
pairs are added only fills the new gaps. Re-recording a word in the editor
replaces its stand-in (the old file can then be deleted).

The voice is Kokoro-82M (Apache-2.0), British voice bf_emma, run locally:

    npm pack kokoro-q8-shards@1.0.0 kokoro-js@1.2.1
    tar xzf kokoro-q8-shards-1.0.0.tgz && cat package/kokoro-q8.part*.bin > kokoro-q8.onnx
    # sha256 fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478
    tar xzf kokoro-js-1.2.1.tgz        # voices are in package/voices/
    pip install kokoro-onnx lameenc
    python3 tools/make_ai_audio.py --model kokoro-q8.onnx --voice package/voices/bf_emma.bin

Output is mono MP3 at 64 kbps: for one voice that is indistinguishable from
the original, at roughly 8 KB a second.
"""
import argparse
import json
import os
import re
import sys
import unicodedata

import lameenc
import numpy as np
import onnxruntime as ort
from kokoro_onnx.tokenizer import Tokenizer

# Words the phonemizer reads the wrong way for these pairs, spoken on their
# own. "lives" defaults to the noun (/laɪvz/, nine lives); the pair "She
# lives there / She leaves there" needs the verb, with the short i.
PHONEMES = {
    'lives': 'lˈɪvz',
}

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DECK = os.path.join(ROOT, 'data', 'deck.js')
RATE = 24000
PREFIX = 'window.HTD_DECK = '


def key(text):
    return re.sub(r'\s+', ' ', text.strip().lower().replace('’', "'").replace('‘', "'"))


def slug(text):
    s = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode().lower()
    return (re.sub(r'[^a-z0-9]+', '-', s).strip('-') or 'word')[:60]


def read_deck():
    src = open(DECK, encoding='utf-8').read()
    start = src.index(PREFIX) + len(PREFIX)
    end = src.rindex('};') + 1
    return src, start, end, json.loads(src[start:end])


def token_key(t):
    # Same as tokens() in assets/js/deck.js: the word without surrounding
    # punctuation, so "book." is looked up as "book".
    return key(re.sub(r"^[^A-Za-z0-9'’‘]+|[^A-Za-z0-9'’‘]+$", '', t))


def missing_words(deck):
    """Each option whole, and each word of a sentence option, that has no
    recording of its own and no card recording."""
    have = {key(k) for k, v in (deck.get('words') or {}).items() if v}
    have |= {key(c['answer']) for c in deck['cards'] if c.get('audio')}
    out, seen = [], set()

    def add(k, text):
        if k and k not in have and k not in seen:
            seen.add(k)
            out.append(text)

    for c in deck['cards']:
        for o in c['options']:
            add(key(o), o.strip())
    for c in deck['cards']:
        for o in c['options']:
            words = o.split()
            if len(words) > 1:
                for w in words:
                    add(token_key(w), token_key(w))
    return out


def trim(wave, floor=0.01, pad=0.06):
    loud = np.where(np.abs(wave) > floor)[0]
    if not len(loud):
        return wave
    p = int(pad * RATE)
    return wave[max(0, loud[0] - p): loud[-1] + p]


# The existing recordings sit at about this loudness (median RMS); matching
# it keeps a stand-in from jumping out next to the real take it is compared
# with.
TARGET_RMS = 0.05


def to_mp3(wave):
    wave = wave * (TARGET_RMS / max(1e-6, float(np.sqrt((wave ** 2).mean()))))
    peak = np.abs(wave).max()
    if peak > 0.89:
        wave = wave * (0.89 / peak)
    pcm = (np.clip(wave, -1, 1) * 32767).astype('<i2').tobytes()
    enc = lameenc.Encoder()
    enc.set_bit_rate(64)
    enc.set_in_sample_rate(RATE)
    enc.set_channels(1)
    enc.set_quality(2)  # 2 = high quality encoding
    return enc.encode(pcm) + enc.flush()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True)
    ap.add_argument('--voice', required=True)
    ap.add_argument('--speed', type=float, default=0.9)
    ap.add_argument('--dry-run', action='store_true', help='print phonemes only')
    args = ap.parse_args()

    src, start, end, deck = read_deck()
    words = missing_words(deck)
    if not words:
        print('Every pair word already has a recording.')
        return

    tok = Tokenizer()
    voice = np.fromfile(args.voice, dtype=np.float32).reshape(-1, 1, 256)
    sess = None if args.dry_run else ort.InferenceSession(args.model)
    os.makedirs(os.path.join(ROOT, 'audio', 'ai'), exist_ok=True)
    deck.setdefault('words', {})

    for text in words:
        phon = PHONEMES.get(key(text)) or tok.phonemize(text, lang='en-gb')
        ids = tok.tokenize(phon)
        print(f'{text!r:34} /{phon}/')
        if args.dry_run:
            continue
        style = voice[min(len(ids), len(voice) - 1)]
        wave = sess.run(None, {
            'input_ids': np.array([[0, *ids, 0]], dtype=np.int64),
            'style': style.astype(np.float32),
            'speed': np.array([args.speed], dtype=np.float32),
        })[0][0]
        path = f'audio/ai/{slug(text)}.mp3'
        with open(os.path.join(ROOT, path), 'wb') as f:
            f.write(to_mp3(trim(wave)))
        deck['words'][key(text)] = path

    if not args.dry_run:
        body = json.dumps(deck, indent=2, ensure_ascii=False)
        open(DECK, 'w', encoding='utf-8').write(src[:start] + body + src[end:])
        print(f'Wrote {len(words)} stand-ins to audio/ai/ and data/deck.js.')


if __name__ == '__main__':
    sys.exit(main())
