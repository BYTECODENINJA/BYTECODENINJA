// ─────────────────────────────────────────────────────────────────────────────
//  generate-charts.mjs — "The Oracle's Charts"
//  Pulls live data from the GitHub GraphQL API and forges two animated SVGs:
//    • assets/radar-languages.svg      radar of languages across your repos
//    • assets/spline-contributions.svg smooth spline of contributions & commits (last 12 months)
//    • assets/spline-daily.svg         smooth spline of daily contributions & commits (last 30 days)
//
//  Usage
//    GH_TOKEN=xxx GH_USER=BYTECODENINJA node scripts/generate-charts.mjs
//    node scripts/generate-charts.mjs --pending   # placeholder panels (no API)
//    node scripts/generate-charts.mjs --mock --out /tmp/preview   # demo data, for design checks only
//  No dependencies — Node 18+.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const OUT = opt('--out', path.join(ROOT, 'assets'));
fs.mkdirSync(OUT, { recursive: true });

const USER = process.env.GH_USER || 'BYTECODENINJA';
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

const C = {
  bg0: '#06070c', bg1: '#0c0f17', panel: '#10141f', line: '#2a2412',
  gold1: '#F6DE8D', gold2: '#D4AF37', gold3: '#8A6A1C', marble: '#E8E2D0', dim: '#8F8A7A',
  blue: '#38BDF8', cyan: '#22D3EE', violet: '#8B5CF6',
};
const SERIF = "Georgia, 'Times New Roman', 'Palatino Linotype', serif";
const MONO = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";
const SANS = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const stamp = new Date().toISOString().slice(0, 10);

// ── data ────────────────────────────────────────────────────────────────────
async function gql(query, variables = {}) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'profile-charts' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(`GraphQL failed: ${JSON.stringify(json.errors ?? json)}`);
  return json.data;
}

async function fetchLanguages() {
  const data = await gql(
    `query($login:String!){ user(login:$login){ repositories(first:100, ownerAffiliations:OWNER, isFork:false){
       nodes{ languages(first:10, orderBy:{field:SIZE, direction:DESC}){ edges{ size node{ name color } } } } } } }`,
    { login: USER },
  );
  const totals = new Map();
  for (const repo of data.user.repositories.nodes)
    for (const { size, node } of repo.languages.edges) {
      const cur = totals.get(node.name) ?? { name: node.name, color: node.color || C.gold2, bytes: 0 };
      cur.bytes += size;
      totals.set(node.name, cur);
    }
  const all = [...totals.values()].sort((a, b) => b.bytes - a.bytes);
  const sum = all.reduce((a, l) => a + l.bytes, 0) || 1;
  return all.slice(0, 8).map((l) => ({ ...l, pct: (l.bytes / sum) * 100 }));
}

async function fetchMonths() {
  const now = new Date();
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  const spans = [];
  for (let i = 11; i >= 0; i--) {
    const from = new Date(Date.UTC(y, m - i, 1));
    const to = i === 0 ? now : new Date(Date.UTC(y, m - i + 1, 1) - 1000);
    spans.push({ from, to });
  }
  const body = spans.map((s, k) =>
    `m${k}: contributionsCollection(from:"${s.from.toISOString()}", to:"${s.to.toISOString()}"){ totalCommitContributions contributionCalendar{ totalContributions } }`).join('\n');
  const data = await gql(`query($login:String!){ user(login:$login){ ${body} } }`, { login: USER });
  return spans.map((s, k) => ({
    label: s.from.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
    contributions: data.user[`m${k}`].contributionCalendar.totalContributions,
    commits: data.user[`m${k}`].totalCommitContributions,
  }));
}

async function fetchDays(count = 30) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (count - 1)));
  const data = await gql(
    `query($login:String!,$from:DateTime!,$to:DateTime!){ user(login:$login){ contributionsCollection(from:$from, to:$to){
       contributionCalendar{ weeks{ contributionDays{ date contributionCount } } }
       commitContributionsByRepository(maxRepositories:100){ contributions(first:100){ nodes{ occurredAt commitCount } } } } } }`,
    { login: USER, from: start.toISOString(), to: now.toISOString() },
  );
  const cc = data.user.contributionsCollection;
  const perDay = new Map(), perDayCommits = new Map();
  for (const w of cc.contributionCalendar.weeks) for (const d of w.contributionDays) perDay.set(d.date, d.contributionCount);
  for (const repo of cc.commitContributionsByRepository)
    for (const n of repo.contributions.nodes) {
      const key = n.occurredAt.slice(0, 10);
      perDayCommits.set(key, (perDayCommits.get(key) ?? 0) + n.commitCount);
    }
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start.getTime() + i * 86400000), key = d.toISOString().slice(0, 10);
    return {
      label: d.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      contributions: perDay.get(key) ?? 0,
      commits: perDayCommits.get(key) ?? 0,
    };
  });
}

