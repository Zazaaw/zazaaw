// Generates assets/activity-{light,dark}.svg — the last 12 months on GitHub: a big total,
// streaks, the contribution grid, and the languages of public repos.
// Runs daily from .github/workflows/activity.yml (public data; the built-in token is enough).
// Local: GITHUB_TOKEN=$(gh auth token) node .github/scripts/activity.mjs
import { writeFileSync, mkdirSync } from "node:fs";

const LOGIN = process.env.PROFILE_LOGIN || "Zazaaw";
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) throw new Error("GITHUB_TOKEN is required");

const query = `query($login:String!){
  user(login:$login){
    contributionsCollection{ contributionCalendar{ totalContributions weeks{ contributionDays{ date contributionCount contributionLevel } } } }
    repositories(ownerAffiliations:OWNER, isFork:false, privacy:PUBLIC, first:100){
      totalCount
      nodes{ languages(first:8, orderBy:{field:SIZE, direction:DESC}){ edges{ size node{ name color } } } }
    }
  }
}`;
const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { authorization: `bearer ${TOKEN}`, "content-type": "application/json", "user-agent": "profile-activity-card" },
  body: JSON.stringify({ query, variables: { login: LOGIN } }),
});
const json = await res.json();
if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors ?? json).slice(0, 400));
const user = json.data.user;

