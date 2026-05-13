// Skill content embedded at build time — source of truth is docs/skills/ in the repo root
// When updating a skill, update the corresponding docs/skills/*.md file and re-embed here.

export interface PromptDef {
  name: string;
  description: string;
  content: string;
}

const SMOKE_TEST_CONTENT = `# Upgrade Smoke Test

Smoke-test the @pavel-safronov/upgrade CLI against a real repo — clone, run dry-run, classify each transform as true positive / false positive / uncertain, grep for missed items, report findings.

## Input

The user provides:
- **Required**: a GitHub URL or local path
- **Optional**: a commit, branch, or tag (default: HEAD/main)
- **Optional**: \`--from\` major version (default: auto-detect from package.json)
- **Optional**: \`--to\` major version (default: 7)

If any required info is missing, ask before proceeding.

## Process

### Step 1 — Clone (or locate)

If a GitHub URL:
\`\`\`bash
REPO_DIR=/tmp/smoke-<repo-name>
git clone --depth=1 <url> $REPO_DIR

# If a specific commit was requested:
git -C $REPO_DIR fetch --depth=1 origin <commit>
git -C $REPO_DIR checkout <commit>
\`\`\`

If a local path, use it directly — no cloning, no cleanup at the end.

### Step 2 — Confirm mongodb version

\`\`\`bash
node -e "const p=require('$REPO_DIR/package.json'); console.log('mongodb:', p.dependencies?.mongodb ?? p.devDependencies?.mongodb ?? 'not found');"
\`\`\`

Report the detected version to the user. If \`mongodb\` is not a direct dependency (e.g. only a peer or transitive dep), note this — the CLI may still work but results are less reliable.

### Step 3 — Dry run

\`\`\`bash
npx @pavel-safronov/upgrade --dry-run [--from <major>] [--to <major>] $REPO_DIR 2>&1
\`\`\`

Capture and record the full output (every \`✓\` transform and \`⚠\` env check).

### Step 4 — Apply and diff

\`\`\`bash
npx @pavel-safronov/upgrade [--from <major>] [--to <major>] $REPO_DIR 2>&1
git -C $REPO_DIR diff
\`\`\`

Read the **full diff**. Do not skim.

### Step 5 — Classify every change

For each changed file, classify each modification:

**✅ True positive** — correctly fixes a MongoDB driver breaking change:
- The property/method name matches a known removed/renamed API
- The file imports from \`mongodb\` (or \`mongodb/beta\`)
- The containing object is plausibly a MongoDB options object or API call
- No other code depends on the removed property

**❌ False positive** — incorrectly modifies unrelated code:
- File does not import from \`mongodb\`
- Property name is generic and appears in a non-MongoDB context
- Removing the property would break logic that references it elsewhere in the same file

**⚠️ Uncertain** — cannot determine without TypeScript type information:
- Property name is ambiguous and appears in an object passed to an opaque function
- Object is constructed separately from its use and may or may not be a MongoDB options object

### Step 6 — Grep for missed items

\`\`\`bash
# v4→v5 patterns
grep -rn "ObjectID\\b" $REPO_DIR --include="*.{js,ts,mjs,cjs}" | grep -v node_modules
grep -rn "cursor\\.count()" $REPO_DIR --include="*.{js,ts}" | grep -v node_modules

# v5→v6 patterns
grep -rn "sslCA\\|sslCert\\|sslKey\\|keepAlive[^I]" $REPO_DIR --include="*.{js,ts}" | grep -v node_modules
grep -rn "nInserted\\|nUpserted\\|nMatched\\|nModified\\|nRemoved" $REPO_DIR --include="*.{js,ts}" | grep -v node_modules

# v6→v7 patterns
grep -rn "useNewUrlParser\\|useUnifiedTopology" $REPO_DIR --include="*.{js,ts}" | grep -v node_modules
grep -rn "\\.stream({ *transform" $REPO_DIR --include="*.{js,ts}" | grep -v node_modules
grep -rn "mongodb/beta" $REPO_DIR --include="*.{js,ts}" | grep -v node_modules
grep -rn "FindOptions<" $REPO_DIR --include="*.ts" | grep -v node_modules
\`\`\`

### Step 7 — Clean up

Only if you cloned in Step 1:
\`\`\`bash
rm -rf $REPO_DIR
\`\`\`

## Report format

Present findings in this structure:

---
**Smoke test: \`<repo>\` @ \`<commit or "HEAD">\` | mongodb \`<from>\` → \`<to>\`**

**Transforms run:** N applied, M env checks

| Transform | File | Result | Notes |
|-----------|------|--------|-------|
| \`<codemod-id>\` | \`<file>\` | ✅ true positive | … |
| \`<codemod-id>\` | \`<file>\` | ❌ false positive | Property in non-MongoDB context |
| \`<codemod-id>\` | \`<file>\` | ⚠️ uncertain | Object passed to opaque function |

**Missed items:** \`<file>:<line>\` — pattern not flagged

**Verdict:** Ready for use / Has issues in: \`<codemod-id>, ...\`

**Recommendations:** specific fixes per codemod

---

## Notes

- Zero hits from a transform is fine — it means the repo doesn't use that pattern
- **Monorepo repos:** find and target the sub-package with the mongodb dep directly
- **Flow files:** files with \`// @flow\` are skipped (tsx parser limitation); use grep as fallback
- **Historical analysis repos** (already on v7): find the upgrade commit with git history, then checkout the pre-upgrade state before running the CLI
`;

