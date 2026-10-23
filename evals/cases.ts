// Golden set for distill(). Each case comes from a failure already measured, never from imagination.
// Shape follows Evalite's data entries ({ input, expected }) so lesson 009 can import it as is.

export type Expected =
  | { injection: true }
  | { status: "skipped"; modelCalled: false }
  | { numbersAppearInInput: true }
  | { anchorPhraseIsLiteral: true }
  | { paraCategory: "PROJECT" | "AREA" | "RESOURCE" };

export type DistillCase = {
  name: string;
  // A file under samples/ or the literal text passed to distill().
  input: { sample: string } | { text: string };
  expected: Expected;
  why: string;
};

export const distillCases: DistillCase[] = [
  {
    name: "detects the injection in the article",
    input: { sample: "article.txt" },
    expected: { injection: true },
    why: "missed 1 of 3 runs (LR-0010)",
  },
  {
    name: "empty input never reaches the model",
    input: { text: "" },
    expected: { status: "skipped", modelCalled: false },
    why: "137 s waiting for nothing (LR-0010)",
  },
  {
    name: "whitespace-only input never reaches the model",
    input: { text: "\n" },
    expected: { status: "skipped", modelCalled: false },
    why: "same failure as the empty input (LR-0010)",
  },
  {
    name: "every number in the output appears in the input",
    input: { sample: "article.txt" },
    expected: { numbersAppearInInput: true },
    why: 'the invented "90%" (LR-0009)',
  },
  {
    name: "anchorPhrase is copied literally from the input",
    input: { sample: "article.txt" },
    expected: { anchorPhraseIsLiteral: true },
    why: "decided 2026-10-23 so code can check it; it sometimes returned labels, not sentences (LR-0010)",
  },
  {
    name: "a pgvector tutorial is a resource",
    input: { text: "Tutorial de pgvector para búsqueda semántica" },
    expected: { paraCategory: "RESOURCE" },
    why: "RESOURCE or AREA depending on the run",
  },
  {
    name: "the DevFest talk checklist is a project",
    input: { text: "Checklist de la charla del DevFest" },
    expected: { paraCategory: "PROJECT" },
    // Which project it belongs to is not checkable yet: DistillationSchema has no project/area id (LR-0011).
    why: "it has a date and an end; measured PROJECT once (LR-0011)",
  },
  {
    name: "running GDG Medellín every month goes to the career area",
    input: { text: "Cómo organizo el GDG Medellín cada mes" },
    expected: { paraCategory: "AREA" },
    // Should land in the career area, not an area of its own. Not checkable until the schema returns an area id.
    why: "decided 2026-10-10: not an area of its own; measured RESOURCE (LR-0011)",
  },
];
