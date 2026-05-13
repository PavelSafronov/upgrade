---
name: historical-upgrade-analysis
description: Find the mongodb driver upgrade commit in a repo's git history, check out the pre-upgrade state, run the CLI, and compare its output against what the developer actually changed. Use when Pavel wants to validate CLI accuracy against a real upgrade decision.
---

# Historical Upgrade Analysis

Finds the exact commit where a repo upgraded the mongodb driver, checks out the pre-upgrade state, runs the CLI dry-run, and compares the predictions against what the developer actually did. The developer's actual changes are the ground truth for classification.

## Input

- **Required**: a GitHub URL or local path
- **Optional**: version transition (default: 6→7)
- **Optional**: sub-package path for monorepos (e.g. `packages/mongodb-memory-server-core`)

If any required info is missing, ask before proceeding.

## Process

### Step 1 — Clone with history

```bash
REPO_DIR=/tmp/hist-<repo-name>
git clone --depth=500 <url> $REPO_DIR
```

Depth 500 is usually enough. If the upgrade commit is not found in Step 2, unshallow and retry:

```bash
git -C $REPO_DIR fetch --unshallow
```

### Step 2 — Find the upgrade commit

Use python3 to parse each version of `package.json` in the log. Adjust the version filter to match the transition (e.g. `6` → `7`):

```bash
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
```

Read the output to find the commit where the version changes from `^6.x` to `^7.x` (or whichever transition). Record:
- **pre-upgrade commit**: the commit just *before* the bump (this is where we want the working tree)
- **upgrade commit**: the commit that made the change (this is the ground truth diff)

Show the commit metadata:

```bash
git -C $REPO_DIR show --stat <upgrade-commit>
```

### Step 3 — Check out pre-upgrade state

```bash
TARGET_DIR=$REPO_DIR  # or $REPO_DIR/packages/core for monorepos

git -C $REPO_DIR checkout <pre-upgrade-commit> -- .
```

Confirm the mongodb version is what we expect:

```bash
node -e "const p=require('$TARGET_DIR/package.json'); const d={...p.dependencies,...p.devDependencies}; console.log('mongodb:', d.mongodb ?? 'not found');"
```

### Step 4 — Run CLI dry-run

```bash
npx @pavel-safronov/upgrade --dry-run $TARGET_DIR 2>&1
```

Capture the full output (every transform applied/flagged and every env check).

### Step 5 — Inspect the ground truth diff

```bash
git -C $REPO_DIR show <upgrade-commit>
```

