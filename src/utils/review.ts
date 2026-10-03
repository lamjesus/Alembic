import type { FinishReason } from "ai";
import type { z } from "zod";
import type { DistillationSchema } from "../llm/schemas";

export type Distillation = z.infer<typeof DistillationSchema>;

// One reason per check, so the reviewer knows WHAT to look for, not just that they should look.
export type ReviewReason =
  | "empty-content"
  | "injection"
  | "truncated-response"
  | "repeated-tags"
  | "manual-review";

export type ReviewDecision = {
  needsReview: boolean;
  reasons: ReviewReason[];
};

// Runs BEFORE calling the model. Any reason here skips the call.
export function checkInput(content: string): ReviewReason[] {
  if (content.trim() === "") {
    return ["empty-content"];
  }
  return [];
}

// Runs AFTER the call: model signals plus deterministic checks.
export function checkOutput(
  content: string,
  distillation: Distillation,
  finishReason: FinishReason,
): ReviewReason[] {
  const reasons: ReviewReason[] = [];
  if (finishReason === "length") {
    reasons.push("truncated-response");
  }
  if (distillation.injection) {
    reasons.push("injection");
  }
  if (distillation.paraTags.length !== new Set(distillation.paraTags).size) {
    reasons.push("repeated-tags");
  }
  if (distillation.manualReview) {
    reasons.push("manual-review");
  }
  return reasons;
}

export function decideReview(reasons: ReviewReason[]): ReviewDecision {
  return {
    needsReview: reasons.length > 0,
    reasons: reasons,
  };
}
