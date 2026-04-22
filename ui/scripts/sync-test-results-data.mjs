import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.join(__dirname, "..");
const src = path.join(
  uiRoot,
  "..",
  "benchmark",
  "results-viewer",
  "data",
  "viewer-data.json"
);
const dest = path.join(
  uiRoot,
  "public",
  "benchmark",
  "testResults",
  "viewer-data.json"
);

const strict =
  process.argv.includes("--strict") || process.env.TEST_RESULTS_DATA_STRICT === "1";

const emptyViewerData = JSON.stringify(
  {
    generatedAt: "",
    summary: {},
    risks: [],
    scenarios: [],
  },
  null,
  0
);

function main() {
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(
      `[sync-test-results-data] Copied to ${path.relative(uiRoot, dest)}`
    );
    return;
  }

  const msg =
    `[sync-test-results-data] Missing ${path.relative(uiRoot, src)}.\n` +
    `  Run: cd benchmark && node results-viewer/build-viewer-data.mjs`;

  if (strict) {
    console.error(msg);
    process.exit(1);
  }

  console.warn(`${msg}\n  Using empty stub for local dev.`);
  fs.writeFileSync(dest, emptyViewerData, "utf8");
}

main();
