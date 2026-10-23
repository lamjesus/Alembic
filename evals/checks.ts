// Property checks (rung 1): code only, no model, no reference answer.
// Spec by the author (2026-10-23); return undefined while a check is not written:
// the runner reports those cases as "unchecked" instead of passing or failing them.
import type { Distillation } from "../src/utils/review";

// Digit groups, not parsed numbers: "90%" → 90, "1,5" and "1.5" → 1 and 5, "2026" → 2026.
// Avoids guessing whether the text uses Spanish or English separators.
const digitGroups = (text: string) => text.match(/\d+/g) ?? [];

// Every number in the output appears in the input (the invented "90%", LR-0009).
// Only free-text fields the model writes: enums and booleans cannot carry an invented number.
export function numbersAppearInInput(
  input: string,
  distillation: Distillation,
): boolean | undefined {
  const outputText = [
    ...distillation.distilledIdeas,
    ...distillation.paraTags,
    distillation.coreIdea,
    distillation.anchorPhrase,
  ].join(" ");
  const inputNumbers = new Set(digitGroups(input));
  // No numbers in the output → nothing invented → true.
  return digitGroups(outputText).every((n) => inputNumbers.has(n));
}

// Only spaces and line breaks are ignored: case and quotes must match.
const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

// anchorPhrase is copied literally from the input (decided 2026-10-23).
export function anchorPhraseIsLiteral(
  input: string,
  distillation: Distillation,
): boolean | undefined {
  const phrase = normalize(distillation.anchorPhrase);
  if (phrase === "") return false;
  return normalize(input).includes(phrase);
}
