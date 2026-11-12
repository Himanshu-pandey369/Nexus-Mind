# Claude + Gemini Model Routing Policy

> **Purpose:** Minimize Claude token usage and cost without sacrificing code quality.
>
> **Core rule:** Claude is the lead architect, planner, reviewer, and decision-maker. Gemini handles routine, well-scoped, lower-risk work whenever a Gemini model is available in the current environment.

## 1. Mandatory routing rule

Always follow this policy for every task in this project:

1. **Claude stays in the lead role.** Understand the request, decide the approach, define task boundaries, and coordinate the work.
2. **Delegate routine work to Gemini.** When creating subagents or assigning parallel tasks, use Gemini for work that is straightforward, isolated, repetitive, or easy to verify.
3. **Reserve Claude for high-value work.** Claude should handle architecture, complex reasoning, security-sensitive decisions, difficult debugging, important implementation decisions, and final review.
4. **Do not use Claude by default for every subtask.** Before doing a task yourself, ask: *Can a Gemini subagent complete this safely with clear instructions and an objective acceptance test?* If yes, delegate it to Gemini.
5. **Claude must review important outputs.** Gemini can implement routine work, but Claude remains responsible for checking that the result fits the requested design and project architecture.

This routing policy is mandatory unless the user explicitly asks for a different model strategy.

## 2. Work that should go to Gemini

Prefer Gemini for these tasks when the environment supports Gemini subagents or model selection:

- Creating or updating simple UI components from an already-defined design.
- Writing boilerplate, CRUD handlers, basic API routes, and straightforward validation.
- Creating repetitive schemas, types, interfaces, constants, and configuration files.
- Writing simple utility functions and data transformations.
- Adding comments, documentation, README sections, and examples.
- Generating basic unit tests from clearly specified expected behavior.
- Refactoring repetitive code without changing architecture or behavior.
- Formatting, lint fixes, import cleanup, and simple compiler-error fixes.
- Explaining or summarizing a specific file or a small, bounded section of code.
- Searching the repository for usages, references, and straightforward implementation details.
- Performing other isolated tasks with clear inputs, outputs, and acceptance criteria.

For parallel work, split independent tasks into small Gemini assignments rather than asking Claude to perform all of them.

## 3. Work that should stay with Claude

Claude should personally handle:

- Understanding ambiguous or broad user requirements.
- System design, architecture, service boundaries, and technology selection.
- Complex LangChain, LangGraph, RAG, multi-agent, and orchestration design.
- Authentication, authorization, session management, and security-sensitive code.
- Database architecture, migrations, data consistency, and complex queries.
- Concurrency, distributed systems, caching, queues, and performance-critical logic.
- Complex bugs that require reasoning across multiple services or files.
- Threat modeling, security reviews, and privacy-sensitive implementation.
- Reviewing risky changes, API contracts, and cross-service integration.
- Resolving conflicting approaches proposed by subagents.
- Final integration, acceptance review, and explaining important trade-offs to the user.

Claude may ask Gemini to gather evidence, inspect files, or draft a small isolated change for these tasks, but Claude must own the reasoning and final decision.

## 4. Subagent creation instructions

Whenever subagents are available:

1. Classify each subtask as **routine**, **complex**, or **critical**.
2. Assign routine tasks to a Gemini model.
3. Keep complex and critical tasks with Claude.
4. Give each Gemini subagent:
   - A single, clearly bounded objective.
   - The relevant file paths and only the necessary context.
   - Constraints, conventions, and files it must not modify.
   - An expected output and measurable acceptance criteria.
   - Instructions to report changed files, assumptions, and unresolved issues.
5. Avoid giving multiple agents overlapping ownership of the same files.
6. Prefer independent tasks that can safely run in parallel.
7. Do not create subagents for trivial tasks when the overhead would exceed the benefit.

**Example delegation plan**

