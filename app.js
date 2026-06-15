/* =================================================================
   World Cup 2026 — Group Stage Predictor + Interactive Bracket
   Vanilla JS. Official draw (technical draw results) & official
   knockout structure. Enter scorelines -> live tables -> bracket.
   ================================================================= */

"use strict";

/* ---- Official groups (2026 draw). Playoff paths kept as slots.
   [display name, ISO-3166 alpha-2 for the flag; "" = playoff/TBD]   */
const DEFAULT_GROUPS = {
  A: [["Mexico", "MX"], ["South Africa", "ZA"], ["Korea Republic", "KR"], ["CZE/DEN/IRL/MKD", ""]],
  B: [["Canada", "CA"], ["BIH/ITA/NIR/WAL", ""], ["Qatar", "QA"], ["Switzerland", "CH"]],
  C: [["Brazil", "BR"], ["Morocco", "MA"], ["Haiti", "HT"], ["Scotland", "SCT"]],
  D: [["USA", "US"], ["Paraguay", "PY"], ["Australia", "AU"], ["KOS/ROU/SVK/TUR", ""]],
  E: [["Germany", "DE"], ["Curaçao", "CW"], ["Côte d'Ivoire", "CI"], ["Ecuador", "EC"]],
  F: [["Netherlands", "NL"], ["Japan", "JP"], ["ALB/POL/SWE/UKR", ""], ["Tunisia", "TN"]],
  G: [["Belgium", "BE"], ["Egypt", "EG"], ["IR Iran", "IR"], ["New Zealand", "NZ"]],
  H: [["Spain", "ES"], ["Cabo Verde", "CV"], ["Saudi Arabia", "SA"], ["Uruguay", "UY"]],
  I: [["France", "FR"], ["Senegal", "SN"], ["BOL/IRQ/SUR", ""], ["Norway", "NO"]],
  J: [["Argentina", "AR"], ["Algeria", "DZ"], ["Austria", "AT"], ["Jordan", "JO"]],
  K: [["Portugal", "PT"], ["COD/JAM/NCL", ""], ["Uzbekistan", "UZ"], ["Colombia", "CO"]],
  L: [["England", "ENG"], ["Croatia", "HR"], ["Ghana", "GH"], ["Panama", "PA"]],
};

const GROUP_LETTERS = Object.keys(DEFAULT_GROUPS);

/* Round-robin schedule for 4 teams (indices into the group's team list) */
const FIXTURES = [
  [0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2],
];

const STORAGE_KEY = "wc2026-predictor-v2";

/* ---- Official Round-of-32 pairings (FIFA match numbers 73–88).
   "1X"/"2X" = winner/runner-up of group X. "3:ABCDF" = a best
   third-placed team from one of the allowed groups.                 */
const R32 = {
  73: ["2A", "2B"],
  74: ["1E", "3:ABCDF"],
  75: ["1F", "2C"],
  76: ["1C", "2F"],
  77: ["1I", "3:CDFGH"],
  78: ["2E", "2I"],
  79: ["1A", "3:CEFHI"],
  80: ["1L", "3:EHIJK"],
  81: ["1D", "3:BEFIJ"],
  82: ["1G", "3:AEHIJ"],
  83: ["2K", "2L"],
  84: ["1H", "2J"],
  85: ["1B", "3:EFGIJ"],
  86: ["1J", "2H"],
  87: ["1K", "3:DEIJL"],
  88: ["2D", "2G"],
};

/* Winners of these matches feed forward (official bracket tree). */
const LATER = {
  89: [74, 77], 90: [73, 75], 91: [76, 78], 92: [79, 80],
  93: [83, 84], 94: [81, 82], 95: [86, 88], 96: [85, 87],
  97: [89, 90], 98: [93, 94], 99: [91, 92], 100: [95, 96],
  101: [97, 98], 102: [99, 100],
  104: [101, 102], // Final
};

/* Display order (top→bottom) so columns line up as a bracket. */
const ROUND_ORDER = {
  R32: [74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87],
  R16: [89, 90, 93, 94, 91, 92, 95, 96],
  QF: [97, 98, 99, 100],
  SF: [101, 102],
};

