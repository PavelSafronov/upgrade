# Demo Script — MongoDB Upgrade Toolkit

**Target time: ~2:30**  
**Terminal font size: large. Prereqs: repo cloned, `npm install` done, internet access for `npx`.**

---

## Setup (before presenting)

```bash
# Reset test app to "before" state
git checkout **-**- packages/test-app-v6/
```

---

## 1. The problem (20 s — spoken, no typing)

> "There are 44 repos on npm that still depend on mongodb v4, v5, or v6. Upgrading is painful — there are 3 separate migration guides, dozens of breaking changes, and no tooling to apply them automatically. This is the toolkit that fixes that."

---

## 2. Show the test app (15 s)

```bash
cat packages/test-app-v6/src/index.ts
```

> "Here's a v6 app. It uses a bunch of deprecated APIs — `cursor.stream({ transform })`, deprecated client options, `findOneAndUpdate` return-value patterns, a low Node version. Normally you'd fix these by hand."

---

## 3. Dry run (25 s)

```bash
npx @pavel-safronov/upgrade packages/test-app-v6 --dry-run
```

> "The CLI detects v6, plans the v6→v7 hop, and tells us exactly what it would change — per file, per codemod. Nothing written yet."

---

## 4. Apply (20 s)

```bash
npx @pavel-safronov/upgrade packages/test-app-v6
git diff packages/test-app-v6/
```

> "One command. Mechanical transforms applied automatically. Semantic issues — the ones that need a human — got TODO comments with migration notes inline. The Node version and package.json dep bump are done too."

---

## 5. ESLint plugin (20 s)

```bash
cd packages/test-app-v6
npx eslint src/ --rulesdir ../../eslint-plugin/dist --rule '{"mongodb-upgrade/no-stream-transform-option": "error"}' 2>/dev/null | head -10
cd ../..
```

> "The ESLint plugin catches the same patterns in your lint pipeline, so regressions don't creep back in after the upgrade."

---

## 6. MCP / agent loop (25 s — spoken while showing Claude Code sidebar or terminal)

> "For AI agents, there's an MCP server. It exposes four tools: analyze, apply, explain, and verify. An agent can call `analyze_repo` to get a dry-run breakdown, `explain_breaking_change` to understand a specific change, `apply_codemod` to apply it, and `verify_upgrade` to run the test suite and confirm nothing broke — all without reading a migration guide."

*(Show `.claude/settings.json` MCP config if time allows)*

---

## 7. GitHub Action (15 s — show file, no typing)

```bash
cat .github/workflows/example-mongodb-upgrade.yml
```

> "And there's a GitHub Action. Schedule it monthly. If there's an upgrade to do, it opens a PR automatically with the full diff and a review checklist."

---

## 8. Wrap (10 s — spoken)

> "Three packages, published on npm at v0.2.0. The CLI covers 28 codemods across v4→v5→v6→v7, validated against 10 real-world repos. The whole thing is open source. And — on the Skunkworks theme — every line of code in this repo was written by Claude. I described what I wanted; Claude designed, implemented, tested, and debugged all of it."

---

## Fallback if something breaks

- **CLI crashes**: show the dry-run output from `docs/smoke-tests/automattic-mongoose.md` — real output, no live execution needed.
- **ESLint step fails**: skip it, mention it exists, move on.
- **MCP step**: show the `.claude/settings.json` config and describe the tool list verbally.
