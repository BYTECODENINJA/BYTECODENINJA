// ─────────────────────────────────────────────────────────────────────────────
//  build-assets.mjs — forges every static piece of art used by the README.
//  Run:  npm install && npm run build:assets
//  Output: ./assets/*.svg  (animated SVGs, self-contained, GitHub-safe: no JS)
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as si from 'simple-icons';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets');
const ICONS = path.join(OUT, 'icons');
fs.mkdirSync(ICONS, { recursive: true });

// ── palette: Roman bronze & gold × neon HUD ─────────────────────────────────
const C = {
  bg0: '#06070c', bg1: '#0c0f17', panel: '#10141f', line: '#2a2412',
  gold1: '#F6DE8D', gold2: '#D4AF37', gold3: '#8A6A1C', bronze: '#CD7F32',
  marble: '#E8E2D0', dim: '#8F8A7A', blue: '#38BDF8', cyan: '#22D3EE', violet: '#8B5CF6',
};
const SERIF = "Georgia, 'Times New Roman', 'Palatino Linotype', serif";
const MONO = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";
const SANS = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const write = (name, svg) => {
  fs.writeFileSync(path.join(OUT, name), svg.trim() + '\n');
  console.log('  ✓', name);
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// deterministic PRNG so rebuilds don't create noisy diffs
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── icon sources ────────────────────────────────────────────────────────────
const siMap = new Map(Object.entries(si).map(([k, v]) => [k.toLowerCase(), v]));
const brand = (slug) => {
  const icon = siMap.get('si' + slug.toLowerCase());
  if (!icon) throw new Error(`simple-icons: missing "${slug}"`);
  return icon;
};
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
// dark brand colours vanish on our dark panels → lift them to marble
const brandColor = (icon) => {
  const hex = '#' + icon.hex;
  return luminance(hex) < 0.28 ? C.marble : hex;
};
const lucide = (name) => {
  const file = path.join(ROOT, 'node_modules/lucide-static/icons', `${name}.svg`);
  if (!fs.existsSync(file)) throw new Error(`lucide-static: missing "${name}"`);
  const raw = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  return raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();
};

/** 24×24 glyph → positioned <g>. kind: brand | lucide */
function glyph(spec, x, y, size, color) {
  const s = size / 24;
  if (spec.brand) {
    const icon = brand(spec.brand);
    return `<g transform="translate(${x} ${y}) scale(${s})"><path fill="${spec.color ?? brandColor(icon)}" d="${icon.path}"/></g>`;
  }
  return `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${spec.color ?? color ?? C.gold2}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${lucide(spec.lucide)}</g>`;
}

// ── shared building blocks ──────────────────────────────────────────────────
const goldDefs = (id = 'gold') => `
  <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${C.gold1}"/><stop offset=".45" stop-color="${C.gold2}"/><stop offset="1" stop-color="${C.gold3}"/>
  </linearGradient>`;

/** Greek-key (meander) tile, continuous baseline */
const meander = (id, color, w = 40, h = 22, sw = 2.2) => `
  <pattern id="${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse">
    <path d="M0 ${h - 2} H6 V2 H${w - 6} V${h - 2} H${w} M${w - 6} ${h - 7} H14 V${h - 12} H${w - 14}"
          fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="square" stroke-linejoin="miter"/>
  </pattern>`;

const svgOpen = (w, h, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ${extra}>`;

// ═════════════════════════════════════════════════════════════════════════════
//  1 · HERO BANNER
// ═════════════════════════════════════════════════════════════════════════════
function banner() {
  const W = 1200, H = 470, cx = 600, cy = 172;
  const r = rng(2026);

  // stars
  let stars = '';
  for (let i = 0; i < 70; i++) {
    const x = r() * W, y = 30 + r() * (H - 60), rad = 0.5 + r() * 1.4;
    const dur = (2 + r() * 4).toFixed(1), begin = (r() * 4).toFixed(1);
    const col = r() > 0.7 ? C.blue : C.marble;
    stars += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(2)}" fill="${col}" opacity=".5">
      <animate attributeName="opacity" values=".08;.85;.08" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/></circle>`;
  }

  // doric column
  const column = (x) => {
    const top = 96, bot = 398, half = 21;
    let flutes = '';
    for (let i = -3; i <= 3; i++) {
      flutes += `<line x1="${x + i * 5.6}" y1="${top + 14}" x2="${x + i * 5.6}" y2="${bot - 8}" stroke="#000" stroke-opacity=".38" stroke-width="1.4"/>`;
    }
    return `
    <g>
      <rect x="${x - 34}" y="${top - 16}" width="68" height="10" rx="1.5" fill="url(#gold)"/>
      <rect x="${x - 27}" y="${top - 6}" width="54" height="6" fill="url(#gold)" opacity=".85"/>
      <path d="M${x - 27} ${top} Q${x - 27} ${top + 12} ${x - half} ${top + 14} H${x + half} Q${x + 27} ${top + 12} ${x + 27} ${top} Z" fill="url(#gold)" opacity=".75"/>
      <rect x="${x - half}" y="${top + 14}" width="${half * 2}" height="${bot - top - 14}" fill="url(#shaft)"/>
      ${flutes}
      <rect x="${x - 29}" y="${bot}" width="58" height="8" fill="url(#gold)" opacity=".85"/>
      <rect x="${x - 35}" y="${bot + 8}" width="70" height="10" rx="1.5" fill="url(#gold)"/>
      <ellipse cx="${x}" cy="${bot + 22}" rx="46" ry="6" fill="url(#glow)">
        <animate attributeName="opacity" values=".45;1;.45" dur="3.6s" repeatCount="indefinite"/></ellipse>
    </g>`;
  };

  // laurel wreath (open at the top)
  let laurel = '';
  const R = 96, leaves = 15;
  for (const side of [-1, 1]) {
    for (let i = 0; i < leaves; i++) {
      const t = i / (leaves - 1);
      const a = (90 + side * (10 + t * 138)) * (Math.PI / 180);
      for (const off of [-1, 1]) {
        const rr = R + off * 7;
        const x = cx + rr * Math.cos(a), y = cy + rr * Math.sin(a);
        const rot = (a * 180) / Math.PI + 90 + off * side * 32;
        const len = 15 - t * 4;
        laurel += `<ellipse cx="0" cy="0" rx="${len}" ry="4.6" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)})" fill="url(#gold)" opacity=".9">
          <animate attributeName="opacity" values=".55;1;.55" dur="4.4s" begin="${(i * 0.14 + (off > 0 ? 0.3 : 0)).toFixed(2)}s" repeatCount="indefinite"/></ellipse>`;
      }
    }
  }

  // HUD corners
  const bracket = (x, y, sx, sy) =>
    `<path d="M${x} ${y + sy * 26} V${y} H${x + sx * 26}" fill="none" stroke="${C.blue}" stroke-width="2"><animate attributeName="opacity" values=".35;1;.35" dur="3s" repeatCount="indefinite"/></path>`;

  // role cycler
  const roles = [
    'FULLSTACK  JAVASCRIPT  DEVELOPER',
    'REACT  ·  NODE.JS  ·  SYSTEM DESIGN',
    'CLEAN CODE FOR THE NEXT MAINTAINER',
    'BUILT TO LAST  ·  SHIPPED TO PRODUCTION',
  ];
  const cycle = roles.length * 3;
  const roleText = roles.map((t, k) => `
    <text x="${cx}" y="386" text-anchor="middle" font-family="${SERIF}" font-size="19" letter-spacing="6" fill="${C.marble}" opacity="${k === 0 ? 1 : 0}">${esc(t)}
      <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.03;0.22;0.25;1" dur="${cycle}s" begin="${k * 3}s" repeatCount="indefinite"/>
    </text>`).join('');

  return `${svgOpen(W, H, 'role="img" aria-label="Joseph Mulwa — BYTECODENINJA — Fullstack JavaScript Developer"')}
<title>Joseph Mulwa — BYTECODENINJA</title>
<defs>
  ${goldDefs('gold')}
  ${meander('key', C.gold2, 40, 22, 2.4)}
  <radialGradient id="bg" cx=".5" cy=".42" r=".75">
    <stop offset="0" stop-color="#151b2b"/><stop offset=".55" stop-color="${C.bg1}"/><stop offset="1" stop-color="${C.bg0}"/>
  </radialGradient>
  <linearGradient id="shaft" x1="0" x2="1">
    <stop offset="0" stop-color="#5b4a1c"/><stop offset=".3" stop-color="#e9d38a"/><stop offset=".55" stop-color="#b98f2c"/><stop offset="1" stop-color="#4a3a12"/>
  </linearGradient>
  <radialGradient id="glow"><stop offset="0" stop-color="${C.blue}" stop-opacity=".95"/><stop offset="1" stop-color="${C.blue}" stop-opacity="0"/></radialGradient>
  <radialGradient id="halo"><stop offset="0" stop-color="${C.gold2}" stop-opacity=".28"/><stop offset="1" stop-color="${C.gold2}" stop-opacity="0"/></radialGradient>
  <linearGradient id="scan" x1="0" x2="1">
    <stop offset="0" stop-color="${C.blue}" stop-opacity="0"/><stop offset=".5" stop-color="${C.cyan}" stop-opacity=".55"/><stop offset="1" stop-color="${C.blue}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="shine" gradientUnits="userSpaceOnUse" x1="-500" y1="0" x2="-200" y2="0">
    <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    <animate attributeName="x1" values="-500;1300" dur="6.5s" repeatCount="indefinite"/>
    <animate attributeName="x2" values="-200;1600" dur="6.5s" repeatCount="indefinite"/>
  </linearGradient>
  <clipPath id="frame"><rect width="${W}" height="${H}" rx="18"/></clipPath>
</defs>

<g clip-path="url(#frame)">
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${stars}
  <ellipse cx="${cx}" cy="${cy}" rx="300" ry="190" fill="url(#halo)"/>

  <!-- meander borders -->
  <rect x="0" y="0" width="${W}" height="28" fill="${C.bg0}"/>
  <rect x="0" y="3" width="${W}" height="22" fill="url(#key)" opacity=".9"/>
  <rect x="0" y="${H - 28}" width="${W}" height="28" fill="${C.bg0}"/>
  <rect x="0" y="${H - 25}" width="${W}" height="22" fill="url(#key)" opacity=".9"/>
  <rect x="0" y="28" width="${W}" height="1.5" fill="url(#gold)" opacity=".7"/>
  <rect x="0" y="${H - 29.5}" width="${W}" height="1.5" fill="url(#gold)" opacity=".7"/>

  ${column(92)}${column(W - 92)}
  ${column(200)}${column(W - 200)}

  <!-- HUD -->
  ${bracket(262, 56, 1, 1)}${bracket(W - 262, 56, -1, 1)}${bracket(262, H - 60, 1, -1)}${bracket(W - 262, H - 60, -1, -1)}
  <g font-family="${MONO}" font-size="11" letter-spacing="1.5">
    <text x="290" y="76" fill="${C.blue}" opacity=".85">LOC // LOCALHOST</text>
    <text x="290" y="92" fill="${C.dim}">STATUS // <tspan fill="${C.cyan}">ONLINE<animate attributeName="opacity" values="1;.35;1" dur="1.8s" repeatCount="indefinite"/></tspan></text>
    <text x="${W - 290}" y="76" text-anchor="end" fill="${C.blue}" opacity=".85">MODE // FULLSTACK</text>
    <text x="${W - 290}" y="92" text-anchor="end" fill="${C.dim}">STACK // JS · TS · PY</text>
  </g>

  <!-- emblem -->
  <g>
    ${laurel}
    <circle cx="${cx}" cy="${cy}" r="66" fill="${C.bg0}" stroke="url(#gold)" stroke-width="2.5"/>
    <circle cx="${cx}" cy="${cy}" r="58" fill="none" stroke="${C.gold3}" stroke-width="1" stroke-dasharray="2 5"/>
    <g>
      <circle cx="${cx}" cy="${cy}" r="76" fill="none" stroke="${C.blue}" stroke-width="1.6" stroke-dasharray="6 10" opacity=".9"/>
      <circle cx="${cx}" cy="${cy - 76}" r="4" fill="${C.cyan}"/>
      <animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="22s" repeatCount="indefinite"/>
    </g>
    <text x="${cx}" y="${cy + 19}" text-anchor="middle" font-family="${SERIF}" font-size="56" font-weight="700" fill="url(#gold)">JM</text>
    <text x="${cx}" y="${cy + 40}" text-anchor="middle" font-family="${MONO}" font-size="10" letter-spacing="3" fill="${C.blue}">&lt;/&gt;</text>
  </g>

  <!-- title -->
  <text x="${cx}" y="66" text-anchor="middle" font-family="${SERIF}" font-size="13" letter-spacing="9" fill="${C.gold3}">VENI  ·  VIDI  ·  VERCEL</text>
  <text x="${cx}" y="336" text-anchor="middle" font-family="${SERIF}" font-size="56" font-weight="700" letter-spacing="10" fill="url(#gold)">JOSEPH MULWA</text>
  <text x="${cx}" y="336" text-anchor="middle" font-family="${SERIF}" font-size="56" font-weight="700" letter-spacing="10" fill="url(#shine)">JOSEPH MULWA</text>
  ${roleText}
  <text x="${cx}" y="421" text-anchor="middle" font-family="${MONO}" font-size="15" letter-spacing="3" fill="${C.blue}">@BYTECODENINJA<tspan fill="${C.cyan}">_<animate attributeName="opacity" values="1;0;1" dur="1.1s" repeatCount="indefinite"/></tspan></text>

  <!-- scan line -->
  <rect x="0" y="30" width="${W}" height="2" fill="url(#scan)"><animate attributeName="y" values="30;${H - 32};30" dur="9s" repeatCount="indefinite"/></rect>
</g>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="18" fill="none" stroke="url(#gold)" stroke-width="2"/>
</svg>`;
}