const mockLanguages = () => {
  const raw = [['JavaScript', '#f1e05a', 520], ['TypeScript', '#3178c6', 310], ['HTML', '#e34c26', 140], ['CSS', '#663399', 110], ['Python', '#3572A5', 60], ['SQL', '#e38c00', 30], ['Shell', '#89e051', 15], ['Dockerfile', '#384d54', 6]];
  const sum = raw.reduce((a, r) => a + r[2], 0);
  return raw.map(([name, color, bytes]) => ({ name, color, bytes, pct: (bytes / sum) * 100 }));
};
const mockMonths = () => ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'].map((label, i) => ({
  label, contributions: [12, 30, 22, 48, 70, 55, 92, 120, 88, 140, 110, 165][i], commits: [8, 20, 15, 34, 52, 40, 70, 96, 64, 108, 80, 128][i],
}));

const mockDays = () => {
  const r = rng(30);
  const base = new Date(Date.UTC(2026, 7, 23));
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(base.getTime() + i * 86400000);
    const c = Math.max(0, Math.round(4 + 6 * Math.sin(i / 3) + r() * 8 + (i > 22 ? 6 : 0)));
    return { label: d.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }), contributions: c, commits: Math.max(0, Math.round(c * (0.55 + r() * 0.25))) };
  });
};

// ── shared svg bits ─────────────────────────────────────────────────────────
const open = (w, h, label) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">\n<title>${esc(label)}</title>`;
const goldDefs = `<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.gold1}"/><stop offset=".45" stop-color="${C.gold2}"/><stop offset="1" stop-color="${C.gold3}"/></linearGradient>`;
const meanderDef = (id, color) => `<pattern id="${id}" width="26" height="14" patternUnits="userSpaceOnUse"><path d="M0 12 H4 V1.5 H22 V12 H26 M22 8.5 H9 V5 H18" fill="none" stroke="${color}" stroke-width="1.4"/></pattern>`;
const frame = (W, H, title, hint) => `
<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="14" fill="${C.bg1}" stroke="url(#gold)" stroke-width="1.6"/>
<text x="26" y="32" font-family="${SERIF}" font-size="15" font-weight="700" letter-spacing="4" fill="url(#gold)">${esc(title)}</text>
<text x="${W - 26}" y="32" text-anchor="end" font-family="${MONO}" font-size="11" letter-spacing="1.5" fill="${C.blue}">${esc(hint)}</text>
<rect x="26" y="37" width="${W - 52}" height="14" fill="url(#key)" opacity=".55"/>`;
const footer = (W, H, txt) => `<text x="${W - 26}" y="${H - 14}" text-anchor="end" font-family="${MONO}" font-size="10" letter-spacing="1" fill="${C.dim}">${esc(txt)}</text>`;

