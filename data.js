/* =====================================================================
   data.js — Tournament data for the World Cup 2026 Predictor.

   THIS is the file to edit to keep things current. app.js reads the
   global `WC` object defined here. It is loaded with a plain <script>
   BEFORE app.js, so there is no fetch() and it works when you just
   open index.html locally (file://) as well as when hosted.

   Each team is [display name, flag code]:
     - flag code = ISO 3166-1 alpha-2 (e.g. "MX", "SE"), case-insensitive,
       resolved to a crisp SVG flag from flagcdn.
     - special cases: "ENG" -> England flag, "SCT" -> Scotland flag.
     - unknown/blank code -> a neutral ball placeholder.

   To update a lineup, just change a name and/or code below.
   (Bracket structure and standings logic stay in app.js — they don't
   change year to year.)
   ===================================================================== */

const WC = {
  // 12 groups (A–L), 4 teams each — the official 2026 draw with the
  // European/intercontinental playoff winners filled in.
  groups: {
    A: [["Mexico", "MX"], ["South Africa", "ZA"], ["Korea Republic", "KR"], ["Czechia", "CZ"]],
    B: [["Canada", "CA"], ["Bosnia", "BA"], ["Qatar", "QA"], ["Switzerland", "CH"]],
    C: [["Brazil", "BR"], ["Morocco", "MA"], ["Haiti", "HT"], ["Scotland", "SCT"]],
    D: [["USA", "US"], ["Paraguay", "PY"], ["Australia", "AU"], ["Turkey", "TR"]],
    E: [["Germany", "DE"], ["Curaçao", "CW"], ["Côte d'Ivoire", "CI"], ["Ecuador", "EC"]],
    F: [["Netherlands", "NL"], ["Japan", "JP"], ["Sweden", "SE"], ["Tunisia", "TN"]],
    G: [["Belgium", "BE"], ["Egypt", "EG"], ["IR Iran", "IR"], ["New Zealand", "NZ"]],
    H: [["Spain", "ES"], ["Cabo Verde", "CV"], ["Saudi Arabia", "SA"], ["Uruguay", "UY"]],
    I: [["France", "FR"], ["Senegal", "SN"], ["Iraq", "IQ"], ["Norway", "NO"]],
    J: [["Argentina", "AR"], ["Algeria", "DZ"], ["Austria", "AT"], ["Jordan", "JO"]],
    K: [["Portugal", "PT"], ["DR Congo", "CD"], ["Uzbekistan", "UZ"], ["Colombia", "CO"]],
    L: [["England", "ENG"], ["Croatia", "HR"], ["Ghana", "GH"], ["Panama", "PA"]],
  },

  // Reserved for later: actual match results could be supplied here
  // (e.g. results: { A: [[2,1], null, ...], ... }) and surfaced in the UI.
  // results: {},
};
