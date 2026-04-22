# Child Safety AI Evaluations UI

Next.js UI for running the child safety benchmark pipeline (generate seeds, expand scenarios, run evaluations).

## Prerequisites

1. **Build the benchmark** (from the `benchmark` directory):

   ```bash
   cd ../benchmark
   yarn && yarn tsbuild
   ```

2. **Configure the API key** in `benchmark/.env`:

   ```bash
   cp ../benchmark/.env.example ../benchmark/.env
   # Edit .env and set AI_GATEWAY_API_KEY
   ```

## Test Results (public page)

The **Test Results** tab loads static viewer data built from `benchmark/results-viewer/testResults/` (aggregated by `benchmark/results-viewer/build-viewer-data.mjs`). On `yarn dev` / `yarn build`, `scripts/sync-test-results-data.mjs` copies `benchmark/results-viewer/data/viewer-data.json` into `public/benchmark/testResults/viewer-data.json`. If the source file is missing locally, run:

```bash
cd ../benchmark && node results-viewer/build-viewer-data.mjs
```

Production builds use `prebuild` with `--strict` and require that file to exist.

## Development

From this directory (`child-safety-evals/ui`):

```bash
yarn install
yarn dev
```

Open [http://localhost:3000](http://localhost:3000). The UI exposes the same three commands as the CLI:

- **Generate seeds** — Generate scenario seeds from the risk taxonomy.
- **Expand scenarios** — Transform seeds into full scenarios with validation.
- **Run benchmark** — Run the benchmark against a target model.

Output streams in real time. Use **Stop** to cancel a running command.
