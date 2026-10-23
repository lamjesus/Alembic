// Eval runner for distill(). Spec by the author (lesson 008, Part C, 2026-10-23):
// - k = 5 repetitions per case, each with a different seed (only /chat/completions forwards it;
//   identical requests to NaN return a cached answer, so without a seed the 5 runs would be one).
// - Reports the pass rate per case, no threshold yet.
// - A failed distill() (429, 500...) is counted apart as an error, not as a failed case.
// - Property checks not written yet are reported as unchecked.
// Run: yarn eval
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { wrapLanguageModel, type LanguageModelMiddleware } from "ai";
import { distill } from "../src/index";
import { models } from "../src/llm/provider";
import { distillCases, type DistillCase } from "./cases";
import { anchorPhraseIsLiteral, numbersAppearInInput } from "./checks";

const K = 5;

type Outcome = "pass" | "fail" | "unchecked" | "error";
type DistillResult = Awaited<ReturnType<typeof distill>>;
type Run = {
  seed: number;
  outcome: Outcome;
  modelCalls: number;
  result?: DistillResult;
  error?: string;
};

// Sets this repetition's seed and counts the calls that reach the model (retries included).
function instrumentedModel(seed: number) {
  const counter = { calls: 0 };
  const middleware: LanguageModelMiddleware = {
    transformParams: async ({ params }) => ({ ...params, seed }),
    wrapGenerate: async ({ doGenerate }) => {
      counter.calls++;
      return doGenerate();
    },
  };
  return {
    model: wrapLanguageModel({ model: models.saveModel, middleware }),
    counter,
  };
}

function readInput(input: DistillCase["input"]): string {
  return "sample" in input
    ? readFileSync(`samples/${input.sample}`, "utf8")
    : input.text;
}

function judge(
  testCase: DistillCase,
  input: string,
  result: DistillResult,
  modelCalls: number,
): Outcome {
  const expected = testCase.expected;
  if (result.status === "failed") return "error";
  if ("status" in expected) {
    return result.status === expected.status && modelCalls === 0 ? "pass" : "fail";
  }
  if (result.status !== "distilled") return "fail";
  const d = result.distillation;
  let ok: boolean | undefined;
  if ("injection" in expected) ok = d.injection === expected.injection;
  else if ("paraCategory" in expected) ok = d.paraCategory === expected.paraCategory;
  else if ("numbersAppearInInput" in expected) ok = numbersAppearInInput(input, d);
  else ok = anchorPhraseIsLiteral(input, d);
  if (ok === undefined) return "unchecked";
  return ok ? "pass" : "fail";
}

async function runOnce(testCase: DistillCase, seed: number): Promise<Run> {
  const input = readInput(testCase.input);
  const { model, counter } = instrumentedModel(seed);
  try {
    const result = await distill(input, model);
    const outcome = judge(testCase, input, result, counter.calls);
    return { seed, outcome, modelCalls: counter.calls, result };
  } catch (error) {
    // distill() rethrows statuses it does not map (e.g. 403): infrastructure, not quality.
    return { seed, outcome: "error", modelCalls: counter.calls, error: (error as Error).message };
  }
}

const report = [];
for (const testCase of distillCases) {
  // The 5 repetitions in parallel: NaN allows 5 simultaneous requests per model.
  const runs = await Promise.all(
    Array.from({ length: K }, (_, i) => runOnce(testCase, i + 1)),
  );
  const count = (o: Outcome) => runs.filter((r) => r.outcome === o).length;
  const pass = count("pass");
  const judged = pass + count("fail");
  const summary = {
    name: testCase.name,
    rate: judged > 0 ? `${pass}/${judged}` : "-",
    errors: count("error"),
    unchecked: count("unchecked"),
    modelCalls: runs.reduce((sum, r) => sum + r.modelCalls, 0),
  };
  console.log(
    `${summary.name.padEnd(58)} ${summary.rate.padStart(5)}  errors ${summary.errors}  unchecked ${summary.unchecked}  calls ${summary.modelCalls}`,
  );
  // Outputs are kept only for runs that did not pass, so you can see what the model said.
  report.push({
    ...summary,
    why: testCase.why,
    notPassed: runs.filter((r) => r.outcome !== "pass"),
  });
}

mkdirSync("evals/results", { recursive: true });
const file = `evals/results/${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
writeFileSync(file, JSON.stringify(report, null, 2));
console.log(`\nDetails: ${file}`);