// ═════════════════════════════════════════════════════════════════════════════
//  2 · SECTION HEADERS
// ═════════════════════════════════════════════════════════════════════════════
function sectionHeader(num, title, sub) {
  const W = 900, H = 68;
  return `${svgOpen(W, H, `role="img" aria-label="${esc(num)}. ${esc(title)}"`)}
<title>${esc(num)}. ${esc(title)}</title>
<defs>
  ${goldDefs('gold')}
  ${meander('key', C.gold3, 32, 18, 1.8)}
  <linearGradient id="sweep" gradientUnits="userSpaceOnUse" x1="-200" x2="0" y1="0" y2="0">
    <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    <animate attributeName="x1" values="-200;900" dur="5s" repeatCount="indefinite"/>
    <animate attributeName="x2" values="0;1100" dur="5s" repeatCount="indefinite"/>
  </linearGradient>
  <clipPath id="c"><rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="12"/></clipPath>
</defs>
<rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="12" fill="${C.bg1}" stroke="url(#gold)" stroke-width="1.6"/>
<g clip-path="url(#c)">
  <rect x="${W - 262}" y="24" width="250" height="20" fill="url(#key)" opacity=".75"/>
  <rect x="2" y="2" width="${W - 4}" height="${H - 4}" fill="url(#sweep)"/>
</g>
<circle cx="46" cy="34" r="23" fill="${C.bg0}" stroke="url(#gold)" stroke-width="2"/>
<circle cx="46" cy="34" r="18" fill="none" stroke="${C.gold3}" stroke-width="1" stroke-dasharray="2 3"/>
<text x="46" y="${num.length > 3 ? 40 : 41}" text-anchor="middle" font-family="${SERIF}" font-size="${num.length > 3 ? 15 : 19}" font-weight="700" fill="url(#gold)">${esc(num)}</text>
<text x="86" y="33" font-family="${SERIF}" font-size="23" font-weight="700" letter-spacing="5" fill="url(#gold)">${esc(title)}</text>
<text x="87" y="53" font-family="${MONO}" font-size="12" letter-spacing="2" fill="${C.blue}">${esc(sub)}</text>
<path d="M${W - 274} 34 l7 -7 l7 7 l-7 7 z" fill="${C.gold2}"><animate attributeName="opacity" values=".4;1;.4" dur="2.4s" repeatCount="indefinite"/></path>
</svg>`;
}

