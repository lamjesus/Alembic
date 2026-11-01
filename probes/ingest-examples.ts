// The 3 examples of lesson 009, Part C. distill() is replaced by a stub that counts calls,
// so the run costs no NaN requests and can check that case 2 does NOT call it.
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ingest } from "../src/ingest";
import { decideReview } from "../src/utils/review";

const storePath = join(tmpdir(), "alembic-ingest-examples.json");
rmSync(storePath, { force: true });

let distillCalls = 0;
const distillFn = async () => {
  distillCalls++;
  return { status: "skipped" as const, review: decideReview(["manual-review"]) };
};

const github = "https://github.com/vercel-labs/agent-desktop";
const reddit =
  "https://www.reddit.com/r/QuestPiracy/comments/1x04vz3/project_to_connect_meta_quest_3_to_ps5/";

const first = await ingest(github, { storePath, distillFn });
console.log("1.", first.status, "| distill calls:", distillCalls);
console.log("   PASS:", first.status === "skipped" && distillCalls === 1);

const second = await ingest(github, { storePath, distillFn });
console.log("2.", second.status, "| distill calls:", distillCalls);
console.log("   PASS:", second.status === "unchanged" && distillCalls === 1);

const third = await ingest(reddit, { storePath, distillFn });
console.log("3.", JSON.stringify(third));
console.log(
  "   PASS:",
  third.status === "failed" && "reason" in third && third.reason === "too-short" && distillCalls === 1,
);