// ── radar ───────────────────────────────────────────────────────────────────
function radar(langs) {
  const W = 900, H = 440, cx = 250, cy = 250, R = 130;
  const pending = !langs;
  const axes = pending ? ['—', '—', '—', '—', '—', '—'] : langs.map((l) => l.name);
  const n = Math.max(axes.length, 3);
  const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i, f) => [Math.cos(ang(i)) * R * f, Math.sin(ang(i)) * R * f];
  const poly = (f) => Array.from({ length: n }, (_, i) => pt(i, f).map((v) => v.toFixed(1)).join(',')).join(' ');

  const rings = [0.25, 0.5, 0.75, 1].map((f) => `<polygon points="${poly(f)}" fill="none" stroke="${f === 1 ? C.gold3 : C.line}" stroke-width="${f === 1 ? 1.4 : 1}" ${f === 1 ? '' : 'stroke-dasharray="3 4"'}/>`).join('');
  const spokes = Array.from({ length: n }, (_, i) => `<line x1="0" y1="0" x2="${pt(i, 1)[0].toFixed(1)}" y2="${pt(i, 1)[1].toFixed(1)}" stroke="${C.line}" stroke-width="1"/>`).join('');
  const labels = axes.map((name, i) => {
    const [x, y] = pt(i, 1.2), c = Math.cos(ang(i));
    const anchor = Math.abs(c) < 0.25 ? 'middle' : c > 0 ? 'start' : 'end';
    return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${anchor}" font-family="${SANS}" font-size="13" font-weight="600" fill="${C.marble}">${esc(name)}</text>`;
  }).join('');

  let data = '', legend = '';
  if (!pending) {
    const max = Math.max(...langs.map((l) => l.bytes));
    const vals = langs.map((l) => Math.pow(l.bytes / max, 0.6));
    const points = vals.map((v, i) => pt(i, Math.max(v, 0.06)));
    data = `
    <g transform="translate(${cx} ${cy})">
      <g>
        <polygon points="${points.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="url(#radarFill)" stroke="${C.cyan}" stroke-width="2.2" stroke-linejoin="round"/>
        ${points.map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.6" fill="${langs[i].color}" stroke="${C.gold1}" stroke-width="1.6"/>`).join('')}
        <animateTransform attributeName="transform" type="scale" from="0.02" to="1" dur="1.6s" calcMode="spline" keyTimes="0;1" keySplines=".2 .8 .2 1" fill="freeze"/>
      </g>
    </g>`;
    const rowH = 38, y0 = 92, x0 = 520;
    legend = langs.map((l, i) => {
      const y = y0 + i * rowH, bw = Math.max(6, (l.bytes / max) * 250);
      return `
      <g transform="translate(${x0} ${y})">
        <circle cx="8" cy="8" r="6" fill="${l.color}" stroke="${C.gold1}" stroke-width="1"/>
        <text x="26" y="13" font-family="${SANS}" font-size="14" font-weight="600" fill="${C.marble}">${esc(l.name)}</text>
        <text x="350" y="13" text-anchor="end" font-family="${MONO}" font-size="13" fill="${C.gold1}">${l.pct.toFixed(1)}%</text>
        <rect x="26" y="20" width="324" height="6" rx="3" fill="${C.line}"/>
        <rect x="26" y="20" width="${bw.toFixed(0)}" height="6" rx="3" fill="url(#bar)" class="grow" style="animation-delay:${(i * 0.12).toFixed(2)}s"/>
      </g>`;
    }).join('');
  } else {
    legend = `<text x="530" y="200" font-family="${SERIF}" font-style="italic" font-size="20" fill="${C.marble}">The Oracle is reading the stars…</text>
    <text x="530" y="230" font-family="${MONO}" font-size="12" fill="${C.blue}">// run the “Forge Charts” workflow to fill this panel</text>`;
  }

  return `${open(W, H, pending ? 'Language radar (awaiting first run)' : `Language radar: ${langs.map((l) => l.name).join(', ')}`)}
<defs>
  ${goldDefs}${meanderDef('key', C.gold3)}
  <linearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.violet}" stop-opacity=".55"/><stop offset="1" stop-color="${C.cyan}" stop-opacity=".3"/></linearGradient>
  <linearGradient id="bar" x1="0" x2="1"><stop offset="0" stop-color="${C.gold3}"/><stop offset="1" stop-color="${C.gold1}"/></linearGradient>
  <radialGradient id="sweepG" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 0) scale(${R})"><stop offset="0" stop-color="${C.cyan}" stop-opacity=".0"/><stop offset="1" stop-color="${C.cyan}" stop-opacity=".22"/></radialGradient>
  <style>
    .grow{transform-box:fill-box;transform-origin:left center;animation:grow 1.4s cubic-bezier(.2,.8,.2,1) both}
    @keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
  </style>
</defs>
${frame(W, H, 'LANGUAGE RADAR', '// bytes across my repositories')}
<g transform="translate(${cx} ${cy})">
  ${rings}${spokes}
  <g>
    <path d="M0 0 L${R} 0 A${R} ${R} 0 0 0 ${(R * Math.cos(-0.55)).toFixed(1)} ${(R * Math.sin(-0.55)).toFixed(1)} Z" fill="url(#sweepG)"/>
    <line x1="0" y1="0" x2="${R}" y2="0" stroke="${C.cyan}" stroke-width="1.4" opacity=".7"/>
    <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="9s" repeatCount="indefinite"/>
  </g>
  <circle r="3.5" fill="${C.gold2}"/>
</g>
${data}
<g transform="translate(${cx} ${cy})">${labels}</g>
${legend}
${footer(W, H, pending ? 'awaiting first run' : `forged ${stamp} UTC · top ${langs.length} languages`)}
</svg>`;
}

