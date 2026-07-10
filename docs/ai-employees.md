# AI Employees

Implementation of the canonical roadmap's Phase 11, read against Ch.9
(`09-AI-Business-OS.md`, all 6 parts, §1-137: AI Business OS foundation,
AI Employees Specification, Orchestrator/Memory/Workflow Engine, Business
Knowledge Engine, Weekly Business Operating System, Capability/Tool
Registry & Agent Runtime) and Ch.16 Part 6 (§115-130, AI Business OS
APIs) — all read verbatim in full. Ch.14 (AI Infrastructure) was already
read and largely implemented in Phase 6; this phase is squarely Ch.9's
"AI Employees Specification," which is also this file's own section
title.

## Scope decision: no v1 agent ever writes to production

Ch.9 §28's Agent Permission Matrix has no "Yes" in the Publish or Delete
column for any of the 9 agents it lists, and every per-agent "Forbidden
Actions" section repeats it (Product Manager AI: "Cannot: Publish
Products, Delete Products, Change Prices, Modify Inventory, Create
Offers, Issue Refunds" — and so on for the rest). Confirmed at the
database level too: `admin_create_product` (Phase 8) requires a non-null
`p_base_price`, a field Product Manager AI is explicitly forbidden to
set — so even if an agent wanted to auto-publish, it structurally
couldn't without inventing a price.

So this phase's architecture is: every one of the 11 v1 agents produces
a draft/report via the LLM, that draft lands in the Approval Queue
(`ai_tasks` filtered to `waiting_approval`), and the administrator either
approves it (marking it reviewed — the actual production write, if any,
still happens through the admin tools Phase 8 already built), rejects it,
edits it, or regenerates it. No agent tool call ever reaches a
production-mutating RPC. This isn't a shortcut — it's the literal spec.

## What Phase 6 already built vs. what this phase adds

Phase 6 ("AI Foundation, no employees yet") built the AI Gateway,
`AiOrchestrator` (kill switches, budget enforcement, prompt injection
scanning, prompt assembly, model routing, cost recording), and the model/
prompt/governance/memory repositories — but, per its own code comment in
`orchestrator.ts`, deliberately stopped short of "task planning, agent
selection, tool execution, and the approval queue." This phase is
exactly that remainder, plus one gap Phase 6 left genuinely unfillable
until now: **zero rows existed in `ai_models`**, so every
`AiOrchestrator.execute()` call would have failed with
`no_model_available` regardless of how correct any agent logic was.
Migration 0038 seeds one approved model per configured provider.

## The Capability Registry (`packages/ai/src/agent-registry.ts`)

Ch.9 §115: "The Orchestrator should never know Product Manager AI / SEO
AI / Marketing AI. Instead it only knows Capabilities." `AI_EMPLOYEES` is
that registry — all 11 v1 personas (Product Manager, SEO Specialist,
Blog Writer, Marketing Manager, Inventory Manager, Pricing Analyst,
Analytics Analyst, Customer Insights, Review Manager, Automation
Coordinator, Operations Assistant), each with its purpose, capabilities,
tools, forbidden actions, memory scopes, KPIs, routing policy, system
prompt, and expected JSON output schema. Pure data + a few lookup
functions — no I/O, matching every other module in `packages/ai`.

Migrations 0039 mirrors the same 11 agents into `ai_agents` /
`ai_capabilities` / `ai_tools` / `ai_agent_capabilities` / `ai_agent_tools`
/ `ai_prompts` / `ai_prompt_versions` (all tables Phase 3 already built
and RLS'd, never previously seeded) — so the registry is visible/
queryable through the same tables the Ch.16 Agent/Prompt Registry APIs
describe, not just hardcoded in the TS file.

## Agent Runtime (`apps/web/server/ai/agent-runtime.ts`)

Ch.9 §125's lifecycle ("Receive Task → Validate Permissions → Load
Memory → Load Tools → Execute → Validate → Confidence → Return Result →
Audit"), one level above the orchestrator: resolves an agent by slug,
creates an `ai_tasks` row (`running`), calls `AiOrchestrator.execute()`
with the agent's routing policy and output schema
(`requiresStructuredOutput: true`), and on success always lands the
parsed `{summary, confidence, reasoning, output}` in
`waiting_approval` — never anywhere else. On any orchestration failure
(kill switch, budget, prompt injection, no model, etc.) or invalid JSON
from the model, the task is marked `failed` with the reason recorded.

`AiOrchestrator`'s cost-recording path (`AiRequestInput`,
`AiGovernanceRepository.recordCost`) was extended with optional
`agentId`/`taskId` fields threaded through to `ai_cost_tracking` — the
concrete governance repository already accepted these columns since
Phase 6 (its own comment said "until Phase 11 seeds real agents"); this
phase is what finally passes them.