// ── Numbers ──
const cal = user.contributionsCollection.contributionCalendar;
const weeks = cal.weeks;
const days = weeks.flatMap((w) => w.contributionDays);
const today = days[days.length - 1];
let longest = 0, run = 0;
for (const d of days) { run = d.contributionCount > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
let current = 0;
for (let i = days.length - 1; i >= 0; i--) {
  if (days[i].contributionCount > 0) current++;
  else if (i === days.length - 1) continue; // nothing yet today — the streak is still alive
  else break;
}
const best = days.reduce((a, d) => (d.contributionCount > a.contributionCount ? d : a), days[0]);
const activeDays = days.filter((d) => d.contributionCount > 0).length;

// Every repo counts equally (each repo's mix normalised to 1), so one vendored C tree
// can't drown out everything else.
const share = new Map(), colour = new Map();
let counted = 0;
for (const r of user.repositories.nodes) {
  const total = r.languages.edges.reduce((a, e) => a + e.size, 0);
  if (!total) continue;
  counted++;
  for (const e of r.languages.edges) {
    share.set(e.node.name, (share.get(e.node.name) ?? 0) + e.size / total);
    if (e.node.color) colour.set(e.node.name, e.node.color);
  }
}
const langs = [...share.entries()].sort((a, b) => b[1] - a[1]);
const top = langs.slice(0, 5).map(([name, v]) => ({ name, pct: (v / (counted || 1)) * 100, color: colour.get(name) }));
const rest = 100 - top.reduce((a, l) => a + l.pct, 0);
if (rest > 0.5) top.push({ name: "Other", pct: rest, color: null });

// ── Drawing ──
const W = 1200, H = 470;
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";
const THEMES = {
  light: { card: "#ffffff", line: "#e6e6e6", fg: "#0a0a0a", muted: "#6e6e6e", levels: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"], other: "#d4d4d4" },
  dark: { card: "#0d1117", line: "#262c36", fg: "#f5f5f5", muted: "#9198a1", levels: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"], other: "#3d444d" },
};
const LEVEL = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
const fmt = (n) => n.toLocaleString("en-US");
const tgl = (iso, year = true) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" });
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

function build(t) {
  const P = 56;
  // Headline: the total, set like the site's headings (serif italic number + sans caption).
  const headline =
    `<text x="${P}" y="98" style="font:italic 400 76px ${SERIF};fill:${t.fg}">${fmt(cal.totalContributions)}</text>` +
    `<text x="${P + 2}" y="128" style="font:400 17px ${SANS};fill:${t.muted}">contributions in the last year</text>`;

  const stats = [
    [`${current}`, "day streak"],
    [`${longest}`, "longest streak"],
    [`${activeDays}`, "active days"],
    [`${best.contributionCount}`, `best day · ${tgl(best.date, false)}`],
  ];
  const SW = 150;
  const statSvg = stats
    .map(([v, l], i) => {
      const x = W - P - (stats.length - i) * SW + 20;
      return `<text x="${x}" y="80" style="font:700 30px ${SANS};fill:${t.fg};letter-spacing:-.5px">${esc(v)}</text><text x="${x}" y="104" style="font:400 14px ${SANS};fill:${t.muted}">${esc(l)}</text>`;
    })
    .join("");

  // Contribution grid, full width.
  const GAP = 4, CELL = Math.floor((W - P * 2 - GAP * (weeks.length - 1)) / weeks.length);
  const X0 = P + (W - P * 2 - (weeks.length * (CELL + GAP) - GAP)) / 2, Y0 = 170;
  const months = [];
  let last = "";
  const cols = weeks
    .map((w, wi) => {
      const x = X0 + wi * (CELL + GAP);
      const first = w.contributionDays[0].date;
      const m = new Date(`${first}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
      if (m !== last && first.slice(8) <= "07" && wi < weeks.length - 2) months.push(`<text x="${x}" y="${Y0 - 14}" style="font:400 13px ${SANS};fill:${t.muted}">${m}</text>`);
      if (m !== last) last = m;
      const cells = w.contributionDays
        .map((d) => {
          const y = Y0 + new Date(`${d.date}T00:00:00Z`).getUTCDay() * (CELL + GAP);
          return `<rect x="${x.toFixed(1)}" y="${y}" width="${CELL}" height="${CELL}" rx="3.5" fill="${t.levels[LEVEL[d.contributionLevel] ?? 0]}"><title>${d.contributionCount} on ${d.date}</title></rect>`;
        })
        .join("");
      return `<g class="col" style="animation-delay:${(wi * 0.012).toFixed(3)}s">${cells}</g>`;
    })
    .join("\n");
  const gridBottom = Y0 + 7 * (CELL + GAP) - GAP;

  // Languages: one rounded bar in GitHub's language colours, then a legend.
  const BY = gridBottom + 52, BW = W - P * 2;
  let bx = P;
  const segs = top
    .map((l) => {
      const w = (l.pct / 100) * BW;
      const s = `<rect x="${bx.toFixed(1)}" y="${BY}" width="${Math.max(1, w - 3).toFixed(1)}" height="10" rx="5" fill="${l.color ?? t.other}"/>`;
      bx += w;
      return s;
    })
    .join("");
  let lx = P;
  const legend = top
    .map((l) => {
      const p = `${l.pct.toFixed(l.pct < 10 ? 1 : 0)}%`;
      const g = `<circle cx="${lx + 5}" cy="${BY + 37}" r="5" fill="${l.color ?? t.other}"/><text x="${lx + 16}" y="${BY + 42}" style="font:400 15px ${SANS}"><tspan fill="${t.fg}">${esc(l.name)}</tspan><tspan fill="${t.muted}">  ${p}</tspan></text>`;
      lx += 52 + (l.name.length + p.length) * 8.4;
      return g;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${fmt(cal.totalContributions)} GitHub contributions in the last year, ${current}-day current streak, ${longest}-day longest streak, ${activeDays} active days.">
<title>GitHub activity — ${LOGIN}</title>
<style>
.col{animation:in .45s ease-out backwards}
@keyframes in{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion: reduce){*{animation:none!important}}
</style>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="26" fill="${t.card}" stroke="${t.line}" stroke-width="1.5"/>
${headline}
${statSvg}
${months.join("")}
${cols}
${segs}
${legend}
<text x="${W - P}" y="${BY + 42}" text-anchor="end" style="font:400 14px ${SANS};fill:${t.muted}">${user.repositories.totalCount} public repos · updated ${tgl(today.date)}</text>
</svg>
`;
}

mkdirSync(new URL("../../assets/", import.meta.url), { recursive: true });
for (const [name, t] of Object.entries(THEMES)) writeFileSync(new URL(`../../assets/activity-${name}.svg`, import.meta.url), build(t));
console.log(`activity cards written — ${cal.totalContributions} contributions, streak ${current}/${longest}, ${langs.length} languages`);
