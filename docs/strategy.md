# AI-Assisted Driver Upgrades: A Proposal for the Node MongoDB Driver

**Status:** Draft for internal team review
**Audience:** Node driver team
**TL;DR:** We should ship a two-part upgrade toolkit — a deterministic codemod CLI (`@mongodb-js/upgrade`) and an MCP server (`@mongodb-js/upgrade-mcp`) — together covering both customers who want a one-shot upgrade and customers who already drive their codebases with AI agents. We should *not* build a bespoke agent or web app. Phased rollout starts with v6 → v7, since that's where our active users are and the change surface is smallest.

---

## 1. Why this matters

A non-trivial fraction of `mongodb` npm downloads are still on driver versions that are two or three majors behind current. The path from 4.x to 7.x crosses three major boundaries (callbacks removed in v5, options/methods removed in v6, Node 20.19+ floor and BSON v7 in v7), each of which is individually small but cumulatively a project that customers keep deferring. Per our own docs, the *recommended* path to v7 is staged through v6.21 first, which means the upgrade isn't even a single npm-install away — it's a coordinated multi-hop plan that most customers will not undertake without help.

The business case is straightforward. Stale-version users:

- Don't get the security and bug fixes we ship.
- File support tickets against EOL versions, which costs us engineering and SA time.
- Constrain what we can change in the wire protocol, BSON layer, and option surface — because the longer tails exist, the more pressure there is to keep maintaining bridges.
- Block adjacent upgrades. Mongoose pins to driver majors, so a Mongoose user wanting Mongoose 8 is implicitly forced into a driver upgrade they didn't ask for.

Helping customers move forward is a leverage problem: every customer we help upgrade compounds into less support load, more freedom to deprecate, and faster feature velocity.

## 2. What others are doing

This is now a standard library-owner deliverable. The shortlist of relevant prior art:

- **Vercel AI SDK** ships `npx @ai-sdk/codemod upgrade` and decomposes the transformation per breaking change, per version. Their UX is the closest reference for what we should build first.
- **React, Next.js, Jest, React Router, MSW** all ship codemods on major version upgrades. The pattern is well-understood.
- **OpenRewrite / Moderne** is the gold standard for recipe-based migrations in the JVM ecosystem. Worth studying the *catalog* model — recipes composed from primitives — even though we won't adopt their stack directly.
- **Codemod.com** has commercialized this space. Their current pitch is "Codemod2.0" — a hybrid where deterministic engines handle detection and LLMs handle the squishy transforms — and they're now publishing as an MCP server so coding agents can call them. This is the direction the industry is moving.
- **Mongoose** ships detailed prose migration guides but no codemods. There's an opportunity here for cross-team collaboration; more on this in §7.

The takeaway: we are behind. Not catastrophically — the driver isn't React in terms of churn or scrutiny — but enough that the absence is now noticeable.

## 3. The change surface, bucketed

Our breaking changes from v4.2 → v7.x fall into three categories, and the right technique differs for each.

**Mechanical / syntactic.** Method renames, option renames, removed helpers with one-to-one replacements. Examples: `Collection.insert → insertOne|insertMany`, `Collection.update → updateOne|updateMany`, `Collection.remove → deleteOne|deleteMany`, `addUser → createUser`, `poolSize → maxPoolSize`, `ssl* → tls*`, `MongoError → MongoServerError`. These are AST-tractable. A deterministic codemod handles them at near-100% accuracy, runs offline, costs us nothing per customer, and produces diffs a reviewer can sign off in minutes.

**Semantic.** Changes that require understanding surrounding logic. The big one is the v5 callback removal, where a transformation isn't a swap — it has to thread through error handling, control flow, and sometimes restructure entire functions. Result-shape changes (`updateOne` no longer has `.n`, etc.) are similar: easy to flag, but the fix depends on what the caller does with the result. Cursor-lifetime changes around `for await...of` exits. BSON v7 behavioral shifts. A codemod can *find* and *flag* these reliably; an LLM with codebase context can *rewrite* them.

**Environmental.** Things that live outside JS/TS source: Node version floor in `package.json` and `.nvmrc`, MongoDB server version compatibility, CI matrix entries, Docker base images, TLS configuration in env files and infra manifests, AWS auth flag formats in connection strings. These aren't transforms — they're checks-with-clear-error-messages.

This bucketing isn't academic. It directly drives the architecture: deterministic codemods own bucket 1, an MCP server (or agentic tool) owns bucket 2, and bucket 3 is just a preflight checker plus documentation.