function divider() {
  const W = 900, H = 30;
  return `${svgOpen(W, H, 'role="separator" aria-hidden="true"')}
<defs>
  ${goldDefs('gold')}
  ${meander('key', C.gold3, 30, 16, 1.6)}
  <linearGradient id="fade" x1="0" x2="1">
    <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".2" stop-color="#fff"/><stop offset=".8" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>
  <mask id="m"><rect width="${W}" height="${H}" fill="url(#fade)"/></mask>
</defs>
<g mask="url(#m)">
  <rect x="0" y="7" width="${W}" height="16" fill="url(#key)"/>
</g>
<g transform="translate(${W / 2} ${H / 2})">
  <rect x="-16" y="-13" width="32" height="26" fill="${C.bg0}"/>
  <path d="M0 -11 L11 0 L0 11 L-11 0 Z" fill="none" stroke="url(#gold)" stroke-width="2"/>
  <circle r="3.5" fill="${C.blue}"><animate attributeName="opacity" values="1;.3;1" dur="2s" repeatCount="indefinite"/></circle>
</g>
</svg>`;
}

// ═════════════════════════════════════════════════════════════════════════════
//  3 · TECH-STACK TABLETS
// ═════════════════════════════════════════════════════════════════════════════
function stackPanel(title, items, hint) {
  const W = 900, pad = 22, gap = 10, top = 52, tileH = 104;
  const n = items.length;
  const tileW = Math.min(112, Math.floor((W - pad * 2 - gap * (n - 1)) / n));
  const total = n * tileW + (n - 1) * gap;
  const x0 = (W - total) / 2;
  const H = top + tileH + 24;

  const tiles = items.map((it, i) => {
    const x = x0 + i * (tileW + gap), y = top;
    const isz = 40;
    return `
  <g transform="translate(${x.toFixed(1)} ${y})">
    <rect width="${tileW}" height="${tileH}" rx="10" fill="${C.panel}" stroke="${C.line}" stroke-width="1.4"/>
    <rect x="1" y="1" width="${tileW - 2}" height="26" rx="9" fill="url(#tileTop)"/>
    <rect x="${tileW / 2 - 12}" y="${tileH - 3}" width="24" height="2" rx="1" fill="url(#gold)" opacity=".9"/>
    <g>
      ${glyph(it, tileW / 2 - isz / 2, 18, isz)}
      <animateTransform attributeName="transform" type="translate" values="0 0;0 -3.5;0 0" dur="3.4s" begin="${(i * 0.31).toFixed(2)}s" repeatCount="indefinite"/>
    </g>
    <text x="${tileW / 2}" y="${tileH - 16}" text-anchor="middle" font-family="${SANS}" font-size="12.5" font-weight="600" fill="${C.marble}">${esc(it.label)}</text>
  </g>`;
  }).join('');

  return `${svgOpen(W, H, `role="img" aria-label="${esc(title)}: ${esc(items.map((i) => i.label).join(', '))}"`)}
<title>${esc(title)}: ${esc(items.map((i) => i.label).join(', '))}</title>
<defs>
  ${goldDefs('gold')}
  ${meander('key', C.gold3, 26, 14, 1.4)}
  <linearGradient id="tileTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.gold2}" stop-opacity=".16"/><stop offset="1" stop-color="${C.gold2}" stop-opacity="0"/></linearGradient>
</defs>
<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="14" fill="${C.bg1}" stroke="url(#gold)" stroke-width="1.6"/>
<text x="${pad + 4}" y="32" font-family="${SERIF}" font-size="15" font-weight="700" letter-spacing="4" fill="url(#gold)">${esc(title)}</text>
${hint ? `<text x="${W - pad - 4}" y="32" text-anchor="end" font-family="${MONO}" font-size="11" letter-spacing="1.5" fill="${C.blue}">${esc(hint)}</text>` : ''}
<rect x="${pad + 4}" y="37" width="${W - pad * 2 - 8}" height="14" fill="url(#key)" opacity=".6"/>
${tiles}
</svg>`;
}

