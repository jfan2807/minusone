# MinusOne

A habit-subtraction app built on "addition by subtraction": instead of adding new habits, systematically eliminate the one behavior costing you the most — one boss battle at a time.

Single-file web app, no build step, no server, no accounts. All data lives in your browser's localStorage.

## Run

Open `index.html` in a browser, or serve the folder:

```
python -m http.server 8974
```

Designed to fit a single iPhone screen with no scrolling (tab navigation); on desktop the phone frame scales to the viewport.

## Features

- **Focus Horizon** — one Active Boss habit at a time; new habits queue until the boss is neutralized (30-day streak)
- **Pattern Interrupts** — context-specific: guided breathing (digital), 24h cooling lock with cost-in-working-hours (financial), somatic grounding checklist (physical)
- **Gamification** — XP with domino/combo bonuses, 10 level titles, 14 achievements, daily quest, streak shields, boss HP bar, confetti
- **Real-World Value** — every $50 saved unlocks a real-world equivalent, from a pair of Vans to a new SUV at $30,000
- **Honest tracking** — an "I slipped" button that resets streaks without erasing totals, plus undo on every logged resist
- **Data ownership** — JSON export/import, one-tap reset

## Tests

`tests.js` holds a 106-scenario test suite. Load the app in a browser, then in the console:

```js
const src = await fetch('tests.js').then(r => r.text()); eval(src);
await runTests();
```

## Fonts

Uses Neue Montreal and ABC Diatype Mono (trial) from `fonts/`. Check the font licenses before any public distribution.
