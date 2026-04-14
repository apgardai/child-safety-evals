import JSZip from "jszip";

export type Scenario = {
  file?: string;
  id: string;
  scenarioTitle: string;
  riskCategoryId: string;
  riskCategoryName?: string;
  riskId: string;
  riskName?: string;
  ageRange: string;
  prompt: string;
  scenarioModel?: string;
  safetyGrade: string;
  assessmentReasons: string;
  narrative?: string;
  evaluationCriteria?: string;
  firstUserMessage?: string;
  motivationName?: string;
  messages?: Array<{ role: string; content: string }>;
};

/** Matches benchmark `run` results.json `scores[].sums` (see benchmark README, Interpreting results). */
export type BenchmarkScoreSums = {
  /** Total tests in this risk × age × prompt group */
  al?: number;
  /** Safety: [failing, adequate, exemplary] */
  as?: number[];
  /** Anthropomorphism: [failing, adequate, exemplary, occurrenceCount] */
  an?: number[];
  /** Epistemic humility: [failing, adequate, exemplary, occurrenceCount] */
  eh?: number[];
  /** Human redirection: [failing, adequate, exemplary, occurrenceCount] */
  hr?: number[];
};

export type BenchmarkScoreRow = {
  riskCategoryId: string;
  riskId: string;
  ageRange?: string;
  prompt?: string;
  sums?: BenchmarkScoreSums;
};

export type ViewerData = {
  generatedAt?: string;
  summary?: {
    target?: string;
    judge?: string;
    user?: string;
    prompts?: string[];
    scores?: BenchmarkScoreRow[];
  };
  /** Optional taxonomy for readable category/risk labels. */
  risks?: RiskCategory[];
  scenarios?: Scenario[];
};

type RiskCategory = {
  id?: string;
  name?: string;
  risks?: Array<{ id?: string; name?: string }>;
};