// ═════════════════════════════════════════════════════════════════════════════
//  4 · FOCUS AREAS
// ═════════════════════════════════════════════════════════════════════════════
function focusPanel() {
  const areas = [
    { name: 'Frontend', tag: 'Pixel-perfect UI', spec: { lucide: 'monitor-smartphone' } },
    { name: 'Backend', tag: 'APIs that scale', spec: { lucide: 'server' } },
    { name: 'Fullstack', tag: 'Idea to deploy', spec: { lucide: 'layers' } },
    { name: 'System Design', tag: 'Blueprints first', spec: { lucide: 'network' } },
    { name: 'AI Development', tag: 'Smart systems', spec: { lucide: 'brain-circuit' } },
    { name: 'Linux', tag: 'Terminal native', spec: { brand: 'linux', color: C.gold1 } },
    { name: 'DevOps', tag: 'Ship it, safely', spec: { lucide: 'infinity' } },
  ];
  const W = 900, pad = 14, gap = 8, tileH = 150;
  const n = areas.length, tileW = Math.floor((W - pad * 2 - gap * (n - 1)) / n);
  const H = tileH + pad * 2;
  const tiles = areas.map((a, i) => {
    const x = pad + i * (tileW + gap);
    return `
  <g transform="translate(${x} ${pad})">
    <path d="M0 14 Q0 0 14 0 H${tileW - 14} Q${tileW} 0 ${tileW} 14 V${tileH} H0 Z" fill="${C.panel}" stroke="${C.line}" stroke-width="1.4"/>
    <path d="M6 ${tileH} V24 Q6 6 24 6 H${tileW - 24} Q${tileW - 6} 6 ${tileW - 6} 24 V${tileH}" fill="none" stroke="${C.gold3}" stroke-width=".8" stroke-dasharray="2 4" opacity=".6"/>
    <circle cx="${tileW / 2}" cy="52" r="30" fill="${C.bg0}" stroke="url(#gold)" stroke-width="1.8"/>
    <circle cx="${tileW / 2}" cy="52" r="30" fill="none" stroke="${C.cyan}" stroke-width="1" stroke-dasharray="3 9" opacity=".8">
      <animateTransform attributeName="transform" type="rotate" from="0 ${tileW / 2} 52" to="${i % 2 ? -360 : 360} ${tileW / 2} 52" dur="${14 + i}s" repeatCount="indefinite"/></circle>
    ${glyph(a.spec, tileW / 2 - 16, 36, 32, C.gold1)}
    <text x="${tileW / 2}" y="112" text-anchor="middle" font-family="${SERIF}" font-size="${a.name.length > 12 ? 11.5 : 14}" font-weight="700" letter-spacing=".5" fill="${C.marble}">${esc(a.name)}</text>
    <text x="${tileW / 2}" y="131" text-anchor="middle" font-family="${MONO}" font-size="9.6" fill="${C.blue}">${esc(a.tag)}</text>
    <rect x="${tileW / 2 - 14}" y="${tileH - 4}" width="28" height="3" rx="1.5" fill="url(#gold)"/>
  </g>`;
  }).join('');
  return `${svgOpen(W, H, 'role="img" aria-label="Focus areas: Frontend, Backend, Fullstack, System Design, AI Development, Linux, DevOps"')}
<title>Focus areas: Frontend, Backend, Fullstack, System Design, AI Development, Linux, DevOps</title>
<defs>${goldDefs('gold')}</defs>
${tiles}
</svg>`;
}

