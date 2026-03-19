import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(process.cwd());
// Use archived-results so KORA CLI runs don't overwrite viewer data
const archivedDir = path.join(rootDir, "results-viewer", "archived-results");
const resultsPath = path.join(archivedDir, "results.json");
const testResultsDir = path.join(archivedDir, "testResults");
const risksPath = path.join(rootDir, "packages", "benchmark", "data", "risks.json");
const outDir = path.join(rootDir, "results-viewer", "data");
const outPath = path.join(outDir, "viewer-data.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function safeReadJson(filePath) {
  try {
    return readJson(filePath);
  } catch {
    return null;
  }
}

function buildRiskMaps(risks) {
  const categoryById = new Map();
  const riskByKey = new Map();

  for (const category of risks || []) {
    if (!category?.id) continue;
    categoryById.set(category.id, category.name || category.id);
    for (const risk of category.risks || []) {
      if (!risk?.id) continue;
      riskByKey.set(`${category.id}:${risk.id}`, risk.name || risk.id);
    }
  }

  return { categoryById, riskByKey };
}

function listJsonFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(dirPath, name));
}

function normalizeScenarioRecord(record, fileName, categoryById, riskByKey) {
  const scenario = record?.scenario || {};
  const seed = scenario?.seed || {};
  const assessment = record?.assessment || {};
  const behavior = record?.behaviorAssessment || {};

  const riskCategoryId = seed.riskCategoryId || "";
  const riskId = seed.riskId || "";
  const riskKey = `${riskCategoryId}:${riskId}`;

  return {
    file: fileName,
    id: seed.id || fileName,
    prompt: record?.prompt || "default",
    riskCategoryId,
    riskCategoryName: categoryById.get(riskCategoryId) || riskCategoryId || "Unknown",
    riskId,
    riskName: riskByKey.get(riskKey) || riskId || "Unknown",
    ageRange: seed.ageRange || "",
    scenarioTitle: scenario.shortTitle || seed.shortTitle || "Untitled scenario",
    narrative: scenario.narrative || "",
    evaluationCriteria: scenario.evaluationCriteria || "",
    firstUserMessage: scenario.firstUserMessage || "",
    motivationName: seed?.motivation?.name || "",
    safetyGrade: assessment.grade || "",
    assessmentReasons: assessment.reasons || "",
    behaviorAssessment: behavior,
    messages: Array.isArray(record?.messages) ? record.messages : [],
  };
}

function main() {
  const results = safeReadJson(resultsPath) || {};
  const risks = safeReadJson(risksPath) || [];
  const { categoryById, riskByKey } = buildRiskMaps(risks);

  const testResultFiles = listJsonFiles(testResultsDir);
  const scenarios = testResultFiles
    .map((filePath) => {
      const parsed = safeReadJson(filePath);
      if (!parsed) return null;
      return normalizeScenarioRecord(
        parsed,
        path.basename(filePath),
        categoryById,
        riskByKey
      );
    })
    .filter(Boolean);

  const output = {
    generatedAt: new Date().toISOString(),
    summary: {
      target: results.target || "",
      judge: results.judge || "",
      user: results.user || "",
      prompts: results.prompts || [],
      scores: results.scores || [],
    },
    risks,
    scenarios,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(
    `Wrote ${scenarios.length} scenarios to ${path.relative(rootDir, outPath)}`
  );
}

main();

