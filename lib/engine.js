/* =====================================================================
   engine.js — pure tournament logic (no DOM, no globals).
   Loaded in the browser as window.GSB, and importable in Node tests via
   require("../lib/engine.js"). Keep this dependency-free and pure so it
   can be unit-tested in isolation.
   ===================================================================== */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.GSB = api;
})(this, function () {
  // round-robin order for a group of 4 (indices into the team list)
  const FIXTURES = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]];

  function outcome(s) {
    if (!s || s[0] === null || s[0] === undefined || s[1] === null || s[1] === undefined) return null;
    return s[0] > s[1] ? "home" : s[0] < s[1] ? "away" : "draw";
  }

  // allowExact=false for Win/Draw/Loss submissions (capped at 10).
  function scoreMatch(pred, actual, allowExact) {
    if (!actual || actual[0] == null || actual[1] == null) return { kind: "pending", pts: 0 };
    if (!pred || pred[0] == null || pred[1] == null) return { kind: "none", pts: 0 };
    if (allowExact && pred[0] === actual[0] && pred[1] === actual[1]) return { kind: "exact", pts: 50 };
    if (outcome(pred) === outcome(actual)) return { kind: "outcome", pts: 10 };
    return { kind: "miss", pts: 0 };
  }

  // Parse an openfootball date ("YYYY-MM-DD") + time ("HH:MM UTC±O") into a
  // UTC timestamp (ms), or null if unparseable. local = UTC + offset, so the
  // UTC hour = localHour - offset (e.g. 13:00 UTC-6 -> 19:00 UTC).
  function kickoffMs(d, t) {
    const dm = /(\d{4})-(\d{2})-(\d{2})/.exec(d || "");
    const tm = /(\d{1,2}):(\d{2})\s*UTC([+-]\d+)/.exec(t || "");
    if (!dm || !tm) return null;
    const offset = parseInt(tm[3], 10);
    return Date.UTC(+dm[1], +dm[2] - 1, +dm[3], parseInt(tm[1], 10) - offset, +tm[2]);
  }

  function blankStat(name) {
    return { name, pld: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
  }

  function computeStats(names, scores) {
    const stats = names.map((n, i) => ({ idx: i, ...blankStat(n) }));
    scores.forEach((score, m) => {
      const [hi, ai] = FIXTURES[m];
      const [hg, ag] = score;
      if (hg == null || ag == null) return;
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

  function headToHead(names, scores, tiedIdx) {
    const set = new Set(tiedIdx);
    const mini = {};
    tiedIdx.forEach((i) => (mini[i] = blankStat(names[i])));
    scores.forEach((score, m) => {
      const [hi, ai] = FIXTURES[m];
      const [hg, ag] = score;
      if (hg == null || ag == null) return;
      if (!set.has(hi) || !set.has(ai)) return;
      const h = mini[hi];
      const a = mini[ai];
      h.gf += hg; h.ga += ag; a.gf += ag; a.ga += hg;
      if (hg > ag) h.pts += 3;
      else if (hg < ag) a.pts += 3;
      else { h.pts++; a.pts++; }
    });
    Object.values(mini).forEach((s) => (s.gd = s.gf - s.ga));
    return mini;
  }

  // Sort a group's four teams with FIFA tiebreakers
  // (points > GD > GF > head-to-head > name).
  function rankGroup(names, scores) {
    const stats = computeStats(names, scores);
    return stats.slice().sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      const tied = stats
        .filter((s) => s.pts === a.pts && s.gd === a.gd && s.gf === a.gf)
        .map((s) => s.idx);
      if (tied.length > 1) {
        const h2h = headToHead(names, scores, tied);
        const ha = h2h[a.idx];
        const hb = h2h[b.idx];
        if (hb.pts !== ha.pts) return hb.pts - ha.pts;
        if (hb.gd !== ha.gd) return hb.gd - ha.gd;
        if (hb.gf !== ha.gf) return hb.gf - ha.gf;
      }
      return a.name.localeCompare(b.name);
    });
  }

  function cmpStats(a, b) {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.name.localeCompare(b.name);
  }

  return { FIXTURES, outcome, scoreMatch, kickoffMs, blankStat, computeStats, headToHead, rankGroup, cmpStats };
});