// ═════════════════════════════════════════════════════════════════════════════
//  5 · "ASK ME ABOUT" CHIPS
// ═════════════════════════════════════════════════════════════════════════════
function askChips() {
  const chips = [
    { label: 'React', spec: { brand: 'react' } },
    { label: 'JavaScript', spec: { brand: 'javascript' } },
    { label: 'Node.js', spec: { brand: 'nodedotjs' } },
    { label: 'OOP', spec: { lucide: 'boxes', color: C.gold1 } },
    { label: 'System Design', spec: { lucide: 'network', color: C.gold1 } },
  ];
  const H = 52, gap = 12;
  const widths = chips.map((c) => 62 + Math.round(c.label.length * 9));
  const W = 900, total = widths.reduce((a, b) => a + b, 0) + gap * (chips.length - 1);
  let x = (W - total) / 2;
  const body = chips.map((c, i) => {
    const w = widths[i], out = `
  <g transform="translate(${x.toFixed(1)} 6)">
    <rect width="${w}" height="40" rx="20" fill="${C.panel}" stroke="url(#gold)" stroke-width="1.5"/>
    <circle cx="22" cy="20" r="14" fill="${C.bg0}" stroke="${C.line}"/>
    ${glyph(c.spec, 12, 10, 20, C.gold1)}
    <text x="44" y="25.5" font-family="${SANS}" font-size="14.5" font-weight="600" fill="${C.marble}">${esc(c.label)}</text>
    <animateTransform attributeName="transform" type="translate" additive="sum" values="0 0;0 -2.5;0 0" dur="3.2s" begin="${(i * 0.4).toFixed(1)}s" repeatCount="indefinite"/>
  </g>`;
    x += w + gap;
    return out;
  }).join('');
  return `${svgOpen(W, H, 'role="img" aria-label="Ask me about: React, JavaScript, Node.js, OOP, System Design"')}
<title>Ask me about: React, JavaScript, Node.js, OOP, System Design</title>
<defs>${goldDefs('gold')}</defs>
${body}
</svg>`;
}