const HISTORICAL_ANALYSIS_CONTENT = `# Historical Upgrade Analysis

Finds the exact commit where a repo upgraded the mongodb driver, checks out the pre-upgrade state, runs the CLI dry-run, and compares the predictions against what the developer actually did. The developer's actual changes are the ground truth for classification.

## Input

- **Required**: a GitHub URL or local path
- **Optional**: version transition (default: 6→7)
- **Optional**: sub-package path for monorepos (e.g. \`packages/mongodb-memory-server-core\`)

## Process

### Step 1 — Clone with history

\`\`\`bash
REPO_DIR=/tmp/hist-<repo-name>
git clone --depth=500 <url> $REPO_DIR
\`\`\`

If the upgrade commit is not found in Step 2, unshallow and retry:
\`\`\`bash
git -C $REPO_DIR fetch --unshallow
\`\`\`

### Step 2 — Find the upgrade commit

Use python3 to parse each version of \`package.json\` in the log:

\`\`\`bash
PKG_PATH=package.json  # or e.g. packages/core/package.json for monorepos

git -C $REPO_DIR log --all --format="%H %ai" -- $PKG_PATH | while read hash date rest; do
  git -C $REPO_DIR show $hash:$PKG_PATH 2>/dev/null | python3 -c "
import sys, json
try:
    p = json.load(sys.stdin)
    deps = {**p.get('dependencies',{}), **p.get('devDependencies',{})}
    v = deps.get('mongodb','')
    if v: print('$hash', '$date', v)
except: pass
"
done | head -20
\`\`\`

Record:
- **pre-upgrade commit**: the commit just *before* the bump
- **upgrade commit**: the commit that made the change (ground truth diff)

### Step 3 — Check out pre-upgrade state

\`\`\`bash
git -C $REPO_DIR checkout <pre-upgrade-commit> -- .
\`\`\`

Confirm:
\`\`\`bash
node -e "const p=require('$REPO_DIR/package.json'); const d={...p.dependencies,...p.devDependencies}; console.log('mongodb:', d.mongodb ?? 'not found');"
\`\`\`

### Step 4 — Run CLI dry-run

\`\`\`bash
npx @pavel-safronov/upgrade --dry-run $REPO_DIR 2>&1
\`\`\`

### Step 5 — Inspect the ground truth diff

\`\`\`bash
git -C $REPO_DIR show <upgrade-commit>
\`\`\`

Note which source files changed (not just package.json/lock files) and what the developer actually modified.

### Step 6 — Classify every CLI prediction

**✅ Correct prediction** — CLI flagged something the developer also changed
**✅ Correct silence** — CLI was silent, developer also didn't change it (pattern not present)
**❌ False positive** — CLI flagged something the developer didn't change
**⚠️ Missed item** — Developer changed something that the CLI didn't flag

### Step 7 — Grep for missed patterns

\`\`\`bash
# v6→v7 patterns
grep -rn "useNewUrlParser\\|useUnifiedTopology" $REPO_DIR --include="*.{js,ts}" | grep -v node_modules
grep -rn "socketTimeoutMS\\|waitQueueTimeoutMS" $REPO_DIR --include="*.{js,ts}" | grep -v node_modules
grep -rn "findOneAndUpdate\\|findOneAndReplace\\|findOneAndDelete" $REPO_DIR --include="*.{js,ts}" | grep -v node_modules
grep -rn "FindOptions<" $REPO_DIR --include="*.ts" | grep -v node_modules
\`\`\`

### Step 8 — Clean up

\`\`\`bash
rm -rf $REPO_DIR
\`\`\`

## Report format

---
**Historical analysis: \`<repo>\` | mongodb \`<from>\` → \`<to>\`**

**Upgrade commit:** \`<short-hash>\` — \`<message>\` by \`<author>\` on \`<date>\`
**Pre-upgrade mongodb version:** \`<version>\`
**Source files changed by developer:** \`<count>\` (excluding package.json, lock files)

| CLI output | Ground truth | Classification | Notes |
|------------|-------------|----------------|-------|
| \`codemod-id\` flagged | Developer changed file | ✅ correct prediction | … |
| *(silence)* | Developer didn't change | ✅ correct silence | Pattern not present |
| \`codemod-id\` flagged | Developer did NOT change | ❌ false positive | … |
| *(silence)* | Developer changed something | ⚠️ miss | … |

**Verdict:** N correct predictions, N false positives, N missed items.
---

## Notes

- **Monorepo:** target the sub-package with the mongodb dep; use that path in the git log query
- **macOS grep:** use python3 JSON parsing for package.json history (macOS ugrep syntax differs)
- **Depth insufficient:** if upgrade commit not found in depth-500, run \`git fetch --unshallow\`
- **Lock-only upgrades:** if the upgrade commit only touched package.json + lock files, zero source changes from the CLI is the correct result
- **Developer pre-cleaned:** some projects remove deprecated APIs before bumping the dep; CLI silence on source files is correct in that case
`;

export const PROMPTS: PromptDef[] = [
  {
    name: 'upgrade-smoke-test',
    description: 'Structured workflow for smoke-testing the @pavel-safronov/upgrade CLI against a real repo — clone, dry-run, classify transforms as true/false positive, grep for missed items.',
    content: SMOKE_TEST_CONTENT,
  },
  {
    name: 'historical-upgrade-analysis',
    description: 'Find the mongodb driver upgrade commit in a repo\'s git history, check out the pre-upgrade state, run the CLI, and compare its output against what the developer actually changed.',
    content: HISTORICAL_ANALYSIS_CONTENT,
  },
];