function buildRiskMaps(risks: RiskCategory[] | undefined) {
  const categoryById = new Map<string, string>();
  const riskByKey = new Map<string, string>();

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

function normalizeScenarioRecord(
  record: unknown,
  fileName: string,
  categoryById: Map<string, string>,
  riskByKey: Map<string, string>
): Scenario {
  const r =
    record && typeof record === "object"
      ? (record as Record<string, unknown>)
      : {};
  const scenario =
    r.scenario && typeof r.scenario === "object"
      ? (r.scenario as Record<string, unknown>)
      : {};
  const seed =
    scenario.seed && typeof scenario.seed === "object"
      ? (scenario.seed as Record<string, unknown>)
      : {};
  const assessment =
    r.assessment && typeof r.assessment === "object"
      ? (r.assessment as Record<string, unknown>)
      : {};

  const riskCategoryId =
    typeof seed.riskCategoryId === "string" ? seed.riskCategoryId : "";
  const riskId = typeof seed.riskId === "string" ? seed.riskId : "";
  const riskKey = `${riskCategoryId}:${riskId}`;

  const messagesRaw = Array.isArray(r.messages) ? r.messages : [];
  const messages = messagesRaw.map((m) => {
    if (!m || typeof m !== "object") return { role: "", content: "" };
    const o = m as Record<string, unknown>;
    return {
      role: typeof o.role === "string" ? o.role : "",
      content: typeof o.content === "string" ? o.content : "",
    };
  });

  return {
    file: fileName,
    id: typeof seed.id === "string" ? seed.id : fileName,
    prompt: typeof r.prompt === "string" ? r.prompt : "default",
    riskCategoryId,
    riskCategoryName: categoryById.get(riskCategoryId) || riskCategoryId || "Unknown",
    riskId,
    riskName: riskByKey.get(riskKey) || riskId || "Unknown",
    ageRange: typeof seed.ageRange === "string" ? seed.ageRange : "",
    scenarioTitle:
      (typeof scenario.shortTitle === "string" ? scenario.shortTitle : "") ||
      (typeof seed.shortTitle === "string" ? seed.shortTitle : "") ||
      "Untitled scenario",
    narrative: typeof scenario.narrative === "string" ? scenario.narrative : "",
    evaluationCriteria:
      typeof scenario.evaluationCriteria === "string"
        ? scenario.evaluationCriteria
        : "",
    firstUserMessage:
      typeof scenario.firstUserMessage === "string"
        ? scenario.firstUserMessage
        : "",
    motivationName:
      seed.motivation &&
      typeof seed.motivation === "object" &&
      typeof (seed.motivation as Record<string, unknown>).name === "string"
        ? ((seed.motivation as Record<string, unknown>).name as string)
        : "",
    safetyGrade: typeof assessment.grade === "string" ? assessment.grade : "",
    assessmentReasons:
      typeof assessment.reasons === "string" ? assessment.reasons : "",
    messages,
  };
}

function isSummaryPayload(obj: unknown): boolean {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return Array.isArray(o.scores);
}

function parseSummaryFromUnknown(obj: unknown): NonNullable<ViewerData["summary"]> {
  if (!obj || typeof obj !== "object") {
    return { target: "", judge: "", user: "", prompts: [], scores: [] };
  }
  const o = obj as Record<string, unknown>;
  const prompts = Array.isArray(o.prompts)
    ? o.prompts.filter((x): x is string => typeof x === "string")
    : [];
  const scores = Array.isArray(o.scores) ? o.scores : [];
  return {
    target: typeof o.target === "string" ? o.target : "",
    judge: typeof o.judge === "string" ? o.judge : "",
    user: typeof o.user === "string" ? o.user : "",
    prompts,
    scores: scores as NonNullable<ViewerData["summary"]>["scores"],
  };
}

/**
 * Parses a benchmark results .zip (summary JSON at root + testResults/*.json).
 */
export async function buildViewerDataFromResultsZip(
  buffer: ArrayBuffer,
  options?: { risksJson?: RiskCategory[] }
): Promise<ViewerData> {
  const zip = await JSZip.loadAsync(buffer);
  const paths: string[] = [];
  zip.forEach((relativePath, file) => {
    if (!file.dir) paths.push(relativePath);
  });

  const rootJsonPaths = paths.filter((p) => {
    const parts = p.split("/");
    return parts.length === 1 && p.endsWith(".json");
  });

  let summaryObj: unknown = null;
  if (rootJsonPaths.length === 0) {
    summaryObj = null;
  } else {
    let pick = rootJsonPaths[0];
    for (const name of rootJsonPaths) {
      const z = zip.file(name);
      if (!z) continue;
      const txt = await z.async("string");
      try {
        const parsed: unknown = JSON.parse(txt);
        if (isSummaryPayload(parsed)) {
          pick = name;
          summaryObj = parsed;
          break;
        }
      } catch {
        /* try next */
      }
    }
    if (summaryObj === null && pick) {
      const z = zip.file(pick);
      if (z) {
        try {
          summaryObj = JSON.parse(await z.async("string"));
        } catch {
          summaryObj = null;
        }
      }
    }
  }

  const testPrefixes = ["testResults/", "testresults/"];
  let testPrefix = testPrefixes.find((prefix) =>
    paths.some((p) => p.startsWith(prefix) && p.endsWith(".json"))
  );
  if (!testPrefix) {
    testPrefix = "testResults/";
  }

  const testJsonPaths = paths.filter(
    (p) =>
      p.startsWith(testPrefix) &&
      p.endsWith(".json") &&
      !p.slice(testPrefix.length).includes("/")
  );

  const { categoryById, riskByKey } = buildRiskMaps(options?.risksJson);

  const scenarios: Scenario[] = [];
  for (const rel of testJsonPaths) {
    const z = zip.file(rel);
    if (!z) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(await z.async("string"));
    } catch {
      continue;
    }
    const norm = normalizeScenarioRecord(
      parsed,
      rel.split("/").pop() || rel,
      categoryById,
      riskByKey
    );
    scenarios.push(norm);
  }

  if (rootJsonPaths.length === 0 && testJsonPaths.length === 0) {
    throw new Error(
      "This zip does not look like a benchmark results archive (expected a summary .json at the root and scenario files under testResults/)."
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: parseSummaryFromUnknown(summaryObj),
    scenarios,
  };
}
