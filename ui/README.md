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
