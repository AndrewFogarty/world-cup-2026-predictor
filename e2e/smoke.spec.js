const { test, expect } = require("@playwright/test");

/* These tests drive the real page but stub the two *optional* scripts so they
   are deterministic and offline:
     - supabase-config.js  -> blank, so the app runs in local (no-account) mode
       (no network, no writes to a real leaderboard).
     - live-data.js        -> a controlled WC_LIVE, so results / kickoff times
       (and therefore match locking + grading) are fixed, not date-dependent.
   By default we also pre-set the "entered" flag so the title screen is skipped. */

const LOCAL_SUPABASE = 'window.SUPABASE_CONFIG={url:"",anonKey:""};';
const NO_LIVE =
  'window.WC_LIVE={results:{},schedule:[],advanced:{R16:[],QF:[],SF:[],FINAL:[],champion:null}};';

const liveScript = (live) =>
  "window.WC_LIVE=" +
  JSON.stringify({ advanced: { R16: [], QF: [], SF: [], FINAL: [], champion: null }, ...live }) +
  ";";

async function setup(page, opts = {}) {
  const { supabase = LOCAL_SUPABASE, live = NO_LIVE, entered = true, state = null } = opts;
  await page.route("**/supabase-config.js", (r) =>
    r.fulfill({ contentType: "application/javascript", body: supabase }));
  await page.route("**/live-data.js", (r) =>
    r.fulfill({ contentType: "application/javascript", body: live }));
  await page.addInitScript((cfg) => {
    if (cfg.entered) localStorage.setItem("wc2026-entered-v1", "1");
    if (cfg.state) localStorage.setItem("wc2026-predictor-v3", JSON.stringify(cfg.state));
  }, { entered, state });
}

test("loads, and a scoreline updates the standings", async ({ page }) => {
  await setup(page);
  await page.goto("/");
  await expect(page).toHaveTitle(/World Cup 2026/);

  const group = page.locator('.group-card[data-group="A"]');
  await group.locator(".goal").nth(0).fill("3");
  await group.locator(".goal").nth(1).fill("0");

  // top of the standings table should now show a team on 3 points
  await expect(group.locator("table.standings td.pts").first()).toHaveText("3");
});

test("submitting adds an entry to the local leaderboard", async ({ page }) => {
  await setup(page);
  await page.goto("/");
  await page.locator("#username").fill("e2e-bot");
  await page.locator("#submit-bracket").click();
  await expect(page.locator("#leaderboard-table")).toContainText("e2e-bot");
});

test("the title screen gates entry; 'continue without an email' enters the app", async ({ page }) => {
  await setup(page, { entered: false });
  await page.goto("/");

  const title = page.locator("#title-screen");
  await expect(title).toBeVisible();
  await expect(title.locator(".title-game")).toHaveText("The Beautiful Game");

  await page.locator("#title-username").fill("Guest");
  await page.locator("#title-guest").click();

  await expect(title).toBeHidden();
  await expect(page.locator('.group-card[data-group="A"]')).toBeVisible();
});

test("matches lock once their kickoff time has passed", async ({ page }) => {
  const live = liveScript({
    results: {},
    schedule: [
      // fixture 0 (Mexico v South Africa) kicked off in 2020 -> locked
      { s: "A", h: "Mexico", a: "South Africa", d: "2020-01-01", t: "12:00 UTC+0", hg: null, ag: null, v: "Past" },
      // fixture 2 (Mexico v Korea Republic) is in 2099 -> still open
      { s: "A", h: "Mexico", a: "Korea Republic", d: "2099-01-01", t: "12:00 UTC+0", hg: null, ag: null, v: "Future" },
    ],
  });
  await setup(page, { live });
  await page.goto("/");

  const group = page.locator('.group-card[data-group="A"]');
  await expect(group.locator('.match[data-match="0"]')).toHaveClass(/confirmed/);
  await expect(group.locator('.goal[data-match="0"]').first()).toBeDisabled();
  // a match that hasn't kicked off stays editable
  await expect(group.locator('.goal[data-match="2"]').first()).toBeEnabled();
});

test("grading: exact picks are neutral grey, result picks show green / red", async ({ page }) => {
  const live = liveScript({
    results: {
      A: [[2, 0], [2, 1], null, null, null, null],
      B: [[1, 1], null, null, null, null, null],
    },
  });
  const state = {
    mode: "score",
    scores: {
      // A m0 = exact (2-0 vs 2-0); A m1 = right result (1-0 vs 2-1 home win)
      A: [[2, 0], [1, 0], [null, null], [null, null], [null, null], [null, null]],
      // B m0 = wrong (2-0 home win vs 1-1 draw)
      B: [[2, 0], [null, null], [null, null], [null, null], [null, null], [null, null]],
    },
  };
  await setup(page, { live, state });
  await page.goto("/");

  const aM0 = page.locator('.match[data-group="A"][data-match="0"]');
  await expect(aM0).toHaveClass(/guess-none/); // exact -> neutral grey, no gold
  await expect(aM0).not.toHaveClass(/guess-exact/);
  await expect(page.locator('.match[data-group="A"][data-match="1"]')).toHaveClass(/guess-ok/);
  await expect(page.locator('.match[data-group="B"][data-match="0"]')).toHaveClass(/guess-miss/);
});
