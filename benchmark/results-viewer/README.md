# Benchmark Results Viewer

Static, no-auth results explorer for KORA benchmark outputs.

## What it shows

- Benchmark summary (target/judge/user/prompts + counts)
- Risk summary cards (click to drill down)
- Filterable scenario list
- Scenario overlay with:
  - assessment reasons
  - scenario narrative
  - full conversation
- CSV export for currently filtered scenarios

## Build viewer data

From `child-safety-evals/benchmark`:

```bash
node ./results-viewer/build-viewer-data.mjs
```

This reads from **archived results** (stable, not overwritten by KORA runs):

- `results-viewer/archived-results/results.json`
- `results-viewer/archived-results/testResults/*.json`
- `packages/benchmark/data/risks.json`

and writes:

- `results-viewer/data/viewer-data.json`

## Archive new runs

After running `yarn kora run`, archive the fresh output before the next run overwrites `data/`:

```bash
yarn results-viewer:archive
```

Then rebuild viewer data:

```bash
yarn results-viewer:data
```

## Run locally

Serve the benchmark directory as static files:

```bash
python3 -m http.server 8000
```

Then open:

- `http://localhost:8000/results-viewer/`

