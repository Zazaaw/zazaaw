// Generates assets/coding-{light,dark}.svg from WakaTime: total time, this week, a 7-day
// bar chart, and what the week was spent in (languages, editors, OS).
// Needs a WakaTime personal OAuth token (https://wakatime.com/oauth, scope read_stats) in the
// WAKATIME_ACCESS_TOKEN secret — WakaTime no longer accepts API keys for reading stats.
// Without the secret it exits quietly and the last card stays.
// Local: WAKATIME_ACCESS_TOKEN=waka_tok_… node .github/scripts/coding.mjs
import { writeFileSync, mkdirSync } from "node:fs";

const TOKEN = process.env.WAKATIME_ACCESS_TOKEN;
if (!TOKEN) {
  console.log("WAKATIME_ACCESS_TOKEN not set — keeping the existing coding card.");
  process.exit(0);
}
const auth = TOKEN.startsWith("waka_tok_") ? `Bearer ${TOKEN}` : `Basic ${Buffer.from(TOKEN).toString("base64")}`;
async function waka(path) {
  const r = await fetch(`https://wakatime.com/api/v1/users/current/${path}`, { headers: { Authorization: auth } });
  if (!r.ok) throw new Error(`WakaTime ${path} → ${r.status} ${(await r.text()).slice(0, 160)}`);
  return (await r.json()).data;
}
const [all, week, days] = await Promise.all([
  waka("all_time_since_today"),
  waka("stats/last_7_days"),
  waka("summaries?range=last_7_days"),
]);

// ── Numbers ──
const hm = (sec) => {
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};
const totalHours = Math.floor(all.total_seconds / 3600);
const since = all.range?.start_date;
const bars = days.map((d) => ({ date: d.range.date, sec: d.grand_total.total_seconds }));
const maxSec = Math.max(...bars.map((b) => b.sec), 1);
const bestBar = bars.reduce((a, b) => (b.sec > a.sec ? b : a), bars[0]);
const pick = (list, n) => (list ?? []).filter((x) => x.total_seconds > 0).slice(0, n).map((x) => ({ name: x.name, pct: x.percent }));
const GROUPS = [
  ["languages", pick(week.languages, 4)],
  ["editors", pick(week.editors, 2)],
  ["system", pick(week.operating_systems, 2).map((x) => ({ ...x, name: x.name === "Mac" ? "macOS" : x.name }))],
];

// ── Drawing ──
const W = 1200, H = 590, P = 56;
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";
const THEMES = {
  light: { card: "#ffffff", line: "#e6e6e6", fg: "#0a0a0a", muted: "#6e6e6e", track: "#f0f0f0", bar: "#0a0a0a", best: "#22c55e" },
  dark: { card: "#0d1117", line: "#262c36", fg: "#f5f5f5", muted: "#9198a1", track: "#1b222c", bar: "#e6edf3", best: "#22c55e" },
};
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const fmtDate = (iso, opts) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });

