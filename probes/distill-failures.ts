import { createOpenAI } from "@ai-sdk/openai";
import { distill } from "../src/index";
const content =
  "Vector databases store embeddings so that similar texts can be found by distance. In production, teams chunk documents, embed each chunk and retrieve the closest ones by cosine similarity.";

type Case = {
  name: string;
  status: number;
  headers: Record<string, string>;
  declaredPath?: string;
};
const json = { "Content-Type": "application/json" };
const cases: Case[] = [
  {
    name: "429  Retry-After:1 ",
    status: 429,
    headers: { ...json, "Retry-After": "1" },
  },
  { name: "400", status: 400, headers: json },
  { name: "401", status: 401, headers: json },
  { name: "500", status: 500, headers: json },
  { name: "403 ", status: 403, headers: json },
  {
    name: "broken loadDeclared",
    status: 200,
    headers: json,
    declaredPath: "/does/not/exist.json",
  },
];
let current: Case = cases[0];
let calls = 0;
const fakeFetch: typeof fetch = async () => {
  calls++;
  const body = JSON.stringify({
    error: { message: `fake ${current.status}`, type: "fake_error" },
  });
  return new Response(body, { status: current.status, headers: current.headers });
};
for (const testCase of cases) {
  current = testCase;
  const nan = createOpenAI({
    apiKey: "fake",
    baseURL: "http://fake.invalid/v1",
    fetch: fakeFetch,
  });
  try {
    const r = await distill(
      content,
      nan.chat("mimo-v2.6-flash"),
      testCase.declaredPath,
    );
    if (r.status === "failed") {
    //   console.log(testCase.name);
    //   console.log(r.status);
    //   console.log(r.nextStep);
      console.log(r)
    }
  } catch (e) {
    console.log(`${testCase.name} threw`, (e as Error).message);
  }
}
