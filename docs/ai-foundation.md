# AI Foundation

Implementation of Handbook **Ch.14 Parts 1–4** (§1–89), read verbatim in
full — same discipline as every prior phase, and especially warranted here:
this is the platform's most security-sensitive infrastructure (prompt
injection, budget/kill-switch controls), not somewhere to work from a
paraphrase. Scope per your canonical decision: Gateway, Model Router,
Provider Abstraction, Prompt Registry, Memory Engine, Embeddings, Knowledge
Base, Workflow Engine. **No AI employee personas** — those are Phase 11.

## What exists after this phase

A real, working, tested pipeline with nothing plugged into it yet — like
Phase 5's `GET /api/v1/products`, this is the pattern Phase 11's eleven
agents will all reuse, not a demo of any one of them.

```
Kill switch → Budget → Injection scan (input) → Memory retrieval
→ Injection scan (retrieved memory) → Prompt assembly → Model routing
→ Context budget check → Provider adapter call → Cost recording
```

`apps/web/server/ai/orchestrator.ts` (`AiOrchestrator.execute()`) is this
pipeline, in this order, matching Ch.14 §13 and §66 exactly. 11 unit tests
exercise every branch, including both places prompt injection is checked
(direct task input _and_ retrieved memory — the latter is how indirect
injection actually arrives, Ch.14 §70).

## Layer split (same pattern as Phase 5)

| Layer                                                                                                             | Lives in                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Pure domain logic (router, injection guard, budget math, kill-switch logic, prompt assembly, context-window math) | `packages/ai/src/` — zero dependencies, 42 unit tests, no database or API key needed to test any of it               |
| Provider adapters (OpenAI, Anthropic, Groq)                                                                       | `apps/web/server/ai/adapters/` — the _only_ files allowed to import an SDK (Ch.14 §7)                                |
| Repositories (models, governance, prompts, memory)                                                                | `apps/web/server/ai/repositories/`                                                                                   |
| Orchestration                                                                                                     | `apps/web/server/ai/orchestrator.ts`                                                                                 |
| Gateway entry point                                                                                               | `apps/web/app/api/v1/admin/ai/health/route.ts` (auth/rate-limit/logging/routing, "performs no reasoning" — Ch.14 §5) |

## Gaps in Ch.10's AI schema filled here

Same situation as Phase 3's coupons/offers/reviews: Ch.14 mandates specific
governance controls, but Ch.10's Part 5 (AI schema) never gave them a
table.

| Table                               | Why it was needed                                                                                                                                                      |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai_models` (migration 0021)        | Ch.14 §68: "Every model is registered... Only approved models may be used in production." `ai_agents.preferred_model` was free text with no governance gate behind it. |
| `ai_kill_switches` (migration 0022) | Ch.14 §80: "Disable Entire AI / Individual Agent / Provider / Tool / Workflow." No table existed.                                                                      |
| `ai_budgets` (migration 0022)       | Ch.14 §81: daily/weekly/monthly, per-provider/agent/workflow budgets with 50/75/90/100% thresholds. No table existed.                                                  |

All three: admin-only RLS (internal governance data, never customer/anon
facing) — verified directly (inserted rows, confirmed `anon` gets zero rows
back, confirmed an `administrator`-role user sees everything), same
methodology as Phase 3.

## Decisions worth knowing about

- **`BusinessRuleError`-style reasoning didn't apply here** — this phase
  introduces its own error type, `AiOrchestrationError`, with a closed set
  of 8 `reason` values (`kill_switch`, `budget_exceeded`,
  `prompt_injection`, `prompt_not_found`, `no_model_available`,
  `context_exceeded`, `provider_not_configured`, `provider_failure`).
  It doesn't extend `AppError` from Phase 5 — orchestration failures are an
  internal signal for the caller (a future Phase 11 agent, or the
  admin-only health route) to interpret, not yet an HTTP boundary; whatever
  Phase 11 code calls the orchestrator maps these to `AppError` at that
  point, the same way `route-handler.ts` already does for `Result`.
- **Provider keys are optional in the env schema**, not required. Ch.14
  §68's own governance gate (only _approved_ models execute) already
  covers "what if a provider isn't configured" — a provider with no key
  simply has no adapter in the registry, which the orchestrator's
  `provider_not_configured` path handles. The app doesn't fail to boot
  because one of three keys is missing.
- **Structured output on Claude is a documented simplification.** OpenAI
  and Groq get real `response_format: json_object` from their SDKs.
  Anthropic has no equivalent — the adapter instructs via the system
  prompt and `JSON.parse()`s the response. Anthropic's forced-tool-use
  pattern is the more robust approach; adopt it once Phase 11 has concrete
  per-agent schemas to force, rather than guessing a shape now.
- **Token counting is a ~4-chars/token heuristic** (`estimateTokenCount`),
  not a real tokenizer (`tiktoken` et al.). Every provider's real usage
  numbers come back from the API response itself
  (`response.usage.*`) and are what's actually recorded to
  `ai_cost_tracking` — the heuristic is only used for the pre-flight
  context-budget check, before a real call has happened.
- **Business memory retrieval is keyword search today**, not the
  embedding-based semantic search Ch.14 §25 describes as the production
  path. It's a real, working implementation of the same
  `BusinessMemoryRepository` interface the orchestrator depends on — swap
  the implementation for a `pgvector` similarity query once real memory
  content and a query-embedding call exist, without touching the
  orchestrator.
- **A real bug, fixed before it shipped**: the memory-search repository
  interpolated a raw query string into a PostgREST `.or()` filter.
  PostgREST's filter mini-language treats `,()` as structural (condition
  separators/grouping), so an unsanitized query could inject additional
  filter conditions. Fixed by stripping non-word characters before
  building the filter — acceptable for a best-effort keyword search,
  caught by re-reading the code rather than by a test (there's no
  practical unit test for "does this string escape a query-builder DSL"
  without re-implementing PostgREST's parser).

## Verified, not just written

```
pnpm typecheck   ✓ (9/9 packages)
pnpm lint        ✓
pnpm test        ✓ (packages/ai: 42 tests, apps/web: +11 orchestrator tests)
pnpm build       ✓ (2 new routes: /api/v1/admin/ai/health, plus existing)
```

Plus direct SQL verification (Docker Postgres, full migration set through
0022): `ai_models`/`ai_kill_switches`/`ai_budgets` all RLS-enforced —
`anon` reads zero rows, an `administrator`-role user reads everything.

## What's deferred (by design)

- All 11 AI employee personas (Product Manager, SEO Specialist, etc.) —
  Phase 11, explicitly excluded from this phase per your canonical
  decision.
- Tool Registry / Tool Invocation Engine, Approval Engine, Task Queue,
  Telegram runtime, multi-agent collaboration (Ch.14 Part 3) — all need
  real agents to mean anything; Phase 11.
- Workflow _execution_ (the `ai_workflow_runs` state machine actually
  running steps) — the tables exist (Phase 3), the workflow **template**
  concept is what "Workflow Engine" refers to in this phase's scope, but
  executing a multi-step workflow is inseparable from agent/tool
  execution, so it's Phase 11 too.
- Semantic memory/knowledge retrieval via `pgvector` — swap-in replacement
  for the keyword-search repository once there's real content to embed.
- Anthropic forced-tool-use structured output — once Phase 11 has concrete
  per-agent output schemas.
- AI Operations dashboard (Ch.14 Part 5) — Phase 8 (Admin Dashboard) UI.