function build(t) {
  const headline =
    `<text x="${P}" y="98"><tspan style="font:italic 400 76px ${SERIF};fill:${t.fg}">${totalHours.toLocaleString("en-US")}</tspan><tspan style="font:italic 400 40px ${SERIF};fill:${t.fg}"> hrs</tspan></text>` +
    `<text x="${P + 2}" y="128" style="font:400 17px ${SANS};fill:${t.muted}">of tracked coding${since ? ` since ${fmtDate(since, { month: "long", year: "numeric" })}` : ""}</text>`;

  const stats = [
    [hm(week.total_seconds), "this week"],
    [hm(week.daily_average), "daily average"],
    [hm(bestBar.sec), `best day · ${fmtDate(bestBar.date, { weekday: "short" })}`],
  ];
  const SW = 170;
  const statSvg = stats
    .map(([v, l], i) => {
      const x = W - P - (stats.length - i) * SW + 30;
      return `<text x="${x}" y="80" style="font:700 30px ${SANS};fill:${t.fg};letter-spacing:-.5px">${esc(v)}</text><text x="${x}" y="104" style="font:400 14px ${SANS};fill:${t.muted}">${esc(l)}</text>`;
    })
    .join("");

  // 7-day bars (left half). The best day is the one green bar.
  const CX = P, CY = 190, CW = 560, CH = 230, BW = 52;
  const step = (CW - BW) / (bars.length - 1);
  const chart = bars
    .map((b, i) => {
      const h = Math.max(4, (b.sec / maxSec) * (CH - 40));
      const x = CX + i * step, y = CY + CH - h;
      const best = b === bestBar;
      return `<g class="bar" style="animation-delay:${(i * 0.06).toFixed(2)}s">
<rect x="${x.toFixed(1)}" y="${CY}" width="${BW}" height="${CH}" rx="10" fill="${t.track}"/>
<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${BW}" height="${h.toFixed(1)}" rx="10" fill="${best ? t.best : t.bar}" fill-opacity="${best ? 1 : 0.85}"/>
<text x="${(x + BW / 2).toFixed(1)}" y="${(y - 10).toFixed(1)}" text-anchor="middle" style="font:500 13px ${SANS};fill:${t.muted}">${b.sec >= 3600 ? `${(b.sec / 3600).toFixed(1)}h` : `${Math.round(b.sec / 60)}m`}</text>
<text x="${(x + BW / 2).toFixed(1)}" y="${CY + CH + 28}" text-anchor="middle" style="font:500 14px ${SANS};fill:${best ? t.fg : t.muted}">${fmtDate(b.date, { weekday: "short" })}</text>
</g>`;
    })
    .join("\n");

  // Breakdowns (right half).
  const RX = 690, RW = W - P - RX;
  let ry = CY + 4;
  const groups = GROUPS.map(([title, rows]) => {
    const head = `<text x="${RX}" y="${ry + 14}" style="font:italic 400 24px ${SERIF};fill:${t.fg}">${title}</text>`;
    ry += 34;
    const body = rows
      .map((r) => {
        const y = ry;
        ry += 26;
        const bw = 190;
        return `<text x="${RX}" y="${y + 13}" style="font:400 15px ${SANS};fill:${t.fg}">${esc(r.name)}</text>
<rect x="${RX + 150}" y="${y + 4}" width="${bw}" height="8" rx="4" fill="${t.track}"/>
<rect x="${RX + 150}" y="${y + 4}" width="${Math.max(3, (r.pct / 100) * bw).toFixed(1)}" height="8" rx="4" fill="${t.bar}" fill-opacity=".85"/>
<text x="${RX + RW}" y="${y + 13}" text-anchor="end" style="font:400 14px ${SANS};fill:${t.muted}">${Math.round(r.pct)}%</text>`;
      })
      .join("\n");
    ry += 14;
    return head + body;
  }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${totalHours} hours of tracked coding. This week ${hm(week.total_seconds)}, daily average ${hm(week.daily_average)}.`)}">
<title>Coding time (WakaTime)</title>
<style>
.bar{animation:up .5s cubic-bezier(.2,.8,.2,1) backwards}
@keyframes up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){*{animation:none!important}}
</style>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="26" fill="${t.card}" stroke="${t.line}" stroke-width="1.5"/>
${headline}
${statSvg}
${chart}
${groups}
<text x="${P}" y="${H - 40}" style="font:400 13px ${SANS};fill:${t.muted}">Last 7 days · via WakaTime</text>
</svg>
`;
}

mkdirSync(new URL("../../assets/", import.meta.url), { recursive: true });
for (const [name, t] of Object.entries(THEMES)) writeFileSync(new URL(`../../assets/coding-${name}.svg`, import.meta.url), build(t));
console.log(`coding cards written — ${totalHours} hrs total, ${hm(week.total_seconds)} this week`);