## 4. Recommendation

Ship two products, with a third as a force multiplier:

### 4.1 Primary: `@mongodb-js/upgrade` — deterministic codemod CLI

A `npx`-runnable CLI that:

- Detects the customer's current driver version from `package.json` and lockfile.
- Plans a staged upgrade (e.g. 4.2 → 5.x → 6.21 → 7.x), respecting the team's official recommendation that v7 adopters first land on v6.21.
- Runs one set of codemods per version hop. Each codemod is scoped to a single breaking change, named after it, and individually invocable. Composition follows the AI SDK model: `npx @mongodb-js/upgrade` runs everything; `npx @mongodb-js/upgrade --only=collection-insert-to-insertOne` runs one.
- Bumps `package.json` versions and runs `npm install` at each hop.
- For semantic changes the codemod can't safely transform, it inserts inline TODO comments with a link to the relevant migration note, so the customer (or their agent) can pick them up.
- Emits a structured report: what was changed, what was flagged, what couldn't be reasoned about.

Built on **jscodeshift** for JS/TS AST work plus **ast-grep** for cross-file pattern matching. No LLM in the loop. No network calls beyond `npm install`. Reproducible, auditable, and safe to run in regulated environments.

This is the floor. It must exist regardless of any other decision we make.

### 4.2 Primary: `@mongodb-js/upgrade-mcp` — MCP server for AI agents

An MCP server that exposes upgrade-aware tools to Claude Code, Cursor, Copilot, Windsurf, and any other agent that speaks MCP. Tools include:

- `analyze_repo` — scan a repo, return current driver version, file-by-file breakdown of driver usage, and a migration plan.
- `apply_codemod` — invoke a named codemod from the CLI above. (The MCP server is a thin orchestration layer on top of the CLI; we don't duplicate logic.)
- `explain_breaking_change` — return the canonical explanation, code-before/code-after example, and edge cases for any named breaking change.
- `migrate_callbacks_to_promises` — agent-driven transform for the v5 callback removal, where the agent has the full code context to make sensible choices.
- `verify_upgrade` — run the project's test suite and parse failures, mapping them back to likely migration issues.

The thesis: **we ship the expertise, not the agent.** Our customers already have agents. They're using Claude Code, Cursor, Copilot. Our job is to make those agents instantly competent about MongoDB driver upgrades, not to compete with them. This is the cleanest fulfillment of the "meet customers where they are" goal in the original prompt.

This also keeps us out of the business of operating LLM inference at scale, paying per-token, or arguing with enterprise security teams about which model we send their source code to. The agent is the customer's; the knowledge is ours.

### 4.3 Supporting: `eslint-plugin-mongodb` — continuous deprecation surfacing

A passive ESLint plugin that flags deprecated APIs in-editor with autofixers where possible. This isn't an upgrade tool per se — it's an upstream-of-upgrade tool. The goal is that long before a customer decides to upgrade, their editor has been quietly telling them "this method is going away in v7" for months. By the time the formal upgrade comes around, the surface area has shrunk because new code is already being written against current APIs.

Lower priority than the first two, but cheap and has long-lived value.

### 4.4 What we are *not* building, and why

- **A bespoke web app or hosted upgrade service.** Customers don't want another tool. We'd take on hosting, billing, security review, and SOC2 obligations for marginal benefit over a CLI.
- **A full agentic assistant.** This is what the agents customers already use are for. We'd be reinventing Claude Code or Cursor with worse UX.
- **A pure LLM-driven transformer.** Non-deterministic, expensive, and unacceptable to customers in regulated industries. The deterministic codemod handles ~70% of the work; LLM use should be reserved for the cases where it's actually necessary, and even then via the customer's own agent.
- **Anything that requires customers to send us their source code.** Hard line. Local execution only for the CLI; MCP server runs in the customer's process or container.

## 5. Distribution

The CLI gets distributed three ways, in priority order:

The default install path is `npx @mongodb-js/upgrade`, zero-install, runnable from any terminal. This is the path linked from our upgrade docs.

A **GitHub Action** wraps the CLI, opens a PR with the diffs and the structured report attached. This is how we reach repos that have been touched in months — the Action can be scheduled to run periodically against repos that opt in, surfacing upgrades the team would otherwise never get around to. Renovate and Dependabot can be configured to call the Action for `mongodb` major bumps.

The MCP server publishes to the standard MCP registries and is listed in the connector directories of major agent vendors (we'll need to do partnership outreach for this). Customers add one entry to their agent config and the agent immediately knows how to upgrade their driver.

Beyond those three, there's a distribution channel we *uniquely* own: **Atlas connection logs already tell us what driver versions our customers are running.** We can target an in-product Atlas nudge — "your application is connecting with `mongodb` v4.2; we can help you upgrade" — that no third party could match. This is a stretch goal but worth flagging early; it requires Atlas-team buy-in.

## 6. Phased rollout

The phasing matters because we will not get budget or headcount for everything at once.

**Phase 1 (Q1):** Codemod CLI covering v6 → v7 only. Smallest, most recent change surface; largest active user base. Ship the CLI scaffolding, the version-detection and planning logic, and codemods for the v6 → v7 mechanical changes. Wire it into the docs. This validates the architecture.

**Phase 2 (Q2):** Backfill v5 → v6 and v4 → v5 codemods, including the hard callback-to-Promise transform (with an honest "this one will leave TODOs for you" disclaimer in the report). End of Phase 2 is when we can claim a customer on v4.2 can run one command and end up on v7.

**Phase 3 (Q3):** MCP server. Wraps the CLI, adds the explain/analyze/verify tools. Partnership outreach to agent vendors for registry placement.

**Phase 4 (Q4):** ESLint plugin. Atlas-team conversation about in-product nudges. Cross-team conversation with Mongoose maintainers about whether they want to consume our codemod primitives.

Each phase ships independently. We can stop after any of them and still have shipped something useful.

## 7. Risks and open questions

**The Mongoose problem.** A large share of our user base hits us transitively through Mongoose. Their upgrade story is *their* story, but the driver-level transforms our codemod performs would be just as valuable when invoked from a Mongoose upgrade. We should at minimum talk to the Mongoose team before locking the CLI's public API, so they can call into our primitives if they want to. Worst case we ship in isolation; best case we co-publish.

**Multi-major hops and intermediate state.** Staging through v6.21 means the customer's `node_modules` briefly contains a version they didn't ask for. We need to be explicit about this in the report, and the CLI needs to handle the case where the staged install fails halfway (test failures, dependency conflicts, etc.) — rollback semantics matter.

**LLM context window for the MCP transforms.** The callback-to-Promise transform is the canonical case where a function might span hundreds of lines and pull in surrounding helpers. The MCP tool needs to be smart about what context it surfaces to the agent — too little and the transform is wrong, too much and the agent gets confused. This is a real engineering problem, not a check-the-box.

**Maintenance tax.** Every future major version means new codemods. We need to budget for this as ongoing engineering, not a one-time project. A reasonable rule of thumb: every breaking change in a major release ships with its codemod, written by the engineer making the change. This makes the codemod catalog grow naturally with the driver instead of accumulating debt.

**Telemetry.** We need to know if this is working. Proposed North Star: percentage of monthly `mongodb` npm downloads on a currently-supported major. Secondary: percentage of new Atlas connections from supported driver majors (we can measure this directly). The CLI itself should *not* phone home — that's a trust nuke — but we can infer adoption from public npm and Atlas-side signals.

**The "what if it breaks production?" question.** Will be the first question asked. The answer must be: the CLI produces a diff, not a fait accompli; customers commit to a branch; tests run; the report is honest about what's mechanical versus what needs human judgment. We don't ever silently rewrite logic and ship it.

## 8. What we need

To execute Phase 1 (the only commitment I'm asking for in this doc): one engineer for one quarter, plus periodic review from the rest of the team on the codemod catalog. Phase 1 ships either way; if it lands cleanly and metrics move, Phases 2–4 become budget conversations with real data behind them.

Outside the team, two early conversations: DevRel (for the docs integration and the inevitable launch blog post) and the Mongoose maintainers (for the API-coordination question above).

## 9. Open for discussion

- Is the v6 → v7 starting point right, or should we start at v4 → v5 because that's where the customer pain is loudest?
- Do we ship the CLI from the existing `mongodb` repo (close to the driver, easy to keep in sync) or as a separate `node-mongodb-upgrade` repo (cleaner release cycle)?
- MCP server in TypeScript (matches the rest of our stack) or in whatever the MCP SDK story looks like by the time we ship Phase 3?
- Naming: `@mongodb-js/upgrade` versus `@mongodb-js/driver-upgrade` versus something else.

---

*Comments welcome inline. If we agree on direction, next step is a Phase 1 design doc with the codemod catalog enumerated against the v6 → v7 changelog.*