// ── monotone-X spline (no overshoot below zero) ─────────────────────────────
function monotone(pts) {
  const n = pts.length;
  if (n < 2) return '';
  const dx = [], m = [], t = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${(pts[i][0] + h).toFixed(1)} ${(pts[i][1] + t[i] * h).toFixed(1)} ${(pts[i + 1][0] - h).toFixed(1)} ${(pts[i + 1][1] - t[i + 1] * h).toFixed(1)} ${pts[i + 1][0].toFixed(1)} ${pts[i + 1][1].toFixed(1)}`;
  }
  return d;
}
// top of the y-axis: 4 × a "nice" step, so every gridline lands on a whole number
const niceMax = (v) => {
  if (v <= 4) return 4;
  const raw = v / 4, p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 4, 5, 8, 10].map((m) => m * p).find((c) => c >= raw);
  return step * 4;
};

function spline(rows, o) {
  const W = 900, H = 400, L = 64, Rm = 34, T = 92, B = 56;
  const pending = !rows;
  const data = rows ?? Array.from({ length: o.n }, () => ({ label: '·', contributions: 0, commits: 0 }));
  const dense = data.length > 16;
  const top = niceMax(Math.max(...data.map((d) => d.contributions), 1));
  const pw = W - L - Rm, ph = H - T - B;
  const X = (i) => L + (i * pw) / (data.length - 1);
  const Y = (v) => T + ph - (v / top) * ph;
  const line = (key) => data.map((d, i) => [X(i), Y(d[key])]);
  const pC = line('contributions'), pK = line('commits');
  const dC = monotone(pC), dK = monotone(pK);
  const grid = [0, 1, 2, 3, 4].map((k) => {
    const y = T + (ph * k) / 4, v = Math.round(top - (top * k) / 4);
    return `<line x1="${L}" y1="${y}" x2="${W - Rm}" y2="${y}" stroke="${C.line}" stroke-dasharray="${k === 4 ? '0' : '3 5'}"/>
    <text x="${L - 12}" y="${y + 4}" text-anchor="end" font-family="${MONO}" font-size="11" fill="${C.dim}">${v}</text>`;
  }).join('');
  const xl = data.map((d, i) => (i % o.labelEvery === 0 || i === data.length - 1) && (i === data.length - 1 || data.length - 1 - i >= Math.ceil(o.labelEvery / 2) || i === 0) ? `<text x="${X(i).toFixed(1)}" y="${H - B + 24}" text-anchor="middle" font-family="${MONO}" font-size="11.5" fill="${C.dim}">${esc(d.label)}</text>` : '').join('');
  const totC = data.reduce((a, d) => a + d.contributions, 0), totK = data.reduce((a, d) => a + d.commits, 0);
  const peak = pC.reduce((b, p, i) => (data[i].contributions > data[b].contributions ? i : b), 0);

  const dots = pending ? '' : pC.map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${dense ? 2.9 : 4}" fill="${C.bg0}" stroke="${C.gold1}" stroke-width="${dense ? 1.6 : 2}" class="pt" style="animation-delay:${(0.9 + i * (dense ? 0.04 : 0.1)).toFixed(2)}s"/>`).join('')
    + pK.map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${dense ? 2.3 : 3.2}" fill="${C.bg0}" stroke="${C.cyan}" stroke-width="${dense ? 1.4 : 1.8}" class="pt" style="animation-delay:${(1.0 + i * (dense ? 0.04 : 0.1)).toFixed(2)}s"/>`).join('');
  const peakLabel = pending ? '' : `<g class="pt" style="animation-delay:2s"><rect x="${(pC[peak][0] - 24).toFixed(1)}" y="${(pC[peak][1] - 34).toFixed(1)}" width="48" height="22" rx="6" fill="${C.panel}" stroke="${C.gold2}"/>
    <text x="${pC[peak][0].toFixed(1)}" y="${(pC[peak][1] - 19).toFixed(1)}" text-anchor="middle" font-family="${MONO}" font-size="12" font-weight="700" fill="${C.gold1}">${data[peak].contributions}</text></g>`;

  return `${open(W, H, pending ? `${o.aria} (awaiting first run)` : `${o.aria}: ${totC} contributions, ${totK} commits`)}
<defs>
  ${goldDefs}${meanderDef('key', C.gold3)}
  <linearGradient id="areaC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.gold2}" stop-opacity=".42"/><stop offset="1" stop-color="${C.gold2}" stop-opacity="0"/></linearGradient>
  <linearGradient id="areaK" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.cyan}" stop-opacity=".28"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/></linearGradient>
  <linearGradient id="strokeC" x1="0" x2="1"><stop offset="0" stop-color="${C.gold3}"/><stop offset=".6" stop-color="${C.gold2}"/><stop offset="1" stop-color="${C.gold1}"/></linearGradient>
  <linearGradient id="strokeK" x1="0" x2="1"><stop offset="0" stop-color="${C.violet}"/><stop offset="1" stop-color="${C.cyan}"/></linearGradient>
  <style>
    .draw{stroke-dasharray:1;stroke-dashoffset:0;animation:draw 2.4s cubic-bezier(.3,.7,.2,1) both}
    .fade{animation:fade 2.2s ease-out both}
    .pt{animation:fade .6s ease-out both}
    @keyframes draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
    @keyframes fade{from{opacity:0}to{opacity:1}}
  </style>
</defs>
${frame(W, H, o.title, o.hint)}
<g transform="translate(26 64)" font-family="${SANS}" font-size="13">
  <rect y="2" width="22" height="4" rx="2" fill="url(#strokeC)"/><text x="32" y="9" fill="${C.marble}">Contributions${pending ? '' : ` <tspan fill="${C.gold1}" font-family="${MONO}">${totC}</tspan>`}</text>
  <rect x="${pending ? 150 : 210}" y="2" width="22" height="4" rx="2" fill="url(#strokeK)"/><text x="${(pending ? 150 : 210) + 32}" y="9" fill="${C.marble}">Commits${pending ? '' : ` <tspan fill="${C.cyan}" font-family="${MONO}">${totK}</tspan>`}</text>
</g>
${grid}${xl}
${pending ? `<text x="${W / 2}" y="${T + ph / 2 - 6}" text-anchor="middle" font-family="${SERIF}" font-style="italic" font-size="22" fill="${C.marble}">The Oracle is reading the stars…</text>
<text x="${W / 2}" y="${T + ph / 2 + 22}" text-anchor="middle" font-family="${MONO}" font-size="12" fill="${C.blue}">// run the “Forge Charts” workflow to fill this panel</text>` : `
<path d="${dC} L${X(data.length - 1).toFixed(1)} ${T + ph} L${X(0).toFixed(1)} ${T + ph} Z" fill="url(#areaC)" class="fade"/>
<path d="${dK} L${X(data.length - 1).toFixed(1)} ${T + ph} L${X(0).toFixed(1)} ${T + ph} Z" fill="url(#areaK)" class="fade"/>
<path d="${dK}" pathLength="1" fill="none" stroke="url(#strokeK)" stroke-width="2.6" stroke-linecap="round" class="draw" style="animation-delay:.25s"/>
<path d="${dC}" pathLength="1" fill="none" stroke="url(#strokeC)" stroke-width="3.2" stroke-linecap="round" class="draw"/>
${dots}${peakLabel}`}
${footer(W, H, pending ? 'awaiting first run' : `forged ${stamp} UTC · ${o.note}`)}
</svg>`;
}

// ── main ────────────────────────────────────────────────────────────────────
const write = (name, svg) => { fs.writeFileSync(path.join(OUT, name), svg.trim() + '\n'); console.log('  ✓', name); };

try {
  let langs = null, months = null, days = null;
  if (flag('--mock')) { langs = mockLanguages(); months = mockMonths(); days = mockDays(); }
  else if (!flag('--pending')) {
    if (!TOKEN) throw new Error('GH_TOKEN (or GITHUB_TOKEN) is required. Use --pending for placeholder panels.');
    [langs, months, days] = await Promise.all([fetchLanguages(), fetchMonths(), fetchDays(30)]);
  }
  write('radar-languages.svg', radar(langs));
  write('spline-contributions.svg', spline(months, { n: 12, labelEvery: 1, title: 'CONTRIBUTION SPLINE', hint: '// last 12 months', note: 'monthly monotone spline', aria: 'Contributions and commits over the last 12 months' }));
  write('spline-daily.svg', spline(days, { n: 30, labelEvery: 5, title: 'DAILY SPLINE', hint: '// last 30 days', note: 'daily monotone spline', aria: 'Daily contributions and commits over the last 30 days' }));
} catch (err) {
  console.error('✗ chart generation failed:', err.message);
  process.exit(1);
}
