# World Cup 2026 — Group Stage Predictor & Bracket

A single-page tool to predict the 2026 FIFA World Cup. Enter scorelines for the
group stage and the standings recompute live; the best third-placed race and a
fully interactive knockout bracket follow automatically. Plain HTML/CSS and
vanilla JavaScript — no build step, no dependencies.

## Features
- **All 12 groups (A–L)** from the official 2026 draw, full round-robin (6
  matches each), with the European/intercontinental playoff winners filled in
  (Sweden, Czechia, Turkey, Bosnia, Iraq, DR Congo).
- **Two input modes** — predict each match by exact **Scoreline**, or by
  **Win / Draw / Loss** (1·X·2). Toggle at the top.
- **Live standings** with FIFA tiebreakers: points → goal difference → goals
  for → head-to-head → name.
- **Best third-placed teams** panel ranking all 12 thirds; the top 8 advance.
- **Interactive knockout bracket** using the official 2026 structure (Round of
  32 → Final, plus third-place match). Group winners, runners-up, and the 8 best
  thirds seed automatically; **click a team to advance it** round by round, up to
  a crowned champion.
- **Editable team names** (click any name), plus **Randomize** and **Reset**.
- Predictions and bracket picks **auto-save** in the browser (localStorage).

## Run it
Open `index.html` in any browser — that's it.

```
open index.html
```

## Notes
- Default lineups follow the published draw; playoff slots resolve once those
  qualifiers are known. Every team name is editable.
- Fan-made; not affiliated with FIFA.
