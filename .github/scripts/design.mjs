// Generates every static picture in the profile README, in light + dark:
//   assets/header-*.svg      — headline; only the rotating word decrypts (like p441z.my.id)
//   assets/h-<slug>-*.svg    — section titles: sans + serif italic
//   assets/work-<slug>-*.svg — project cards (cover embedded, GitHub can't load external images in SVG)
//   assets/toolkit-*.svg     — code / design / shoot
//   assets/hello-*.svg       — closing card
// Source images live in .github/design/. Run: node .github/scripts/design.mjs
// GitHub shows SVG as <img>: no JS, no web fonts — system fonts only, CSS keyframes for motion.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const OUT = new URL("../../assets/", import.meta.url);
const SRC = new URL("../design/", import.meta.url);
mkdirSync(OUT, { recursive: true });

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// Neutral, like the site. Green appears only in the decrypt block.
const THEMES = {
  light: { card: "#ffffff", soft: "#f6f6f6", line: "#e6e6e6", fg: "#0a0a0a", muted: "#6e6e6e", faint: "#a3a3a3", green: "#22c55e", pill: "#f2f2f2" },
  dark: { card: "#0d1117", soft: "#141a22", line: "#262c36", fg: "#f5f5f5", muted: "#9198a1", faint: "#5b636e", green: "#22c55e", pill: "#1b222c" },
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const img64 = (file) => `data:image/jpeg;base64,${readFileSync(new URL(file, SRC)).toString("base64")}`;
const write = (name, theme, svg) => writeFileSync(new URL(`${name}-${theme}.svg`, OUT), svg);

/** Rough word wrap for SVG text (no native wrapping). `cw` = average glyph width in px. */
function wrap(text, maxPx, cw) {
  const lines = [];
  let line = "";
  for (const w of text.split(" ")) {
    const next = line ? `${line} ${w}` : w;
    if (next.length * cw > maxPx && line) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// ─────────────────────────────────────────────────────────── header
const WORDS = ["design", "code", "shoot", "ship"];
const SLOT = 3, STEP = 0.09, CYCLE = WORDS.length * SLOT;
const NOISE = "!<>-_\\/[]{}=+*^?#%&$@";
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pct = (t) => `${((t / CYCLE) * 100).toFixed(3)}%`;
function windowKf(name, a, b) {
  const e = 0.001, p = [`0%{opacity:0}`];
  if (a > 0) p.push(`${pct(a - e)}{opacity:0}`);
  p.push(`${pct(a)}{opacity:1}`, `${pct(Math.min(CYCLE, b) - e)}{opacity:1}`);
  if (b < CYCLE) p.push(`${pct(b)}{opacity:0}`, `100%{opacity:0}`); else p.push(`100%{opacity:1}`);
  return `@keyframes ${name}{${p.join("")}}`;
}

function header(t) {
  const W = 1200, H = 440;
  seed = 7;
  const kf = [], frames = [];
  const lineY = 262;
  const spacer = `<tspan class="h1" fill-opacity="0">and I </tspan>`;
  const block = `<tspan class="blk">█</tspan>`;
  const line = (inner) => `<text x="72" y="${lineY}">${spacer}${inner}</text>`;
  WORDS.forEach((word, wi) => {
    const t0 = wi * SLOT, n = word.length;
    for (let k = 0; k < n; k++) {
      const name = `w${wi}f${k}`;
      kf.push([name, windowKf(name, t0 + k * STEP, t0 + (k + 1) * STEP)]);
      const noise = Array.from({ length: n - k - 1 }, () => NOISE[Math.floor(rnd() * NOISE.length)]).join("");
      frames.push(`<g class="${name}">${line(`<tspan class="word">${esc(word.slice(0, k))}</tspan>${block}<tspan class="word noise">${esc(noise)}</tspan>`)}</g>`);
    }
    const tail = `w${wi}t`, hold = `w${wi}h`;
    kf.push([tail, windowKf(tail, t0 + n * STEP, t0 + n * STEP + 0.35)]);
    frames.push(`<g class="${tail}">${line(`<tspan class="word">${esc(word)}</tspan>${block}`)}</g>`);
    kf.push([hold, windowKf(hold, t0 + n * STEP + 0.35, t0 + SLOT)]);
    frames.push(`<g class="${hold}">${line(`<tspan class="word">${esc(word)}</tspan>`)}</g>`);
  });
  const css = kf.map(([, k]) => k).concat(kf.map(([n]) => `.${n}{opacity:0;animation:${n} ${CYCLE}s linear infinite}`));

  // Photo: portrait crop on the right, positioned so both the drone and the shirt show.
  const PX = 838, PY = 36, PW = 326, PH = H - 72;
  const imgH = PW * (1067 / 600);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Faiz Hazim Hawari (p441z). I build for the web, and I design, code, shoot, and ship.">
<title>Faiz Hazim Hawari — p441z</title>
<style>
${css.join("\n")}
.w0h{opacity:1}
.h1{font:700 60px ${SANS};fill:${t.fg};letter-spacing:-1.8px}
.word{font:italic 400 70px ${SERIF};fill:${t.fg};letter-spacing:-.5px}
.noise{fill:${t.muted};fill-opacity:.55}
.blk{font:400 54px ${MONO};fill:${t.green}}
.name{font:600 17px ${SANS};fill:${t.fg}}
.handle{font:400 17px ${SANS};fill:${t.muted}}
.sub{font:400 21px ${SANS};fill:${t.muted}}
.meta{font:500 15px ${SANS};fill:${t.muted}}
.dot{animation:pulse 2.4s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
@media (prefers-reduced-motion: reduce){*{animation:none!important}g[class^="w"]{opacity:0!important}.w0h{opacity:1!important}}
</style>
<defs><clipPath id="ph"><rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="22"/></clipPath></defs>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="26" fill="${t.card}" stroke="${t.line}" stroke-width="1.5"/>
<text x="72" y="104"><tspan class="name">Faiz Hazim Hawari</tspan><tspan class="handle">  ·  p441z</tspan></text>
<text x="72" y="190" class="h1">I build for the web —</text>
<text x="72" y="${lineY}" class="h1">and I</text>
${frames.join("\n")}
<text x="72" y="326" class="sub">Fullstack developer &amp; designer. I code, design, and shoot.</text>
<circle class="dot" cx="78" cy="377" r="5" fill="${t.green}"/>
<text x="94" y="382" class="meta">Based in Indonesia  ·  p441z.my.id</text>
<g clip-path="url(#ph)"><image x="${PX}" y="${PY - 96}" width="${PW}" height="${imgH.toFixed(0)}" preserveAspectRatio="none" href="${img64("drone.jpg")}"/></g>
<rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="22" fill="none" stroke="${t.line}"/>
</svg>
`;
}

// ─────────────────────────────────────────────────────────── section titles
const HEADINGS = [
  ["work", "Selected", "work", "Things I designed and built end to end"],
  ["github", "Lately on", "GitHub", "Refreshed every morning"],
  ["coding", "Time at the", "keyboard", "WakaTime, refreshed every morning"],
  ["toolkit", "What I", "work with", "Code, design, and the camera"],
  ["gear", "On my", "desk", "What I build, shoot, and fly with"],
];
function heading(t, [, a, b, note]) {
  const W = 1200, H = 96;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${a} ${b}`)}">
<title>${esc(`${a} ${b}`)}</title>
<text x="0" y="60"><tspan style="font:700 40px ${SANS};fill:${t.fg};letter-spacing:-1px">${esc(a)} </tspan><tspan style="font:italic 400 46px ${SERIF};fill:${t.fg}">${esc(b)}</tspan></text>
<text x="${W}" y="58" text-anchor="end" style="font:400 17px ${SANS};fill:${t.muted}">${esc(note)}</text>
<path d="M0 ${H - 6}H${W}" stroke="${t.line}" stroke-width="1.5"/>
</svg>
`;
}

// ─────────────────────────────────────────────────────────── project cards
const WORK = [
  { slug: "style-kit", n: "01", name: "p441z Style Kit", year: "2026", desc: "A quiet design system for React + Tailwind: components, spring motion, and skills that keep AI agents from shipping slop.", tags: ["Design system", "Next.js", "Motion"], open: true },
  { slug: "absenin", n: "02", name: "Absenin", year: "2026", desc: "A Chrome extension that makes sure MagangHub interns never miss their daily report. One line in, three report fields out.", tags: ["Chrome extension", "Next.js", "Supabase"], open: true },
  { slug: "purebloodmd", n: "03", name: "PureBloodMD", year: "2026", desc: "A parody dating app where doctors only match doctors, with a real engine underneath: realtime chat, verification, safety tools.", tags: ["PWA", "Realtime", "Supabase"], open: true },
  { slug: "jamaah", n: "04", name: "Jamaah.net", year: "2025", desc: "A mosque-centred platform where congregations connect, help each other, and do business together.", tags: ["Mobile", "Product design", "Community"], open: false },
];
function card(t, w) {
  const W = 600, H = 560, CH = 268, P = 30;
  const lines = wrap(w.desc, W - P * 2, 9.6).slice(0, 3);
  let tx = P;
  const pills = w.tags
    .map((g) => {
      const pw = g.length * 8.4 + 26;
      const s = `<rect x="${tx}" y="${H - 72}" width="${pw}" height="32" rx="16" fill="${t.pill}"/><text x="${tx + pw / 2}" y="${H - 51}" text-anchor="middle" style="font:500 14px ${SANS};fill:${t.muted}">${esc(g)}</text>`;
      tx += pw + 8;
      return s;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${w.name}: ${w.desc}`)}">
<title>${esc(w.name)}</title>
<defs><clipPath id="c"><path d="M1 22a21 21 0 0 1 21-21h${W - 44}a21 21 0 0 1 21 21v${CH - 21}H1z"/></clipPath></defs>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="22" fill="${t.card}" stroke="${t.line}" stroke-width="1.5"/>
<image x="1" y="1" width="${W - 2}" height="${CH}" clip-path="url(#c)" preserveAspectRatio="xMidYMid slice" href="${img64(`${w.slug}.jpg`)}"/>
<path d="M1 ${CH + 1}H${W - 1}" stroke="${t.line}"/>
<text x="${P}" y="${CH + 52}" style="font:500 15px ${SANS};fill:${t.faint}">${w.n}  ·  ${w.year}${w.open ? "  ·  open source" : ""}</text>
<text x="${P}" y="${CH + 94}" style="font:700 32px ${SANS};fill:${t.fg};letter-spacing:-.6px">${esc(w.name)}</text>
<text x="${W - P}" y="${CH + 94}" text-anchor="end" style="font:400 30px ${SANS};fill:${t.muted}">↗</text>
${lines.map((l, i) => `<text x="${P}" y="${CH + 132 + i * 27}" style="font:400 18px ${SANS};fill:${t.muted}">${esc(l)}</text>`).join("\n")}
${pills}
</svg>
`;
}

// ─────────────────────────────────────────────────────────── toolkit
const TOOLKIT = [
  ["code", ["TypeScript & JavaScript", "Next.js & React", "Node.js · Go · Laravel", "Supabase & PostgreSQL", "Flutter & Dart", "Docker & Linux"]],
  ["design", ["Figma", "Design systems", "Motion & micro-interactions", "Brand identity", "Typography & layout"]],
  ["shoot", ["Event & graduation photos", "Aerial footage", "Short-form video", "Colour grading", "Visual storytelling"]],
];
function toolkit(t) {
  const W = 1200, H = 330, CW = W / 3;
  const cols = TOOLKIT.map(([title, items], i) => {
    const x = i * CW + (i ? 36 : 0);
    const sep = i ? `<path d="M${i * CW} 18V${H - 18}" stroke="${t.line}" stroke-width="1.5"/>` : "";
    return `${sep}<text x="${x}" y="52" style="font:italic 400 40px ${SERIF};fill:${t.fg}">${title}</text>
${items.map((it, j) => `<text x="${x}" y="${104 + j * 36}" style="font:400 19px ${SANS};fill:${t.muted}">${esc(it)}</text>`).join("\n")}`;
  }).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Toolkit — code: ${esc(TOOLKIT[0][1].join(", "))}; design: ${esc(TOOLKIT[1][1].join(", "))}; shoot: ${esc(TOOLKIT[2][1].join(", "))}.">
<title>Toolkit</title>
${cols}
</svg>
`;
}


