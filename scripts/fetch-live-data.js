/* =====================================================================
   fetch-live-data.js — runs in GitHub Actions (Node 20) to refresh
   actual match results from openfootball/worldcup.json (no API key).

   Writes:
     - data/live-data.json  (machine-readable snapshot)
     - live-data.js         (browser-loadable: sets window.WC_LIVE)

   Group results are mapped into our group/fixture layout (the same
   ordering app.js uses), so the app's "Load actual results" button can
   apply them directly.
   ===================================================================== */

"use strict";

const fs = require("fs");
const path = require("path");
const WC = require("../data.js");

const SRC_URL =
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

/* openfootball team name -> our display name, where they differ. */
const NAME_MAP = {
  "Bosnia & Herzegovina": "Bosnia",
  "Cape Verde": "Cabo Verde",
  "Czech Republic": "Czechia",
  "Iran": "IR Iran",
  "Ivory Coast": "Côte d'Ivoire",
  "South Korea": "Korea Republic",
};

/* Must match FIXTURES in app.js. */
const FIX = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]];

const ROUND_CODE = {
  "Round of 32": "R32", "Round of 16": "R16", "Quarter-final": "QF",
  "Semi-final": "SF", "Match for third place": "TP", "Final": "F",
};

/* openfootball "ground" -> [stadium, country] (2026 host venues). */
const STADIUMS = {
  "Vancouver": ["BC Place", "Canada"],
  "Seattle": ["Lumen Field", "USA"],
  "San Francisco Bay Area (Santa Clara)": ["Levi's Stadium", "USA"],
  "Los Angeles (Inglewood)": ["SoFi Stadium", "USA"],
  "Guadalajara (Zapopan)": ["Estadio Akron", "Mexico"],
  "Mexico City": ["Estadio Azteca", "Mexico"],
  "Monterrey (Guadalupe)": ["Estadio BBVA", "Mexico"],
  "Houston": ["NRG Stadium", "USA"],
  "Dallas (Arlington)": ["AT&T Stadium", "USA"],
  "Kansas City": ["Arrowhead Stadium", "USA"],
  "Atlanta": ["Mercedes-Benz Stadium", "USA"],
  "Miami (Miami Gardens)": ["Hard Rock Stadium", "USA"],
  "Toronto": ["BMO Field", "Canada"],
  "Boston (Foxborough)": ["Gillette Stadium", "USA"],
  "Philadelphia": ["Lincoln Financial Field", "USA"],
  "New York/New Jersey (East Rutherford)": ["MetLife Stadium", "USA"],
};

function venue(ground) {
  if (!ground) return null;
  const city = ground.replace(/\s*\(.*\)$/, "");
  const s = STADIUMS[ground];
  return s ? `${s[0]} · ${city}, ${s[1]}` : city;
}

function build(src) {
  const groups = {};
  const idx = {};
  const results = {};
  for (const g of Object.keys(WC.groups)) {
    groups[g] = WC.groups[g].map((t) => t[0]);
    idx[g] = {};
    groups[g].forEach((n, i) => (idx[g][n] = i));
    results[g] = [null, null, null, null, null, null];
  }
  let filled = 0;
  for (const m of src.matches || []) {
    const grp = String(m.group || "");
    if (!grp.startsWith("Group")) continue;
    const g = grp.split(" ").pop();
    if (!groups[g]) continue;
    const t1 = NAME_MAP[m.team1] || m.team1;
    const t2 = NAME_MAP[m.team2] || m.team2;
    if (!(t1 in idx[g]) || !(t2 in idx[g])) {
      console.warn("unmapped team:", g, m.team1, "/", m.team2);
      continue;
    }
    const ft = m.score && m.score.ft;
    if (!ft) continue;
    const i1 = idx[g][t1];
    const i2 = idx[g][t2];
    const fi = FIX.findIndex(
      (p) => (p[0] === i1 && p[1] === i2) || (p[0] === i2 && p[1] === i1)
    );
    results[g][fi] =
      FIX[fi][0] === i1 && FIX[fi][1] === i2 ? [ft[0], ft[1]] : [ft[1], ft[0]];
    filled++;
  }

  const schedule = (src.matches || []).map((m) => {
    const grp = String(m.group || "");
    const ft = m.score && m.score.ft;
    return {
      n: m.num, d: m.date, t: m.time,
      s: grp.startsWith("Group") ? grp.split(" ").pop() : (ROUND_CODE[m.round] || "KO"),
      h: NAME_MAP[m.team1] || m.team1,
      a: NAME_MAP[m.team2] || m.team2,
      hg: ft ? ft[0] : null,
      ag: ft ? ft[1] : null,
      v: venue(m.ground),
    };
  });

  return { results, filled, schedule };
}

/* Actual knockout advancement: which teams won each knockout round.
   "Round of 32" winners reach R16, etc. Team names mapped to ours. */
function advancement(src) {
  const NEXT = {
    "Round of 32": "R16",
    "Round of 16": "QF",
    "Quarter-final": "SF",
    "Semi-final": "FINAL",
  };
  const adv = { R16: [], QF: [], SF: [], FINAL: [], champion: null };
  for (const m of src.matches || []) {
    const ft = m.score && m.score.ft;
    if (!ft) continue;
    const t1 = NAME_MAP[m.team1] || m.team1;
    const t2 = NAME_MAP[m.team2] || m.team2;
    let w = null;
    if (ft[0] > ft[1]) w = t1;
    else if (ft[1] > ft[0]) w = t2;
    else {
      const p = m.score.p; // penalties
      if (p) w = p[0] > p[1] ? t1 : p[1] > p[0] ? t2 : null;
    }
    if (!w) continue;
    if (m.round === "Final") adv.champion = w;
    else if (NEXT[m.round]) adv[NEXT[m.round]].push(w);
  }
  return adv;
}

async function main() {
  const res = await fetch(SRC_URL);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const src = await res.json();
  const { results, filled, schedule } = build(src);
  const advanced = advancement(src);

  const root = path.join(__dirname, "..");
  const jsonPath = path.join(root, "data", "live-data.json");

  // Only rewrite when the results actually change, so the timestamp alone
  // doesn't produce a commit on every scheduled run.
  let prev = null;
  try {
    prev = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  } catch (e) {
    /* no previous snapshot */
  }
  if (
    prev &&
    JSON.stringify(prev.results) === JSON.stringify(results) &&
    JSON.stringify(prev.advanced || {}) === JSON.stringify(advanced) &&
    JSON.stringify(prev.schedule || []) === JSON.stringify(schedule)
  ) {
    console.log(`No change (${filled} group results) — nothing to write.`);
    return;
  }

  const out = {
    source: "openfootball/worldcup.json (2026)",
    updated: new Date().toISOString(),
    results,
    advanced,
    schedule,
  };
  fs.mkdirSync(path.join(root, "data"), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2));
  fs.writeFileSync(
    path.join(root, "live-data.js"),
    "/* generated from openfootball/worldcup.json — refreshed by the Update live data Action */\n" +
      "window.WC_LIVE = " + JSON.stringify(out) + ";\n"
  );
  console.log(`Filled ${filled} group results from openfootball (files updated).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