// ═════════════════════════════════════════════════════════════════════════════
//  6 · EPILOGUE CARD (Stoic quote)
// ═════════════════════════════════════════════════════════════════════════════
function epilogue() {
  const W = 900, H = 150;
  return `${svgOpen(W, H, 'role="img" aria-label="Waste no more time arguing what a good man should be. Be one. — Marcus Aurelius"')}
<title>Marcus Aurelius, Meditations</title>
<defs>
  ${goldDefs('gold')}
  ${meander('key', C.gold3, 32, 18, 1.8)}
  <radialGradient id="g" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="${C.gold2}" stop-opacity=".18"/><stop offset="1" stop-color="${C.gold2}" stop-opacity="0"/></radialGradient>
</defs>
<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="16" fill="${C.bg1}" stroke="url(#gold)" stroke-width="1.6"/>
<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="16" fill="url(#g)"/>
<rect x="24" y="14" width="${W - 48}" height="18" fill="url(#key)" opacity=".55"/>
<rect x="24" y="${H - 32}" width="${W - 48}" height="18" fill="url(#key)" opacity=".55"/>
<text x="${W / 2}" y="76" text-anchor="middle" font-family="${SERIF}" font-style="italic" font-size="23" fill="${C.marble}">“Waste no more time arguing what a good man should be. Be one.”</text>
<text x="${W / 2}" y="106" text-anchor="middle" font-family="${MONO}" font-size="12.5" letter-spacing="4" fill="${C.gold2}">— MARCUS AURELIUS  ·  MEDITATIONS</text>
<circle cx="${W / 2}" cy="122" r="0" fill="${C.blue}"/>
</svg>`;
}

