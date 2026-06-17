"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const GSB = require("../lib/engine.js");

test("outcome()", () => {
  assert.equal(GSB.outcome([2, 1]), "home");
  assert.equal(GSB.outcome([0, 0]), "draw");
  assert.equal(GSB.outcome([1, 3]), "away");
  assert.equal(GSB.outcome([null, null]), null);
  assert.equal(GSB.outcome(null), null);
});

test("scoreMatch() — exact / outcome / miss / pending / none", () => {
  assert.equal(GSB.scoreMatch([2, 1], [2, 1], true).pts, 50); // exact
  assert.equal(GSB.scoreMatch([3, 1], [2, 0], true).pts, 10); // right result, wrong score
  assert.equal(GSB.scoreMatch([0, 1], [2, 0], true).pts, 0); // wrong result
  assert.equal(GSB.scoreMatch([1, 0], [null, null], true).kind, "pending"); // not played
  assert.equal(GSB.scoreMatch([null, null], [1, 0], true).kind, "none"); // no prediction
});

test("scoreMatch() — Win/Draw/Loss mode caps at 10 (no exact bonus)", () => {
  // allowExact = false: even a matching scoreline only earns the outcome points
  assert.equal(GSB.scoreMatch([1, 0], [1, 0], false).pts, 10);
  assert.equal(GSB.scoreMatch([1, 0], [3, 1], false).pts, 10);
  assert.equal(GSB.scoreMatch([1, 0], [0, 2], false).pts, 0);
});

test("kickoffMs() — parses date + UTC-offset time into a UTC timestamp", () => {
  // 13:00 in UTC-6 == 19:00 UTC the same day.
  assert.equal(GSB.kickoffMs("2026-06-11", "13:00 UTC-6"), Date.UTC(2026, 5, 11, 19, 0));
  // 20:00 in UTC-6 rolls into 02:00 UTC the next day.
  assert.equal(GSB.kickoffMs("2026-06-17", "20:00 UTC-6"), Date.UTC(2026, 5, 18, 2, 0));
  // Positive offset: 18:00 in UTC+2 == 16:00 UTC.
  assert.equal(GSB.kickoffMs("2026-07-19", "18:00 UTC+2"), Date.UTC(2026, 6, 19, 16, 0));
});

test("kickoffMs() — returns null for missing or malformed input", () => {
  assert.equal(GSB.kickoffMs(null, "13:00 UTC-6"), null);
  assert.equal(GSB.kickoffMs("2026-06-11", null), null);
  assert.equal(GSB.kickoffMs("2026-06-11", "TBD"), null);
  assert.equal(GSB.kickoffMs("", ""), null);
});

test("computeStats() — points and goal aggregates", () => {
  // A beats B 2-0 (fixture 0). Others unplayed.
  const stats = GSB.computeStats(["A", "B", "C", "D"], [[2, 0], [null, null], [null, null], [null, null], [null, null], [null, null]]);
  const A = stats.find((s) => s.name === "A");
  const B = stats.find((s) => s.name === "B");
  assert.deepEqual([A.pts, A.w, A.gf, A.ga, A.gd], [3, 1, 2, 0, 2]);
  assert.deepEqual([B.pts, B.l, B.gf, B.ga, B.gd], [0, 1, 0, 2, -2]);
});

test("rankGroup() — sorts by points then GD/GF", () => {
  // D has the most points; C the fewest.
  const scores = [[1, 0], [0, 0], [0, 0], [1, 1], [1, 2], [1, 0]];
  const ranked = GSB.rankGroup(["A", "B", "C", "D"], scores);
  assert.equal(ranked[0].name, "D"); // 5 pts
  assert.equal(ranked[3].name, "C"); // 2 pts
});

test("rankGroup() — head-to-head breaks an exact tie", () => {
  // A and B finish level on pts(4)/GD(0)/GF(2); A beat B head-to-head -> A ranks higher.
  const scores = [[1, 0], [0, 0], [0, 0], [1, 1], [1, 2], [1, 0]];
  const ranked = GSB.rankGroup(["A", "B", "C", "D"], scores);
  const ai = ranked.findIndex((s) => s.name === "A");
  const bi = ranked.findIndex((s) => s.name === "B");
  assert.ok(ai < bi, "A should rank above B via head-to-head");
});