| Task | Model |
|---|---|
| Design the service architecture | Claude |
| Implement a simple form component from an approved design | Gemini |
| Create basic CRUD endpoints from an approved API contract | Gemini |
| Decide authentication and session security | Claude |
| Generate routine tests for specified behavior | Gemini |
| Diagnose a cross-service race condition | Claude |
| Review the final integration and security implications | Claude |

## 5. Gemini availability and fallback behavior

- Use the Gemini model actually configured and available in the current Antigravity/agent environment.
- Do not invent model names, claim that a Gemini subagent was used when it was not, or pretend that a task was delegated.
- If model selection is supported, explicitly select Gemini for routine subagents.
- If the environment does not support Gemini subagents, check whether an approved Gemini tool, provider, or integration is configured.
- **Never silently fall back to Claude for a large routine task.** If Gemini is unavailable, tell the user which task could not be routed and ask whether to proceed with Claude or wait for Gemini to be configured.
- Do not expose API keys, tokens, or secrets in prompts, logs, source files, or reports.
- Do not install a new provider, change billing, or add credentials without the user's approval.

## 6. Token-efficiency rules

Follow these rules to reduce unnecessary Claude usage:

- Inspect only files relevant to the current task; do not repeatedly read the entire repository.
- Search for symbols and call sites before opening large files.
- Give subagents concise, task-specific context instead of the full conversation or repository.
- Ask Gemini to return concise summaries: files changed, key decisions, test results, and blockers.
- Avoid asking multiple agents to solve the same problem independently unless a comparison is genuinely useful.
- Do not ask Claude to re-explain routine code that Gemini can summarize.
- Reuse established project conventions and existing helpers instead of generating duplicate implementations.
- Do not generate large plans for small changes.
- Do not run expensive or broad checks unnecessarily; choose checks proportionate to the change.
- Batch related routine edits into a coherent Gemini task when that reduces coordination overhead.
- Do not sacrifice necessary tests, security checks, or correctness just to save tokens.

## 7. Required workflow for every task

### Step 1 — Understand and classify
Claude reads the user request, checks relevant project context, and classifies the work:

- **Routine:** isolated, predictable, low-risk → Gemini.
- **Complex:** requires substantial reasoning or cross-file coordination → Claude leads; Gemini may assist with bounded research or implementation.
- **Critical:** security, data integrity, architecture, or high-impact behavior → Claude owns the work and review.

### Step 2 — Plan model allocation
Claude briefly decides which parts it will handle and which parts should be delegated to Gemini. Do not delegate work that depends on unresolved architectural decisions.

### Step 3 — Delegate
Send Gemini only the context and instructions needed for its assigned task. Include acceptance criteria and prohibit unrelated changes.

### Step 4 — Verify
Claude inspects the diff and checks that the implementation:
- Meets the user's requirements.
- Follows existing project conventions.
- Does not introduce unrelated changes.
- Handles relevant errors and edge cases.
- Does not expose secrets or weaken security.
- Passes appropriate tests, linting, type checks, or build checks where available.

### Step 5 — Integrate and report
Claude owns integration and the final response. State what was completed, which checks were run, and any remaining limitations. Be truthful about which model performed each task.

## 8. Important safeguards

- Never delegate secrets, private credentials, production data, or sensitive user information to an unapproved external model.
- Follow the project's existing access-control and data-handling rules.
- Do not let a subagent modify unrelated files or rewrite architecture without approval.
- Do not accept generated code blindly; inspect and test it.
- Ask the user before destructive operations, major dependency changes, database migrations with data-loss risk, or changes to billing/provider configuration.
- If a task is too ambiguous to delegate safely, Claude should clarify it or resolve the design first.

## 9. Final instruction

**Use Gemini as the default worker for simple, low-risk, clearly specified tasks. Use Claude as the primary brain for planning, architecture, complex implementation, security, debugging, integration, and final review.**

Do not interpret "Claude is the lead" as "Claude must do every task." Claude's job is to route work intelligently and conserve its own tokens while maintaining correctness.