// ═════════════════════════════════════════════════════════════════════════════
//  7 · INLINE ICON CHIPS (used inside README tables)
// ═════════════════════════════════════════════════════════════════════════════
function iconChip(spec, name) {
  const S = 40;
  const svg = `${svgOpen(S, S, 'role="img"')}<title>${esc(name)}</title>
<defs>${goldDefs('gold')}</defs>
<rect x=".75" y=".75" width="${S - 1.5}" height="${S - 1.5}" rx="10" fill="${C.bg1}" stroke="url(#gold)" stroke-width="1.4"/>
${glyph(spec, 9, 9, 22, C.gold1)}
</svg>`;
  fs.writeFileSync(path.join(ICONS, `${name}.svg`), svg + '\n');
}

// ═════════════════════════════════════════════════════════════════════════════
//  BUILD
// ═════════════════════════════════════════════════════════════════════════════
console.log('Forging assets…');
write('banner.svg', banner());
write('divider.svg', divider());

const sections = [
  ['I', 'THE INSCRIPTION', '// a proper introduction'],
  ['II', 'ABOUT THE ARCHITECT', '// who · ask me · reach me'],
  ['III', 'FIELDS OF CONQUEST', '// focus areas'],
  ['IV', 'HALL OF TROPHIES', '// stats · streaks · trophies'],
  ['V', 'THE ARSENAL', '// languages · frameworks · tools'],
  ['VI', "THE ORACLE'S CHARTS", '// radar · monthly · daily'],
  ['VII', 'FEATURED WORKS', '// frontend · backend · fullstack'],
  ['VIII', 'EPILOGUE', '// connect with me'],
];
sections.forEach(([n, t, s], i) => write(`section-${i + 1}.svg`, sectionHeader(n, t, s)));

write('focus-areas.svg', focusPanel());
write('ask-me.svg', askChips());
write('epilogue.svg', epilogue());

const B = (slug, label) => ({ brand: slug, label });
write('stack-languages.svg', stackPanel('PROGRAMMING LANGUAGES', [
  B('python', 'Python'), B('javascript', 'JavaScript'), B('typescript', 'TypeScript'),
  { lucide: 'database', color: C.blue, label: 'SQL' },
], '// the tongues I speak'));
write('stack-frontend.svg', stackPanel('FRONTEND FRAMEWORKS', [
  B('react', 'React'), B('gsap', 'GSAP'), B('framer', 'Framer Motion'),
  B('tanstack', 'TanStack'), B('vite', 'Vite'), B('nextdotjs', 'Next.js'),
], '// pixels with purpose'));
write('stack-backend.svg', stackPanel('BACKEND FRAMEWORKS', [
  B('nodedotjs', 'Node.js'), B('nestjs', 'NestJS'), B('express', 'Express.js'), B('firebase', 'Firebase'),
], '// the engine room'));
write('stack-database.svg', stackPanel('DATABASES', [
  B('mysql', 'MySQL'), B('postgresql', 'PostgreSQL'), B('redis', 'Redis'), B('mongodb', 'MongoDB'),
], '// where the data sleeps'));
write('stack-tools.svg', stackPanel('TOOLS', [
  B('linux', 'Linux'), B('docker', 'Docker'), B('podman', 'Podman'), B('webstorm', 'WebStorm'),
  B('git', 'Git'), B('webpack', 'Webpack'), B('postman', 'Postman'),
  { lucide: 'send', color: C.blue, label: 'Reqable' }, B('datagrip', 'DataGrip'),
], '// the forge'));