Read the **full diff**. Note:
- Which source files changed (`.js`, `.ts` — not just `package.json`, `yarn.lock`)
- What the developer actually modified: removed options, changed method calls, added `TODO` comments, etc.
- What the developer left alone (important: absence of changes means the pattern wasn't present, or they judged it fine)

### Step 6 — Classify every CLI prediction

Compare CLI output to the ground truth diff:

**✅ Correct prediction** — CLI flagged or applied something the developer also changed:
- CLI flagged `find-one-options` → developer removed `batchSize` from FindOneOptions → ✅

**✅ Correct silence** — CLI produced no output on something the developer also didn't change:
- CLI didn't flag `useNewUrlParser` → developer didn't touch it either → ✅ (pattern wasn't present)

**❌ False positive** — CLI flagged or applied something the developer didn't change (and shouldn't have):
- CLI removed `contentType` from an HTTP options object → developer didn't touch it → ❌

**⚠️ Missed item** — Developer changed something that the CLI didn't flag:
- Developer added `includeResultMetadata: true` to `findOneAndUpdate` calls → CLI didn't flag them → ⚠️ miss

**⚠️ Uncertain** — Developer changed something, CLI was silent, but it's unclear if our CLI should have caught it:
- Developer removed a custom option from a wrapper that routes to the driver internally

Note: purely mechanical transforms in source (things the developer did by hand that we automate) are not misses — they're wins. If the developer manually removed `useNewUrlParser` but our CLI would have done it automatically, that's fine.

### Step 7 — Grep for missed patterns

Check for patterns the CLI should catch but may have missed:

```bash
# v6→v7 patterns
grep -rn "useNewUrlParser\|useUnifiedTopology" $TARGET_DIR --include="*.{js,ts}" | grep -v node_modules
grep -rn "\.stream({ *transform" $TARGET_DIR --include="*.{js,ts}" | grep -v node_modules
grep -rn "mongodb/beta" $TARGET_DIR --include="*.{js,ts}" | grep -v node_modules
grep -rn "FindOptions<" $TARGET_DIR --include="*.ts" | grep -v node_modules
grep -rn "socketTimeoutMS\|waitQueueTimeoutMS" $TARGET_DIR --include="*.{js,ts}" | grep -v node_modules
grep -rn "batchSize.*1000\|1000.*batchSize" $TARGET_DIR --include="*.{js,ts}" | grep -v node_modules
grep -rn "findOneAndUpdate\|findOneAndReplace\|findOneAndDelete" $TARGET_DIR --include="*.{js,ts}" | grep -v node_modules

# v5→v6 patterns
grep -rn "sslCA\|sslCert\|sslKey\|keepAlive[^I]" $TARGET_DIR --include="*.{js,ts}" | grep -v node_modules
grep -rn "nInserted\|nUpserted\|nMatched\|nModified\|nRemoved" $TARGET_DIR --include="*.{js,ts}" | grep -v node_modules
grep -rn "db\.addUser\|collection\.stats()" $TARGET_DIR --include="*.{js,ts}" | grep -v node_modules
```

### Step 8 — Clean up

```bash
rm -rf $REPO_DIR
```

## Report format

Present findings in this structure:

---
**Historical analysis: `<repo>` | mongodb `<from>` → `<to>`**

**Upgrade commit:** `<short-hash>` — `<message>` by `<author>` on `<date>`
**Pre-upgrade mongodb version:** `<version>`
**Source files changed by the developer:** `<count>` (excluding package.json, lock files)

**CLI output (dry-run):**
```
<paste full CLI output>
```

**Comparison table:**

| CLI output | Ground truth | Classification | Notes |
|------------|-------------|----------------|-------|
| `codemod-id` flagged in `file.ts` | Developer changed `file.ts` | ✅ correct prediction | … |
| `env-check` bumped dep | Developer bumped dep | ✅ correct prediction | … |
| `codemod-id` flagged in `file.ts` | Developer did NOT change `file.ts` | ❌ false positive | … |
| *(silence)* | Developer removed `useNewUrlParser` | ⚠️ miss | CLI should have caught this |
| *(silence)* | Developer didn't change source | ✅ correct silence | Pattern not present |

**Missed patterns (from grep):** list any

**Verdict:** `<number>` correct predictions, `<number>` false positives, `<number>` missed items.

**Recommendations:**
- Any codemod improvements suggested by findings

---

## Notes

- **Monorepo repos:** find the sub-package with the mongodb dep; use that path as `$TARGET_DIR` and use the sub-package's `package.json` path in the git log query
- **Depth insufficient:** if the upgrade commit isn't found in depth-500 history, run `git fetch --unshallow`
- **Flow files:** files starting with `// @flow` are skipped by the CLI parser; use grep (Step 7) as the only signal for those files
- **Lock file–only upgrades:** if the upgrade commit only touched `package.json` + lock files (no source changes), that's a valid result — it means the developer judged zero source changes were needed; the CLI should agree
- **Developer pre-cleaned:** some well-maintained projects remove deprecated APIs before officially bumping the dep (e.g. Mongoose); correct silence from the CLI on source files is then the expected result
- **Large merge commits:** upgrade may be embedded in a major-version merge; check the diff carefully — the mongodb bump may be one change among many unrelated ones
- **macOS grep:** use python3-based JSON parsing for `package.json` history (macOS `ugrep` does not support all GNU grep patterns like `^+`)
- **Comparing to upgrade-smoke-test:** the regular smoke-test skill works against current HEAD; use this skill when the repo is already on v7 (or later) and you need the pre-upgrade state from git history
