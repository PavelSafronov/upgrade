# Handoff: AI-Assisted MongoDB Node Driver Upgrade Project

**For:** the next Claude session (likely Claude Code in VS Code)
**From:** Claude Desktop conversation, [date of this handoff]
**Workspace context:** This file sits alongside `mongodb-node-driver-upgrade-strategy.md`. Read that doc first — it has the full reasoning. This file is the short version plus the loose ends.

---

## What this project is

The user is on the Node MongoDB Driver team at MongoDB. They want to help customers upgrade from old driver versions (e.g. 4.2) to current (7.x) using AI-assisted tooling, and meet customers where they are — inside their existing toolchains. The end deliverable of the strategy phase is the markdown doc next to this one. Implementation is the next phase, scope TBD by the user.

## Decisions already made (don't relitigate these)

- **Two anchor products, in this order:**
  1. `@mongodb-js/upgrade` — deterministic codemod CLI (jscodeshift + ast-grep, no LLM)
  2. `@mongodb-js/upgrade-mcp` — MCP server that exposes upgrade-aware tools to whatever agent the customer already uses (Claude Code, Cursor, Copilot, Windsurf)
- **`eslint-plugin-mongodb`** as a supporting play for continuous deprecation surfacing.
- **No bespoke web app, no hosted upgrade service, no full agentic assistant.** Customers already have agents; we ship knowledge they consult, not another tool.
- **No LLM calls from inside the CLI.** LLM work happens in the customer's agent calling our MCP tools. This keeps the CLI deterministic and acceptable to regulated/enterprise customers.
- **Start with v6 → v7.** Smallest change surface, largest active user base, validates the architecture cleanly before tackling the harder hops.
- **Staged multi-version hops.** Customer on 4.2 going to 7.x goes 4 → 5 → 6.21 → 7, not one big bang. Matches the driver team's own recommendation.
- **Diffs, not faits accomplis.** Every transform produces a reviewable diff and a structured report. Never silently rewrite logic.
- **Audience for the strategy doc is the user's peer team.** Strongly opinionated, not a neutral survey.

## Why those decisions (one-line each)

- *CLI + MCP, not an agent:* leverage over the agents customers already use; smaller surface for us to maintain.
- *Start at v6 → v7:* the loud pain is at the bottom (v4 users) but the active mass is at the top; small surface = fast architecture validation.
- *No LLM in the CLI:* determinism is a hard requirement for the customers we most want to reach.
- *Codemods authored by the engineer who makes the breaking change:* makes the catalog grow with the driver instead of accumulating debt.

## Still open / will need decisions

These were flagged in the strategy doc and aren't resolved:

- Repo layout — codemods live in the main `mongodb` repo or a new `node-mongodb-upgrade` repo?
- Package naming — `@mongodb-js/upgrade` vs `@mongodb-js/driver-upgrade` vs something else?
- Should we *really* start at v6 → v7, or is there a case for v4 → v5 first because that's where customer pain is loudest? (User explicitly invited pushback on this.)
- MCP server stack and SDK choice (Phase 3 problem, but worth thinking about earlier).
- Cross-team coordination: Mongoose maintainers, DevRel, Atlas team. Conversations not started yet.
- Telemetry approach. North Star proposed as "% of monthly npm downloads on a supported major"; secondary signal from Atlas connection logs. CLI itself must not phone home.

## Useful pointers

- **Strategy doc:** `mongodb-node-driver-upgrade-strategy.md` (same folder as this file)
- **Driver upgrade docs:** https://www.mongodb.com/docs/drivers/node/current/reference/upgrade/
- **Driver releases / changelogs:** https://github.com/mongodb/node-mongodb-native/releases
- **`mongodb-legacy` package:** the existing v4-behavior shim for customers easing into v5. Worth being aware of, since the CLI's upgrade plan should know about it as an escape hatch.
- **Reference implementation to study:** Vercel AI SDK's `@ai-sdk/codemod` package — closest analog to what we want to build. Per-version, per-change, composable, honestly scoped (their docs explicitly tell users it won't catch everything).
- **Industry reference:** Codemod.com's "Codemod2.0" model (hybrid deterministic + LLM, MCP-first). Useful design north star even if we don't depend on them.

## Change surface bucketing (cheat sheet)

The strategy doc has this in more detail. Quick version for triage:

- **Mechanical** (codemod handles cleanly): `Collection.insert/update/remove`, `addUser`, `collStats`, `mapReduce`, `poolSize` → `maxPoolSize`, `ssl*` → `tls*`, `MongoError` → `MongoServerError`, deprecated options.
- **Semantic** (codemod flags, LLM-via-agent rewrites): callbacks → Promises (v5), result-shape changes on `updateOne`/`deleteOne`, cursor lifetime on `for await`, BSON v7 behavioral shifts, AWS auth connection-string format change.
- **Environmental** (preflight checks + clear errors, not transforms): Node version floor, MongoDB server version floor, CI matrix entries, Docker base images, env-var-based TLS config.

## Suggested entry points for this session

Pick one — they're roughly in order of "validates the strategy fastest" to "biggest swing":

1. **Enumerate the v6 → v7 codemod catalog.** Read the v7 changelog, list every breaking change, classify each as mechanical / semantic / environmental, and for each mechanical one sketch the jscodeshift transform (before/after examples + AST shape). End product: a markdown table or a `catalog.md` that turns the strategy doc into a Phase 1 design doc.

2. **Scaffold the CLI repo.** TypeScript, jscodeshift + ast-grep, the version-detection logic, the staged-plan logic, the diff/report output. Get to "hello world" — a CLI that detects driver version and prints a plan. No transforms yet.

3. **Prototype one end-to-end codemod.** Pick the easiest v6 → v7 mechanical change, write the jscodeshift transform, write the test fixtures (before/after pairs), wire it into the CLI skeleton. Proves the loop.

4. **Draft the cross-team email to the Mongoose maintainers.** Strategy doc §7 flagged this; getting the conversation started early prevents API-coordination pain later.

5. **Sketch the MCP server tool list.** What tools does `@mongodb-js/upgrade-mcp` expose, what are their signatures, what's the call pattern from an agent? Useful design exercise even though it's Phase 3.

If the user hasn't said which, ask them. Don't pick for them.

## How to start the conversation

A reasonable opening: *"I've read the strategy doc and the handoff. Which of the suggested entry points do you want to tackle first, or did you have a different direction in mind?"*

Don't re-summarize the strategy doc back at the user — they wrote it (with the previous Claude). Just confirm you've absorbed it and move forward.