## Approval Queue

`ai_tasks` filtered to `status = 'waiting_approval'` _is_ the queue —
no separate table exists or is needed. Migration 0040's
`ai_approval_decide` RPC atomically records the decision (`ai_approvals`)
and advances the task status, the same atomicity discipline as every
other multi-table write in this project (`checkout_complete`,
`admin_create_product`, etc.). Verified against real Docker Postgres
data: approve/reject/edit all transition `waiting_approval → completed`
or `→ rejected` correctly (edit merges `editedOutput` into the task's
metadata rather than replacing it), a nonexistent task id is rejected,
and re-deciding an already-terminal task is rejected
(`AI task ... is not awaiting approval`). "Regenerate" has no matching
`ai_approval_decision` value (only `approved`/`rejected`/`edited`/
`deferred` exist) — implemented instead as cancelling the old task and
starting a fresh run of the same agent with the same instructions
(round-tripped through the task's own `metadata.taskInstructions`, set
at creation so it survives independent of the title, which is truncated
to 120 characters for display).

## API surface (Ch.16 §115-130, the subset that matters for a working v1)

| Route                                                                                   | Purpose                                                    |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `GET /api/v1/admin/ai/agents`                                                           | List the 11 employees merged with live task-status counts. |
| `POST /api/v1/admin/ai/agents/{slug}/run`                                               | Queue a task for one agent.                                |
| `GET /api/v1/admin/ai/tasks`                                                            | List tasks, optionally filtered by status.                 |
| `GET /api/v1/admin/ai/approvals`                                                        | The Approval Queue (`waiting_approval` tasks).             |
| `POST /api/v1/admin/ai/approvals/{id}/approve` \| `/reject` \| `/edit` \| `/regenerate` | The four Ch.9 §11 decisions.                               |

Deferred, flagged not silently dropped: Workflow/Knowledge Base/
Embedding/Memory-admin/Provider-management/Cost-analytics/Telegram APIs
(Ch.16 §118, §121-123, §125, §128-130) — real endpoints for these would
mostly surface data Phase 6/8 already expose elsewhere (provider health,
cost tracking) or require infrastructure this v1 explicitly treats as
out of scope (the full Business Knowledge Graph/embeddings pipeline,
Ch.9 Part 4, is "Future Capabilities" per its own §86 and would be a
disproportionate scope addition for a roadmap item titled "AI
Employees"). Business Memory retrieval stays the Phase 6 keyword-search
implementation, documented then as swappable for real embeddings later
without touching its callers.

## Admin UI

`/admin/ai` (rewired from Phase 6's stub): an Employees grid (`Run Task`
dialog per card) above an Approval Queue list (summary, confidence,
draft preview, Approve/Reject/Edit/Regenerate). Both fetch through the
API routes above, matching every other admin page's client-fetch
pattern in this codebase.

## Verification

```
pnpm lint        ✓
pnpm typecheck   ✓ (9/9 packages)
pnpm test        ✓ (packages/ai: 49 tests, apps/web: 88 tests)
pnpm build       ✓ (new routes: /api/v1/admin/ai/{agents,agents/[slug]/run,
                    tasks,approvals,approvals/[taskId]/{approve,reject,edit,regenerate}})
```

All 40 migrations (including 0038-0040) applied clean against a
disposable Docker Postgres, seed counts verified (11 agents, 24
capabilities, 19 tools, 24 agent-capability links, 52 agent-tool links,
11 published prompts, 3 approved models), and the `ai_approval_decide`
RPC exercised with real inserted data: approve, reject, edit (metadata
merge verified), and both of its guard-rail errors (unknown task,
re-deciding a completed task).

Live-verified in Chrome: unauthenticated `/admin/ai` correctly redirects
to `/login?next=%2Fadmin%2Fai`; the underlying API returns a clean 403
JSON envelope (no stack leak) rather than crashing; zero console errors.
Logging in as a real administrator to exercise the Run Task → Approval
Queue flow end-to-end isn't possible in this sandbox (no live Supabase
or LLM provider credentials) — the same limitation documented in every
prior admin-facing phase.
