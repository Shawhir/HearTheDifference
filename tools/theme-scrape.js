/* theme-scrape.js — lift a site's visual setup out of the browser console.
 *
 * Paste the whole file into DevTools on the *live* site (not the Wix editor
 * preview, which sandboxes the page in a cross-origin iframe) and it reports:
 *
 *   1. a :root block in this project's token vocabulary, ready to replace the
 *      one at the top of assets/css/app.css;
 *   2. the Google Fonts <link> that goes with it;
 *   3. site-theme.json — the full harvest (palette, type, radii, shadows,
 *      spacing, button styles, logo) for any other add-on you dress to match.
 *
 * It reads computed styles off elements that are actually on the page, so it
 * does not care what the CSS looks like or what the classes are called. Wix
 * ships its site palette as --color_1..--color_36 and its theme fonts as
 * --font_0..--font_10; those are read too, when present, and they are the more
 * trustworthy source because they are the site's stated intent rather than an
 * inference from whatever happens to be rendered.
 *
 * Nothing is uploaded. Everything stays in the tab, and the two files are
 * written by the browser's own download.
 */
(() => {
  'use strict';

  const MAX_ELEMENTS = 6000;     // survey cap; enough for any one page
  const GOOGLE_WGHT  = '400;500;600;700';

  /* ---------------------------------------------------------------- colour */

  const parse = (s) => {
    if (!s) return null;
    const m = String(s).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (p.length < 3 || p.some(Number.isNaN)) return null;
    const a = p.length > 3 ? p[3] : 1;
    return a === 0 ? null : { r: p[0], g: p[1], b: p[2], a };
  };

  const hex = (c) =>
    '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

  const hsl = (c) => {
    const r = c.r / 255, g = c.g / 255, b = c.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const l = (max + min) / 2;
    if (!d) return { h: 0, s: 0, l };
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return { h: h * 60, s, l };
  };

  /* Blend two colours in sRGB. Good enough for deriving a hairline or a muted
   * ink out of a pair we already trust; not a colour-science exercise. */
  const mix = (a, b, t) => ({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
    a: 1,
  });

  const lum = (c) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };

  const contrast = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };

  const dist = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);

  /* ------------------------------------------------------------ tallying */

  const Tally = () => {
    const m = new Map();
    return {
      add(colour, weight) {
        if (!colour || !(weight > 0)) return;
        const k = hex(colour);
        const e = m.get(k) || { colour, weight: 0, key: k };
        e.weight += weight;
        m.set(k, e);
      },
      addRaw(value, weight) { this.add(parse(value), weight); },
      ranked() { return [...m.values()].sort((a, b) => b.weight - a.weight); },
    };
  };

  const counter = () => {
    const m = new Map();
    return {
      add(v, w = 1) { if (v) m.set(v, (m.get(v) || 0) + w); },
      ranked() { return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([value, weight]) => ({ value, weight })); },
    };
  };

  /* ------------------------------------------------------- the Wix palette */

  /* Wix declares its site palette and theme fonts as custom properties. They
   * cannot be enumerated off a computed style in every browser, so probe the
   * documented names instead. Absent ones simply come back empty. */
  const wixTheme = () => {
    const hosts = [
      document.documentElement,
      document.body,
      document.querySelector('#SITE_CONTAINER'),
      document.querySelector('#site-root'),
      document.querySelector('#masterPage'),
    ].filter(Boolean);

    const colours = {}, fonts = {};
    for (const host of hosts) {
      const cs = getComputedStyle(host);
      for (let i = 1; i <= 36; i++) {
        const v = cs.getPropertyValue(`--color_${i}`).trim();
        if (v && !colours[`color_${i}`]) colours[`color_${i}`] = v;
      }
      for (let i = 0; i <= 10; i++) {
        const v = cs.getPropertyValue(`--font_${i}`).trim();
        if (v && !fonts[`font_${i}`]) fonts[`font_${i}`] = v;
      }
    }
    return { colours, fonts, found: Object.keys(colours).length > 0 };
  };

  /* ------------------------------------------------------------ font stacks */

  /* Wix prefixes every stack with an internal alias (wfont_1a2b3c_..., or a
   * bare font-family id). Those names mean nothing outside the Wix runtime, so
   * drop them and keep the real families and generic fallbacks. */
  const cleanStack = (stack) => {
    if (!stack) return null;
    const parts = stack
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter((s) => s && !/^wfont[_-]/i.test(s) && !/^font_\d/i.test(s) && !/^[0-9a-f]{6,}$/i.test(s));
    const seen = new Set();
    const out = parts.filter((p) => {
      const k = p.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return out.length ? out : null;
  };

  const quoteStack = (parts) =>
    parts
      .map((p) => (/^(serif|sans-serif|monospace|cursive|fantasy|system-ui|-apple-system|ui-[a-z]+)$/i.test(p) || !/[\s]/.test(p) ? p : `"${p}"`))
      .join(',');

  const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|-apple-system|blinkmacsystemfont|ui-[a-z]+|segoe ui|helvetica|helvetica neue|arial|georgia|times new roman|courier new|verdana|tahoma|impact)$/i;

  const primaryFamily = (parts) => parts && parts.find((p) => !GENERIC.test(p));

  /* A Wix --font_N is the whole `font` shorthand, e.g.
   *   normal normal normal 40px/1.4em wfont_a1b2_playfair,"Playfair Display",serif
   * Everything up to the size/line-height pair is weight and metrics, not a
   * family, and would otherwise be read as one. */
  const familiesFromWixFont = (v) =>
    cleanStack(String(v || '').replace(/^.*?\d[\d.]*(?:px|em|rem|%)\s*\/\s*[\d.]+\w*\s+/, ''));

  /* The project asks that every type token keep a real fallback: a webfont that
   * fails to load should degrade to something close, not to Times. If the site
   * only names its own face, append a stack that matches its shape. */
  const SERIF_FALLBACK = ['Georgia', 'Times New Roman', 'serif'];
  const SANS_FALLBACK = ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'];
  const withFallbacks = (parts, shape) => {
    if (!parts) return null;
    const last = parts[parts.length - 1] || '';
    const hasGeneric = /^(serif|sans-serif|monospace|system-ui)$/i.test(last);
    const looksSerif = shape === 'display'
      ? !/sans/i.test(last) && (/serif/i.test(last) || parts.some((f) => /serif|playfair|garamond|georgia|merriweather|lora|fraunces/i.test(f)))
      : parts.some((f) => /(^|[^-])serif/i.test(f) && !/sans/i.test(f));
    const tail = looksSerif ? SERIF_FALLBACK : SANS_FALLBACK;
    if (hasGeneric && parts.length >= 3) return parts;
    const seen = new Set(parts.map((f) => f.toLowerCase()));
    return parts.filter((f) => !/^(serif|sans-serif)$/i.test(f))
      .concat(tail.filter((f) => !seen.has(f.toLowerCase()) || /^(serif|sans-serif)$/i.test(f)));
  };

  /* ------------------------------------------------------------ the survey */

  const survey = () => {
    const bg = Tally(), text = Tally(), line = Tally(), accent = Tally();
    const displayFont = counter(), uiFont = counter();
    const radius = counter(), shadow = counter(), gap = counter(), pad = counter();
    const widths = [];

    const vwArea = innerWidth * innerHeight;
    const nodes = [...document.querySelectorAll('body *')].slice(0, MAX_ELEMENTS);

    for (const el of nodes) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;

      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;

      /* A full-page wrapper should win the background vote, but not by so much
       * that nothing else registers. Cap any one element at four viewports. */
      const area = Math.min(rect.width * rect.height, vwArea * 4);

      bg.addRaw(cs.backgroundColor, area);

      const own = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim())
        .join(' ');
      const size = parseFloat(cs.fontSize) || 16;

      if (own.length > 1) {
        text.addRaw(cs.color, own.length * Math.sqrt(size));
        const stack = cleanStack(cs.fontFamily);
        if (stack) {
          const heading = /^H[1-4]$/.test(el.tagName) || size >= 24 || Number(cs.fontWeight) >= 700;
          (heading ? displayFont : uiFont).add(quoteStack(stack), own.length);
        }
      }

      for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
        if (parseFloat(cs[`border${side}Width`]) > 0 && cs[`border${side}Style`] !== 'none') {
          line.addRaw(cs[`border${side}Color`], rect.width + rect.height);
        }
      }

      const clickable = el.matches('a,button,[role="button"],input[type="submit"]');
      if (clickable) {
        accent.addRaw(cs.backgroundColor, area * 2);
        accent.addRaw(cs.color, area);
        accent.addRaw(cs.borderTopColor, area / 2);
      }

      if (cs.borderTopLeftRadius !== '0px') radius.add(cs.borderTopLeftRadius, area / 1000);
      if (cs.boxShadow !== 'none') shadow.add(cs.boxShadow, area / 1000);
      if (cs.gap && cs.gap !== 'normal' && !cs.gap.startsWith('0px')) gap.add(cs.gap);
      if (cs.paddingTop !== '0px') pad.add(cs.paddingTop);
      if (rect.width > 320 && rect.width < innerWidth - 8) widths.push(Math.round(rect.width));
    }

    return { bg, text, line, accent, displayFont, uiFont, radius, shadow, gap, pad, widths, counted: nodes.length };
  };

  /* --------------------------------------------------------- role mapping */

  const roles = (s, wix) => {
    const notes = {};
    const palette = Object.values(wix.colours).map(parse).filter(Boolean);

    const bgRank = s.bg.ranked();
    const textRank = s.text.ranked();

    /* The page's surface is whatever the document paints behind everything,
     * which is the body background (or html, when body is transparent) — not
     * whichever card happens to cover the most area. Cards are --paper-2. */
    const rootBg = parse(getComputedStyle(document.body).backgroundColor)
      || parse(getComputedStyle(document.documentElement).backgroundColor);
    const paper = rootBg || bgRank[0]?.colour || { r: 255, g: 255, b: 255, a: 1 };
    notes.paper = rootBg ? 'the document background — what the page paints behind everything'
      : 'body and html are transparent, so: the most background area on the page';

    const ink = textRank[0]?.colour || { r: 33, g: 29, b: 24, a: 1 };
    notes.ink = textRank[0] ? 'most-set text colour, weighted by how much text it renders' : 'fallback — no text sampled';

    /* A second surface has to be visibly different from the page and still on
     * the page's side of the contrast line, or it is not a surface at all. */
    const paper2Hit = bgRank.find((e) =>
      dist(e.colour, paper) > 6 && dist(e.colour, paper) < 120 && contrast(e.colour, ink) > 3);
    const paper2 = paper2Hit ? paper2Hit.colour : mix(paper, ink, 0.07);
    notes['paper-2'] = paper2Hit ? 'the commonest surface sitting on top of the page — cards, panels, wells' : 'derived: paper nudged 7% toward ink';

    const lineHit = s.line.ranked().find((e) => contrast(e.colour, paper) < 4.5 && dist(e.colour, paper) > 8);
    const line = lineHit ? lineHit.colour : mix(paper, ink, 0.28);
    notes.line = lineHit ? 'commonest visible border colour' : 'derived: a hairline 28% of the way from paper to ink';

    /* Accent: whatever the site uses to mean "press this". Score saturation
     * against how much of it there is, and refuse anything that would read as
     * the page or the text. Claimed before --ink-soft, because on a site whose
     * only other text colour is the link colour, the two would otherwise
     * collapse onto one value and every muted line would shout. */
    const candidates = [
      ...s.accent.ranked().map((e) => ({ colour: e.colour, weight: e.weight })),
      ...palette.map((c, i) => ({ colour: c, weight: (36 - i) * 400 })),
    ];
    let accent = null, best = 0;
    for (const c of candidates) {
      const { s: sat, l } = hsl(c.colour);
      if (sat < 0.18 || l < 0.12 || l > 0.9) continue;
      if (dist(c.colour, paper) < 40 || dist(c.colour, ink) < 40) continue;
      const score = sat * Math.log1p(c.weight);
      if (score > best) { best = score; accent = c.colour; }
    }
    if (!accent) {
      accent = palette.map((c) => ({ c, s: hsl(c).s })).sort((a, b) => b.s - a.s)[0]?.c || { r: 192, g: 73, b: 47, a: 1 };
      notes.accent = 'no saturated interactive colour found — most saturated palette entry';
    } else {
      notes.accent = 'most saturated colour carrying real weight on links and buttons';
    }

    /* Muted body text: a second text colour that is neither the main ink nor
     * the accent, and still readable on the page. */
    const inkSoftHit = textRank.find((e) =>
      dist(e.colour, ink) > 24 && dist(e.colour, accent) > 40 && contrast(e.colour, paper) > 3.2);
    const inkSoft = inkSoftHit ? inkSoftHit.colour : mix(ink, paper, 0.35);
    notes['ink-soft'] = inkSoftHit ? 'second text colour, readable on paper and distinct from the accent'
      : 'derived: ink blended 35% into paper';

    /* Right and wrong are this project's vocabulary, not the site's. Take a
     * green and a red off the palette if the site has them; otherwise build a
     * pair at the accent's own saturation so they sit in the same family. */
    const byHue = (lo, hi) => palette.find((c) => {
      const { h, s: sat, l } = hsl(c);
      const within = lo < hi ? (h >= lo && h <= hi) : (h >= lo || h <= hi);
      return within && sat > 0.2 && l > 0.15 && l < 0.7;
    });
    const a = hsl(accent);
    const fromHSL = (h, sat, l) => {
      const c = (1 - Math.abs(2 * l - 1)) * sat, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
      const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
        : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
      return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255, a: 1 };
    };
    const goodHit = byHue(95, 175), badHit = byHue(345, 15);
    const good = goodHit || fromHSL(162, Math.max(0.28, a.s * 0.7), 0.31);
    const bad = badHit || fromHSL(6, Math.max(0.5, a.s), 0.39);
    notes.good = goodHit ? 'green taken from the site palette' : 'derived at the accent\'s saturation — check it against your accent';
    notes.bad = badHit ? 'red taken from the site palette' : 'derived at the accent\'s saturation — check it against your accent';

    const goodSoft = mix(good, paper, 0.76);
    notes['good-soft'] = 'derived: good blended 76% into paper, for a correct-answer fill';
    notes.shadow = 'derived: the darker of ink and paper, at 18% opacity';

    /* Wix's own theme fonts are the site's stated intent; what the headings
     * happen to render is the evidence. Prefer the evidence, fall back to the
     * declaration, and give whichever wins a fallback stack. */
    const displayHit = s.displayFont.ranked()[0]?.value;
    const uiHit = s.uiFont.ranked()[0]?.value;
    const asParts = (v) => v && v.split(',').map((x) => x.replace(/["']/g, '').trim()).filter(Boolean);

    const displayParts = withFallbacks(
      asParts(displayHit) || familiesFromWixFont(wix.fonts.font_2 || wix.fonts.font_3), 'display');
    const uiParts = withFallbacks(
      asParts(uiHit) || familiesFromWixFont(wix.fonts.font_8 || wix.fonts.font_7), 'ui');

    const display = displayParts && quoteStack(displayParts);
    const ui = uiParts && quoteStack(uiParts);
    notes.display = displayHit ? 'the face the headings actually render in, plus a matching fallback stack'
      : display ? 'the Wix theme heading font, plus a matching fallback stack'
      : 'nothing found — the project default is kept';
    notes.ui = uiHit ? 'the face body text actually renders in, plus a matching fallback stack'
      : ui ? 'the Wix theme body font, plus a matching fallback stack'
      : 'nothing found — the project default is kept';

    return {
      tokens: {
        paper: hex(paper), 'paper-2': hex(paper2), ink: hex(ink), 'ink-soft': hex(inkSoft),
        line: hex(line), accent: hex(accent), good: hex(good), 'good-soft': hex(goodSoft),
        bad: hex(bad),
        shadow: (() => { const d = lum(ink) < lum(paper) ? ink : paper;
          return `rgba(${Math.round(d.r)},${Math.round(d.g)},${Math.round(d.b)},.18)`; })(),
        display, ui,
      },
      notes,
      colours: { paper, paper2, ink, inkSoft, line, accent, good, bad },
    };
  };

  /* ------------------------------------------------------------ the extras */

  const assets = () => {
    const pick = (sel, attr) => document.querySelector(sel)?.getAttribute(attr) || null;
    const abs = (u) => { try { return u ? new URL(u, location.href).href : null; } catch { return u; } };
    const logo = [...document.images].find((i) =>
      /logo|brand|wordmark/i.test(`${i.src} ${i.alt} ${i.className}`) && i.width > 24);
    return {
      title: document.title,
      favicon: abs(pick('link[rel~="icon"]', 'href')),
      ogImage: abs(pick('meta[property="og:image"]', 'content')),
      description: pick('meta[name="description"]', 'content'),
      logo: logo ? { src: abs(logo.src), alt: logo.alt, width: logo.naturalWidth, height: logo.naturalHeight } : null,
      googleFontHrefs: [...document.querySelectorAll('link[rel="stylesheet"]')]
        .map((l) => l.href).filter((h) => /fonts\.googleapis\.com/.test(h)),
      loadedFamilies: (() => {
        try { return [...new Set([...document.fonts].map((f) => f.family.replace(/^["']|["']$/g, '')))].sort(); }
        catch { return []; }
      })(),
    };
  };

  /* --------------------------------------------------------------- output */

  const download = (name, text, type) => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const googleHref = (display, ui) => {
    const fams = [primaryFamily(display?.split(',').map((s) => s.replace(/"/g, '').trim())),
                  primaryFamily(ui?.split(',').map((s) => s.replace(/"/g, '').trim()))]
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i);
    if (!fams.length) return null;
    return 'https://fonts.googleapis.com/css2?'
      + fams.map((f) => `family=${f.replace(/\s+/g, '+')}:wght@${GOOGLE_WGHT}`).join('&')
      + '&display=swap';
  };

  /* --------------------------------------------------------------- run it */

  if (window.top !== window.self) {
    console.warn('[theme-scrape] This is running inside an iframe. If you are in the Wix '
      + 'editor preview, open the published site in its own tab and run it there instead.');
  }

  const wix = wixTheme();
  const s = survey();
  const r = roles(s, wix);
  const extra = assets();

  const ORDER = ['paper', 'paper-2', 'ink', 'ink-soft', 'line', 'accent', 'good', 'good-soft', 'bad', 'shadow'];
  const width = Math.max(...ORDER.map((k) => k.length));
  const css =
    `/* Lifted from ${location.origin} on ${new Date().toISOString().slice(0, 10)}\n`
    + ` * by tools/theme-scrape.js. Replace the :root block at the top of\n`
    + ` * assets/css/app.css with this one, and swap the Google Fonts <link>\n`
    + ` * in index.html and editor.html for the href below.\n`
    + ` *\n`
    + ORDER.concat(['display', 'ui']).map((k) => ` * --${k.padEnd(width)}  ${r.notes[k] || 'taken from the page'}`).join('\n')
    + `\n */\n:root{\n`
    + ORDER.map((k) => `  --${k}:${r.tokens[k]};`).join('\n')
    + `\n\n  --display:${r.tokens.display || '"Fraunces",Georgia,"Times New Roman",serif'};`
    + `\n  --ui:${r.tokens.ui || '"Hanken Grotesk",system-ui,-apple-system,"Segoe UI",sans-serif'};\n}\n`;

  const href = googleHref(r.tokens.display, r.tokens.ui);
  const link = href ? `<link href="${href}" rel="stylesheet">` : null;

  const report = {
    source: { url: location.href, scrapedAt: new Date().toISOString(), elementsSurveyed: s.counted },
    tokens: r.tokens,
    notes: r.notes,
    css,
    fontsLink: link,
    wix: { detected: wix.found, palette: wix.colours, themeFonts: wix.fonts },
    observed: {
      backgrounds: s.bg.ranked().slice(0, 12).map((e) => e.key),
      textColours: s.text.ranked().slice(0, 12).map((e) => e.key),
      borderColours: s.line.ranked().slice(0, 8).map((e) => e.key),
      interactive: s.accent.ranked().slice(0, 12).map((e) => e.key),
      displayFonts: s.displayFont.ranked().slice(0, 5),
      uiFonts: s.uiFont.ranked().slice(0, 5),
      radii: s.radius.ranked().slice(0, 6).map((e) => e.value),
      shadows: s.shadow.ranked().slice(0, 4).map((e) => e.value),
      gaps: s.gap.ranked().slice(0, 6).map((e) => e.value),
      paddings: s.pad.ranked().slice(0, 8).map((e) => e.value),
      contentWidth: (() => {
        if (!s.widths.length) return null;
        const w = [...s.widths].sort((a, b) => a - b);
        return { widest: w[w.length - 1], median: w[Math.floor(w.length / 2)] };
      })(),
    },
    assets: extra,
  };

  window.__siteTheme = report;

  console.log('%c theme-scrape ', 'background:#211d18;color:#f3ece0;font-weight:700',
    `${s.counted} elements · Wix palette ${wix.found ? 'found' : 'not found'}`);
  console.log('%cToken swatches', 'font-weight:700');
  for (const k of ORDER.slice(0, 9)) {
    console.log(`%c    %c --${k}: ${r.tokens[k]}  — ${r.notes[k] || 'taken from the page'}`,
      `background:${r.tokens[k]};border:1px solid #888`, 'background:none');
  }
  console.log('--display:', r.tokens.display);
  console.log('--ui:', r.tokens.ui);
  console.log('\n' + css);
  if (link) console.log('Fonts link for index.html / editor.html:\n' + link);
  else console.log('No webfont family recognised — keep the existing Google Fonts <link>.');
  console.log('Full harvest is on window.__siteTheme (try copy(__siteTheme) to put it on the clipboard).');

  download('site-theme.css', css, 'text/css');
  setTimeout(() => download('site-theme.json', JSON.stringify(report, null, 2), 'application/json'), 350);

  return report;
})();
