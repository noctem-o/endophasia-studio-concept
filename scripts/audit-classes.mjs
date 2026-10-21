// Fails if a colour/shadow utility class used in src/ generated no CSS. Tailwind drops an unknown class SILENTLY: this is how
// `bg-teal-accent/8` (no /8 step) and `border-current/40` (currentColor takes no alpha) shipped as styles that never rendered.
//
//   npm run build && npm run audit:classes
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const dist = join(root, 'dist/assets');
const css = readdirSync(dist).filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(dist, f), 'utf8')).join('\n');
if (css.length === 0) { console.error('no built CSS: run `npm run build` first'); process.exit(2); }

const escape = (c) => c.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
// Gradients (from-/to-/via-) are deliberately absent: the design direction rules them out, so they are not audited.
const prefixes = /^(?:[a-z0-9-]+:)*!?(?:text|bg|border|ring|stroke|fill|shadow|outline|divide|opacity|decoration|accent|caret|placeholder)-[^\s'"`]+$/;
// SVG presentation attributes that merely look like utilities.
const svgAttributes = new Set(['stroke-width', 'stroke-dasharray', 'stroke-opacity', 'fill-opacity', 'stroke-linecap', 'stroke-linejoin', 'text-anchor']);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== '__tests__') yield* walk(p); } else if (/\.(ts|tsx)$/.test(name)) yield p;
  }
}

// Token scan over comment-stripped source. (A first version parsed string literals and was derailed by an apostrophe in a comment,
// silently skipping the rest of the file: a checker that can silently skip is worse than none. This cannot lose sync.)
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[\s;{}(,])\/\/.*$/gm, '$1');
const missing = new Map();
for (const file of walk(join(root, 'src'))) {
  const src = stripComments(readFileSync(file, 'utf8'));
  for (const m of src.matchAll(/[A-Za-z0-9:_\-/.\[\]%#!]+/g)) {
    const token = m[0].replace(/\.$/, '');
    if (!prefixes.test(token) || svgAttributes.has(token)) continue;
    const base = token.replace(/^(?:[a-z0-9-]+:)+/, '').replace(/^!/, '');
    // Variants (hover:, focus-visible:, lg:) wrap the same utility; check the utility and the full token.
    if (!css.includes(`.${escape(token)}`) && !css.includes(`.${escape(base)}`)) {
      if (!missing.has(token)) missing.set(token, new Set());
      missing.get(token).add(file.replace(root, ''));
    }
  }
}
if (missing.size === 0) { console.log('audit:classes — every colour/shadow utility in src/ generates CSS'); process.exit(0); }
console.error(`audit:classes — ${missing.size} class(es) generate no CSS (Tailwind drops unknown classes silently):`);
for (const [token, files] of missing) console.error(`  ${token}    ${[...files].join(', ')}`);
process.exit(1);
