# Alembic

A personal knowledge agent built on one loop: **capture → distill → organize → return**.

I save articles, PDFs and notes "for later", and they never come back. Alembic reads what I save, distills it into the ideas that matter, organizes it against my own projects and areas (PARA), and gives it back when I need it, citing where each answer comes from.

> **Work in progress, built in public.** I'm writing every piece myself while learning AI engineering, and I post what works and what breaks along the way.

## Status

| Step | State |
|---|---|
| **Distill** | Works: the model returns a fixed structure (key ideas, anchor phrase, core idea, injection flag), validated with Zod |
| **Organize** | In progress: classifies into PARA (project, area, resource) using my declared projects and areas |
| **Capture** | Next: ingest URLs and PDFs |
| **Return** | Planned: answers with cited sources (RAG over pgvector) and evals in CI |

## Decisions so far

- **The provider is isolated.** Every model call goes through `src/llm/provider.ts`. Swapping the platform or a model is a one-line change, because the platform I first built on retired the agent I was using.
- **What the code can check, the model is never asked.** Empty input never reaches the model, and the code (not the model) decides what goes to manual review (`src/utils/review.ts`).
- **A fixed output structure guarantees shape, not truth.** The schema stops format drift, but the content is still checked in code.
- **My projects go in the instructions, not behind a tool.** In my tests, asking for structured output stopped the model from calling the tool, so the declared list is passed as trusted context instead.
- **Stateless calls on purpose.** The provider does not store conversations, so every call carries the full context (`store: false`, set once in the provider).

## Stack

TypeScript · [Vercel AI SDK](https://ai-sdk.dev) · Zod · open models through an OpenAI-compatible API ([NaN](https://nan.builders)) · pgvector (planned)

## Run it

```bash
yarn install
cp .env.example .env                                    # add your API base URL and key
cp src/data/declared.example.json src/data/declared.json   # your own projects and areas
mkdir -p samples && echo "Any article text" > samples/article.txt
yarn start
```

Run it from the repo root: paths are resolved from the current directory.

## Layout

```
src/
  index.ts            distill(): input check → model call → review
  llm/provider.ts     the only place that knows the provider and models
  llm/prompts.ts      system instructions per role
  llm/schemas.ts      Zod schemas: the distillation output and the declared data
  llm/tools.ts        read-only tool (kept for later; not used in ingestion)
  data/declared.ts    loads, validates and filters declared projects and areas
  utils/review.ts     deterministic checks that decide manual review
```

## License

MIT