/* Third-place allocation slots: each R32 third-slot allows certain groups. */
const THIRD_SLOTS = [
  { m: 74, allow: "ABCDF" },
  { m: 77, allow: "CDFGH" },
  { m: 79, allow: "CEFHI" },
  { m: 80, allow: "EHIJK" },
  { m: 81, allow: "BEFIJ" },
  { m: 82, allow: "AEHIJ" },
  { m: 85, allow: "EFGIJ" },
  { m: 87, allow: "DEIJL" },
];

const ROUND_NAME = {
  R32: "Round of 32", R16: "Round of 16", QF: "Quarter-finals",
  SF: "Semi-finals", F: "Final", TP: "Third place",
};

/* Build the full bracket structure. */
const BRACKET = {};
for (const [id, pair] of Object.entries(R32)) {
  BRACKET[id] = { round: "R32", home: pair[0], away: pair[1] };
}
for (const [id, kids] of Object.entries(LATER)) {
  let round = "R16";
  const n = +id;
  if (n >= 97 && n <= 100) round = "QF";
  else if (n >= 101 && n <= 102) round = "SF";
  else if (n === 104) round = "F";
  BRACKET[id] = { round, home: { from: kids[0] }, away: { from: kids[1] } };
}
BRACKET[103] = { round: "TP", home: { loser: 101 }, away: { loser: 102 } };

/* ---- Application state ---- */
let state = { names: {}, scores: {}, bracket: {} };

/* ================= Persistence ================= */
function loadState() {
  const fresh = { names: {}, scores: {}, bracket: {} };
  for (const g of GROUP_LETTERS) {
    fresh.names[g] = DEFAULT_GROUPS[g].map((t) => t[0]);
    fresh.scores[g] = FIXTURES.map(() => [null, null]);
  }
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) {
      for (const g of GROUP_LETTERS) {
        if (saved.names && Array.isArray(saved.names[g]) && saved.names[g].length === 4) {
          fresh.names[g] = saved.names[g].map(String);
        }
        if (saved.scores && Array.isArray(saved.scores[g]) && saved.scores[g].length === 6) {
          fresh.scores[g] = saved.scores[g].map((m) => [normScore(m && m[0]), normScore(m && m[1])]);
        }
      }
      if (saved.bracket && typeof saved.bracket === "object") fresh.bracket = saved.bracket;
    }
  } catch (e) {
    /* ignore malformed storage */
  }
  state = fresh;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    /* storage may be unavailable — ignore */
  }
}