// inline chips
const chipSpecs = {
  // object icons (lucide)
  target: { lucide: 'target' }, eye: { lucide: 'eye' }, user: { lucide: 'user' },
  ask: { lucide: 'message-circle-question' }, mail: { lucide: 'mail' }, compass: { lucide: 'compass' },
  sprout: { lucide: 'sprout' }, monitor: { lucide: 'monitor-smartphone' }, server: { lucide: 'server' },
  layers: { lucide: 'layers' }, castle: { lucide: 'castle' }, scroll: { lucide: 'scroll-text' },
  // brand icons
  nextdotjs: { brand: 'nextdotjs' }, typescript: { brand: 'typescript' }, tailwindcss: { brand: 'tailwindcss' },
  react: { brand: 'react' }, nodedotjs: { brand: 'nodedotjs' }, express: { brand: 'express' },
  postgresql: { brand: 'postgresql' }, mongodb: { brand: 'mongodb' }, javascript: { brand: 'javascript' },
  vercel: { brand: 'vercel' }, gsap: { brand: 'gsap' }, mysql: { brand: 'mysql' }, redis: { brand: 'redis' },
  docker: { brand: 'docker' }, python: { brand: 'python' }, nestjs: { brand: 'nestjs' }, firebase: { brand: 'firebase' },
  sqlite: { brand: 'sqlite' }, github: { brand: 'github' }, kubernetes: { brand: 'kubernetes' }, jenkins: { brand: 'jenkins' },
};
for (const [name, spec] of Object.entries(chipSpecs)) iconChip(spec, name);
console.log(`  ✓ ${Object.keys(chipSpecs).length} inline icon chips`);

// ═════════════════════════════════════════════════════════════════════════════
//  8 · CONTACT PILLS & PROJECT BUTTONS
// ═════════════════════════════════════════════════════════════════════════════
function contactPill(file, label, value, spec) {
  const H = 52, w = Math.max(200, 80 + Math.round(value.length * 8.8));
  write(file, `${svgOpen(w, H, `role="img" aria-label="${esc(label)}: ${esc(value)}"`)}
<title>${esc(label)}: ${esc(value)}</title>
<defs>${goldDefs('gold')}</defs>
<rect x="1.5" y="1.5" width="${w - 3}" height="${H - 3}" rx="14" fill="${C.panel}" stroke="url(#gold)" stroke-width="1.5"/>
<circle cx="28" cy="26" r="17" fill="${C.bg0}" stroke="${C.line}" stroke-width="1.4"/>
${glyph(spec, 17, 15, 22, C.gold1)}
<text x="56" y="22" font-family="${MONO}" font-size="10" letter-spacing="2.5" fill="${C.blue}">${esc(label.toUpperCase())}</text>
<text x="56" y="39" font-family="${SANS}" font-size="14" font-weight="600" fill="${C.marble}">${esc(value)}</text>
</svg>`);
}
function actionButton(file, label, spec, accent) {
  const H = 34, w = 58 + label.length * 8;
  write(file, `${svgOpen(w, H, `role="img" aria-label="${esc(label)}"`)}
<title>${esc(label)}</title>
<defs>${goldDefs('gold')}</defs>
<rect x="1" y="1" width="${w - 2}" height="${H - 2}" rx="17" fill="${C.panel}" stroke="${accent === 'blue' ? C.blue : 'url(#gold)'}" stroke-width="1.5"/>
${glyph(spec, 12, 8, 18, accent === 'blue' ? C.blue : C.gold1)}
<text x="38" y="22" font-family="${SANS}" font-size="13" font-weight="700" letter-spacing=".4" fill="${C.marble}">${esc(label)}</text>
</svg>`);
}
contactPill('contact-gmail.svg', 'Gmail', 'josephmulwa8055@gmail.com', { brand: 'gmail' });
contactPill('contact-outlook.svg', 'Outlook', 'josephmulwa808@outlook.com', { lucide: 'mail', color: C.blue });
contactPill('contact-web.svg', 'Portfolio', 'joseph-m-tau.vercel.app', { lucide: 'globe', color: C.gold1 });
contactPill('contact-github.svg', 'GitHub', 'BYTECODENINJA', { brand: 'github' });
contactPill('contact-linkedin.svg', 'LinkedIn', 'joseph-mulwa808', { lucide: 'briefcase', color: C.blue });
actionButton('btn-repo.svg', 'Repository', { brand: 'github' }, 'gold');
actionButton('btn-live.svg', 'Live Preview', { lucide: 'external-link', color: C.blue }, 'blue');

console.log('Done.');
