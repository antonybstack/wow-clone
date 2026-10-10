# C05 ops final result — 2026-10-10

Two commands. No live acceptance claims.

## Commands and exits

| # | command | log | exit |
|---|---------|-----|------|
| 1 | `node --test scripts/test-action-{scheduler,bindings}.mjs scripts/test-combat-{auras,diagnostics,movement-policy,presentation-events}.mjs scripts/test-enemy-contact.mjs scripts/test-fire-blast.mjs scripts/test-lava-ball.mjs scripts/test-grave-pulse.mjs` | `all-tests-final.log` | **0** |
| 2 | `npm run build` | `build-complete.log` | **0** |

**Commands: 2/2 success, 0 failure.**

## Tests

TAP footer from `all-tests-final.log`:

```
1..67
# tests 67
# suites 0
# pass 67
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 325.385416
```

Counted TAP lines: `ok` **67**, `not ok` **0**.

| metric | count |
|--------|------:|
| tests | 67 |
| pass | 67 |
| fail | 0 |
| cancelled | 0 |
| skipped | 0 |
| todo | 0 |
| suites | 0 |

## Build

- Exit **0**
- `✓ built in 4.07s`
- Non-fatal: chunk >500 kB after minification
- Non-fatal: `INEFFECTIVE_DYNAMIC_IMPORT` (`src/ashen-reach/startup-assets.js`)