function normScore(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/* ================= Helpers ================= */
function flagEmoji(code) {
  if (code === "ENG") return "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}";
  if (code === "SCT") return "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}";
  if (!code || code.length !== 2) return "\u{26BD}";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function codeFor(group, idx) {
  return DEFAULT_GROUPS[group][idx][1];
}

function blankStat(name) {
  return { name, pld: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
}

function groupComplete(g) {
  return state.scores[g].every((m) => m[0] !== null && m[1] !== null);
}

function allGroupsComplete() {
  return GROUP_LETTERS.every(groupComplete);
}

function cmpStats(a, b) {
  if (b.pts !== a.pts) return b.pts - a.pts;
  if (b.gd !== a.gd) return b.gd - a.gd;
  if (b.gf !== a.gf) return b.gf - a.gf;
  return a.name.localeCompare(b.name);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/* ================= Standings engine ================= */
function computeStats(group) {
  const names = state.names[group];
  const scores = state.scores[group];
  const stats = names.map((n, i) => ({ idx: i, ...blankStat(n) }));
  scores.forEach((score, m) => {
    const [hi, ai] = FIXTURES[m];
    const [hg, ag] = score;
    if (hg === null || ag === null) return;
    const home = stats[hi];
    const away = stats[ai];
    home.pld++; away.pld++;
    home.gf += hg; home.ga += ag;
    away.gf += ag; away.ga += hg;
    if (hg > ag) { home.w++; home.pts += 3; away.l++; }
    else if (hg < ag) { away.w++; away.pts += 3; home.l++; }
    else { home.d++; away.d++; home.pts++; away.pts++; }
  });
  stats.forEach((s) => (s.gd = s.gf - s.ga));
  return stats;
}

function headToHead(group, tiedIdx) {
  const set = new Set(tiedIdx);
  const mini = {};
  tiedIdx.forEach((i) => (mini[i] = blankStat(state.names[group][i])));
  state.scores[group].forEach((score, m) => {
    const [hi, ai] = FIXTURES[m];
    const [hg, ag] = score;
    if (hg === null || ag === null) return;
    if (!set.has(hi) || !set.has(ai)) return;
    const h = mini[hi]; const a = mini[ai];
    h.gf += hg; h.ga += ag; a.gf += ag; a.ga += hg;
    if (hg > ag) h.pts += 3;
    else if (hg < ag) a.pts += 3;
    else { h.pts++; a.pts++; }
  });
  Object.values(mini).forEach((s) => (s.gd = s.gf - s.ga));
  return mini;
}

function rankGroup(group) {
  const stats = computeStats(group);
  return stats.slice().sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    const tied = stats
      .filter((s) => s.pts === a.pts && s.gd === a.gd && s.gf === a.gf)
      .map((s) => s.idx);
    if (tied.length > 1) {
      const h2h = headToHead(group, tied);
      const ha = h2h[a.idx]; const hb = h2h[b.idx];
      if (hb.pts !== ha.pts) return hb.pts - ha.pts;
      if (hb.gd !== ha.gd) return hb.gd - ha.gd;
      if (hb.gf !== ha.gf) return hb.gf - ha.gf;
    }
    return a.name.localeCompare(b.name);
  });
}

/* Ranked list of all 12 third-placed teams (top 8 advance). */
function rankedThirds() {
  return GROUP_LETTERS
    .map((g) => ({ group: g, ...rankGroup(g)[2] }))
    .sort(cmpStats);
}

/* Assign the 8 qualifying third-placed groups to compatible R32 slots
   via bipartite matching (each slot only permits certain groups).    */
function thirdAssignments() {
  const qualGroups = rankedThirds().slice(0, 8).map((t) => t.group);
  const slotTaken = new Array(THIRD_SLOTS.length).fill(null);
  function tryAssign(group, seen) {
    for (let si = 0; si < THIRD_SLOTS.length; si++) {
      if (!THIRD_SLOTS[si].allow.includes(group) || seen.has(si)) continue;
      seen.add(si);
      if (slotTaken[si] === null || tryAssign(slotTaken[si], seen)) {
        slotTaken[si] = group;
        return true;
      }
    }
    return false;
  }
  qualGroups.forEach((g) => tryAssign(g, new Set()));
  const out = {};
  THIRD_SLOTS.forEach((s, si) => { if (slotTaken[si]) out[s.m] = slotTaken[si]; });
  return out;
}

/* ================= Group rendering ================= */
const groupsEl = document.getElementById("groups");

function buildGroups() {
  groupsEl.innerHTML = "";
  for (const g of GROUP_LETTERS) {
    const card = document.createElement("section");
    card.className = "group-card";
    card.dataset.group = g;
    card.innerHTML = `<div class="group-head"><span class="group-tag">Group ${g}</span></div>`;

    const matches = document.createElement("div");
    matches.className = "matches";
    FIXTURES.forEach((fx, m) => {
      const [hi, ai] = fx;
      const row = document.createElement("div");
      row.className = "match";
      row.innerHTML = `
        <span class="team home">
          <span class="flag">${flagEmoji(codeFor(g, hi))}</span>
          <span class="tname" data-group="${g}" data-idx="${hi}" contenteditable="true" spellcheck="false"></span>
        </span>
        <span class="score">
          <input class="goal" type="number" min="0" max="99" inputmode="numeric" data-group="${g}" data-match="${m}" data-side="0" aria-label="${g} match ${m + 1} home goals" />
          <span class="dash">–</span>
          <input class="goal" type="number" min="0" max="99" inputmode="numeric" data-group="${g}" data-match="${m}" data-side="1" aria-label="${g} match ${m + 1} away goals" />
        </span>
        <span class="team away">
          <span class="tname" data-group="${g}" data-idx="${ai}" contenteditable="true" spellcheck="false"></span>
          <span class="flag">${flagEmoji(codeFor(g, ai))}</span>
        </span>`;
      matches.appendChild(row);
    });
    card.appendChild(matches);

    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    wrap.innerHTML = `
      <table class="standings">
        <thead><tr>
          <th class="col-pos">#</th><th class="col-team">Team</th>
          <th>Pld</th><th>W</th><th>D</th><th>L</th>
          <th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
        </tr></thead>
        <tbody></tbody>
      </table>`;
    card.appendChild(wrap);
    groupsEl.appendChild(card);
  }
}

function syncInputs() {
  document.querySelectorAll(".tname").forEach((el) => {
    el.textContent = state.names[el.dataset.group][+el.dataset.idx];
  });
  document.querySelectorAll(".goal").forEach((el) => {
    const v = state.scores[el.dataset.group][+el.dataset.match][+el.dataset.side];
    el.value = v === null ? "" : v;
  });
}

function renderGroup(group) {
  const ranked = rankGroup(group);
  const tbody = document.querySelector(`.group-card[data-group="${group}"] tbody`);
  tbody.innerHTML = "";
  ranked.forEach((s, pos) => {
    const tr = document.createElement("tr");
    tr.className = pos < 2 ? "qualified" : pos === 2 ? "third" : "";
    tr.innerHTML = `
      <td class="col-pos">${pos + 1}</td>
      <td class="col-team"><span class="flag">${flagEmoji(codeFor(group, s.idx))}</span><span>${escapeHtml(s.name)}</span></td>
      <td>${s.pld}</td><td>${s.w}</td><td>${s.d}</td><td>${s.l}</td>
      <td>${s.gf}</td><td>${s.ga}</td><td>${s.gd > 0 ? "+" + s.gd : s.gd}</td>
      <td class="pts">${s.pts}</td>`;
    tbody.appendChild(tr);
  });
}

function renderThirds() {
  const rows = rankedThirds();
  const tbody = document.querySelector("#thirds-table tbody");
  tbody.innerHTML = "";
  rows.forEach((s, pos) => {
    const tr = document.createElement("tr");
    tr.className = pos < 8 ? "qualified" : "eliminated";
    tr.innerHTML = `
      <td class="col-pos">${pos + 1}</td>
      <td class="col-team"><span class="flag">${flagEmoji(codeFor(s.group, s.idx))}</span><span>${escapeHtml(s.name)}</span></td>
      <td>${s.group}</td><td>${s.pld}</td>
      <td>${s.gd > 0 ? "+" + s.gd : s.gd}</td><td>${s.gf}</td>
      <td class="pts">${s.pts}</td>
      <td>${pos < 8 ? "✓ Advances" : "Out"}</td>`;
    tbody.appendChild(tr);
  });
}

/* ================= Bracket ================= */
const bracketEl = document.getElementById("bracket");
let thirdMap = {};

function slotInfo(group, pos) {
  const s = rankGroup(group)[pos];
  return { name: s.name, code: codeFor(group, s.idx) };
}

/* Resolve an R32 slot spec for a given match id. */
function resolveR32(matchId, spec) {
  if (spec[0] === "1") return { ...slotInfo(spec[1], 0), label: "1" + spec[1], known: groupComplete(spec[1]) };
  if (spec[0] === "2") return { ...slotInfo(spec[1], 1), label: "2" + spec[1], known: groupComplete(spec[1]) };
  // third-place slot
  const allow = spec.slice(2).split("").join("/");
  const g = thirdMap[matchId];
  const info = g ? slotInfo(g, 2) : { name: null, code: "" };
  return { ...info, label: "3rd " + allow, known: allGroupsComplete() && !!g };
}

function participant(matchId, side) {
  const m = BRACKET[matchId];
  const spec = side === "home" ? m.home : m.away;
  if (typeof spec === "string") return resolveR32(matchId, spec);
  if (spec.loser !== undefined) {
    const child = spec.loser;
    const w = state.bracket[child];
    if (!w) return { name: null, code: "", label: "Loser " + ROUND_NAME[BRACKET[child].round], known: false };
    return participant(child, w === "home" ? "away" : "home");
  }
  const child = spec.from;
  const w = state.bracket[child];
  if (!w) return { name: null, code: "", label: "Winner " + ROUND_NAME[BRACKET[child].round], known: false };
  return participant(child, w);
}

function winnerOf(matchId) {
  const w = state.bracket[matchId];
  return w ? participant(matchId, w) : null;
}

function rowHtml(id, side, p, selected) {
  const known = p.known && p.name;
  const label = known
    ? `<span class="bm-name">${escapeHtml(p.name)}</span>`
    : `<span class="bm-name ph">${escapeHtml(p.label || "—")}</span>`;
  const flag = known ? flagEmoji(p.code) : "•";
  return `<button class="bm-row ${selected ? "sel" : ""}" data-id="${id}" data-side="${side}" type="button">
      <span class="flag">${flag}</span>${label}
    </button>`;
}

function matchCard(id, extraClass) {
  const h = participant(id, "home");
  const a = participant(id, "away");
  const w = state.bracket[id];
  return `<div class="bm ${extraClass || ""}" data-id="${id}">
      ${rowHtml(id, "home", h, w === "home")}
      ${rowHtml(id, "away", a, w === "away")}
    </div>`;
}

function renderBracket() {
  thirdMap = thirdAssignments();
  const col = (title, ids, cls) =>
    `<div class="round ${cls || ""}"><h3 class="round-title">${title}</h3>
      <div class="round-body">${ids.map((id) => matchCard(id)).join("")}</div></div>`;

  const champ = winnerOf(104);
  const champHtml = champ && champ.known && champ.name
    ? `<div class="champion"><span class="trophy">🏆</span>
         <span class="champ-flag">${flagEmoji(champ.code)}</span>
         <span class="champ-name">${escapeHtml(champ.name)}</span>
         <span class="champ-label">Your champion</span></div>`
    : `<div class="champion empty"><span class="trophy">🏆</span><span class="champ-label">Pick winners to crown a champion</span></div>`;

  const finalCol = `<div class="round final-col">
      <h3 class="round-title">Final</h3>
      <div class="round-body">
        ${matchCard(104, "is-final")}
        ${champHtml}
        <div class="tp-block">
          <h4>Third-place match</h4>
          ${matchCard(103, "is-tp")}
        </div>
      </div>
    </div>`;

  bracketEl.innerHTML =
    col("Round of 32", ROUND_ORDER.R32) +
    col("Round of 16", ROUND_ORDER.R16) +
    col("Quarter-finals", ROUND_ORDER.QF) +
    col("Semi-finals", ROUND_ORDER.SF) +
    finalCol;
}

/* ================= Render all ================= */
function renderAll() {
  GROUP_LETTERS.forEach(renderGroup);
  renderThirds();
  renderBracket();
}

/* ================= Events ================= */
function onGoalInput(e) {
  const el = e.target;
  if (!el.classList.contains("goal")) return;
  state.scores[el.dataset.group][+el.dataset.match][+el.dataset.side] = normScore(el.value);
  renderAll();
  saveState();
}

function onNameEdit(e) {
  const el = e.target;
  if (!el.classList.contains("tname")) return;
  const g = el.dataset.group; const idx = +el.dataset.idx;
  state.names[g][idx] = el.textContent.trim() || DEFAULT_GROUPS[g][idx][0];
  renderAll();
  saveState();
}

function wireEvents() {
  groupsEl.addEventListener("input", onGoalInput);
  groupsEl.addEventListener("blur", onNameEdit, true);
  groupsEl.addEventListener("keydown", (e) => {
    if (e.target.classList.contains("tname") && e.key === "Enter") {
      e.preventDefault();
      e.target.blur();
    }
  });

  bracketEl.addEventListener("click", (e) => {
    const row = e.target.closest(".bm-row");
    if (!row) return;
    const id = +row.dataset.id;
    const side = row.dataset.side;
    state.bracket[id] = state.bracket[id] === side ? null : side;
    renderBracket();
    saveState();
  });

  document.getElementById("reset").addEventListener("click", () => {
    if (!confirm("Clear all predicted scores and bracket picks?")) return;
    for (const g of GROUP_LETTERS) state.scores[g] = FIXTURES.map(() => [null, null]);
    state.bracket = {};
    syncInputs();
    renderAll();
    saveState();
  });

  document.getElementById("randomize").addEventListener("click", () => {
    for (const g of GROUP_LETTERS) {
      state.scores[g] = FIXTURES.map(() => [
        Math.floor(Math.random() * 4),
        Math.floor(Math.random() * 4),
      ]);
    }
    state.bracket = {};
    syncInputs();
    renderAll();
    saveState();
  });
}

/* ================= Init ================= */
loadState();
buildGroups();
syncInputs();
wireEvents();
renderAll();