// ─────────────────────────────────────────────────────────── gear (same list as p441z.my.id/gear)
const GEAR = [
  ["daily drivers", [
    ['MacBook Pro 14" M4', "Apple M4 · 16 GB · where most code gets written"],
    ["ROG Strix Scar G15", "i7-12700H · RTX 3070 Ti · builds, renders, games"],
  ]],
  ["cameras & air", [
    ["Sony A7R Mark II", "42 MP full-frame · cinematic shoots"],
    ["Canon EOS 700D + 70–300mm", "Candids from a distance"],
    ["50mm f/1.8 prime", "For that cinematic bokeh"],
    ["DJI Mini 2 SE + RC", "249 g · 2.7K aerials"],
  ]],
  ["desk", [
    ['Skyworth 27" 2K 180 Hz', "Primary monitor"],
    ['Xiaomi G24i 24" 200 Hz', "Second monitor, in portrait"],
    ["Custom mechanical keyboard", "Typing UI code until sunrise"],
    ["Fantech EOS PRO II S", "For when a bug wins"],
  ]],
];
function gear(t) {
  const W = 1200, PH = 560, H = 920, CW = W / 3;
  const cols = GEAR.map(([title, items], i) => {
    const x = i * CW + (i ? 36 : 40);
    const sep = i ? `<path d="M${i * CW} ${PH + 40}V${H - 34}" stroke="${t.line}" stroke-width="1.5"/>` : "";
    return `${sep}<text x="${x}" y="${PH + 74}" style="font:italic 400 34px ${SERIF};fill:${t.fg}">${esc(title)}</text>
${items.map(([n, d], j) => `<text x="${x}" y="${PH + 122 + j * 58}" style="font:600 18px ${SANS};fill:${t.fg}">${esc(n)}</text><text x="${x}" y="${PH + 145 + j * 58}" style="font:400 15px ${SANS};fill:${t.muted}">${esc(d)}</text>`).join("\n")}`;
  }).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="My gear: ${esc(GEAR.flatMap(([, it]) => it.map(([n]) => n)).join(", "))}.">
<title>Gear</title>
<defs><clipPath id="g"><path d="M1 26a25 25 0 0 1 25-25h${W - 52}a25 25 0 0 1 25 25v${PH - 25}H1z"/></clipPath></defs>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="26" fill="${t.card}" stroke="${t.line}" stroke-width="1.5"/>
<image x="1" y="1" width="${W - 2}" height="${PH}" clip-path="url(#g)" preserveAspectRatio="xMidYMid slice" href="${img64("gear.jpg")}"/>
<path d="M1 ${PH + 1}H${W - 1}" stroke="${t.line}"/>
${cols}
</svg>
`;
}

// ─────────────────────────────────────────────────────────── closing card
function hello(t) {
  const W = 1200, H = 300;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Have something worth building? Say hi at p441z.my.id.">
<title>Say hi</title>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="26" fill="${t.soft}" stroke="${t.line}" stroke-width="1.5"/>
<text x="72" y="128" style="font:700 54px ${SANS};fill:${t.fg};letter-spacing:-1.5px">Have something</text>
<text x="72" y="196"><tspan style="font:700 54px ${SANS};fill:${t.fg};letter-spacing:-1.5px">worth </tspan><tspan style="font:italic 400 62px ${SERIF};fill:${t.fg}">building?</tspan></text>
<text x="${W - 72}" y="128" text-anchor="end" style="font:400 19px ${SANS};fill:${t.muted}">Say hi at</text>
<text x="${W - 72}" y="166" text-anchor="end" style="font:600 26px ${SANS};fill:${t.fg}">p441z.my.id ↗</text>
<text x="${W - 72}" y="200" text-anchor="end" style="font:400 18px ${SANS};fill:${t.muted}">faizandhilmi@gmail.com</text>
</svg>
`;
}

for (const [name, t] of Object.entries(THEMES)) {
  write("header", name, header(t));
  for (const h of HEADINGS) write(`h-${h[0]}`, name, heading(t, h));
  for (const w of WORK) write(`work-${w.slug}`, name, card(t, w));
  write("toolkit", name, toolkit(t));
  write("gear", name, gear(t));
  write("hello", name, hello(t));
}
console.log("design assets written");
