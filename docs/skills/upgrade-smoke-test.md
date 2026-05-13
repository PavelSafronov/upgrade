---
name: upgrade-smoke-test
description: Smoke-test the @pavel-safronov/upgrade CLI against a real repo — clone, run dry-run, classify each transform as true positive / false positive / uncertain, grep for missed items, report findings. Use when Pavel asks to "test against", "smoke test", or "run upgrade against" a repo.
---

# Upgrade Smoke Test

## Input

The user provides:
- **Required**: a GitHub URL or local path
- **Optional**: a commit, branch, or tag (default: HEAD/main)
- **Optional**: `--from` major version (default: auto-detect from package.json)
- **Optional**: `--to` major version (default: 7)

If any required info is missing, ask before proceeding.

## Process

### Step 1 — Clone (or locate)

If a GitHub URL:
```bash
REPO_DIR=/tmp/smoke-<repo-name>
git clone --depth=1 <url> $REPO_DIR

# If a specific commit was requested:
git -C $REPO_DIR fetch --depth=1 origin <commit>
git -C $REPO_DIR checkout <commit>
```

If a local path, use it directly — no cloning, no cleanup at the end.

### Step 2 — Confirm mongodb version

```bash
node -e "const p=require('$REPO_DIR/package.json'); console.log('mongodb:', p.dependencies?.mongodb ?? p.devDependencies?.mongodb ?? 'not found');"
```

Report the detected version to the user. If `mongodb` is not a direct dependency (e.g. only a peer or transitive dep), note this — the CLI may still work but results are less reliable.

### Step 3 — Dry run

```bash
npx @pavel-safronov/upgrade --dry-run [--from <major>] [--to <major>] $REPO_DIR 2>&1
```

Capture and record the full output (every `✓` transform and `⚠` env check).

### Step 4 — Apply and diff

```bash
npx @pavel-safronov/upgrade [--from <major>] [--to <major>] $REPO_DIR 2>&1
git -C $REPO_DIR diff
```

Read the **full diff**. Do not skim.

### Step 5 — Classify every change

For each changed file, classify each modification:

**✅ True positive** — correctly fixes a MongoDB driver breaking change:
- The property/method name matches a known removed/renamed API
- The file imports from `mongodb` (or `mongodb/beta`)
- The containing object is plausibly a MongoDB options object or API call
- No other code depends on the removed property

**❌ False positive** — incorrectly modifies unrelated code:
- File does not import from `mongodb`
- Property name is generic (`limit`, `contentType`, etc.) and appears in a non-MongoDB context (HTTP handler, bodyParser, jQuery Ajax, pagination, etc.)
- Removing the property would break logic that references it elsewhere in the same file
- The object is clearly not a MongoDB options object (e.g. `$.ajax({ contentType: false })`)

**⚠️ Uncertain** — cannot determine without TypeScript type information:
- Property name is ambiguous and appears in an object passed to an opaque function
- Object is constructed separately from its use and may or may not be a MongoDB options object

### Step 6 — Grep for missed items

Check whether the CLI missed anything it should have caught. Adjust the patterns to the version being tested:

```bash
# v4→v5 patterns
grep -rn "ObjectID\b" $REPO_DIR --include="*.{js,ts,mjs,cjs}" | grep -v node_modules
grep -rn "cursor\.count()" $REPO_DIR --include="*.{js,ts}" | grep -v node_modules
grep -rn "slaveOk\|promiseLibrary\|keepGoing" $REPO_DIR --include="*.{js,ts}" | grep -v node_modules

# v5→v6 patterns
grep -rn "sslCA\|sslCert\|sslKey\|keepAlive[^I]" $REPO_DIR --include="*.{js,ts}" | grep -v node_modules
grep -rn "nInserted\|nUpserted\|nMatched\|nModified\|nRemoved" $REPO_DIR --include="*.{js,ts}" | grep -v node_modules

# v6→v7 patterns
grep -rn "useNewUrlParser\|useUnifiedTopology" $REPO_DIR --include="*.{js,ts}" | grep -v node_modules
grep -rn "\.stream({ *transform" $REPO_DIR --include="*.{js,ts}" | grep -v node_modules
grep -rn "mongodb/beta" $REPO_DIR --include="*.{js,ts}" | grep -v node_modules
grep -rn "FindOptions<" $REPO_DIR --include="*.ts" | grep -v node_modules
```

Note any hits that should have been caught but weren't.

### Step 7 — Clean up

Only if you cloned in Step 1:
```bash
rm -rf $REPO_DIR
```

## Report format

Present findings in this exact structure:

---
**Smoke test: `<repo>` @ `<commit or "HEAD">` | mongodb `<from>` → `<to>`**

**Transforms run:** N applied, M env checks

| Transform | File | Result | Notes |
|-----------|------|--------|-------|
| `<codemod-id>` | `<file>` | ✅ true positive | … |
| `<codemod-id>` | `<file>` | ❌ false positive | Property `limit` in bodyParser call, unrelated to MongoDB |
| `<codemod-id>` | `<file>` | ⚠️ uncertain | Object passed to opaque function, can't tell if it's FindOneOptions |

**Missed items:** `<file>:<line>` — `cursor.count()` not flagged (no-cursor-count should catch this)

**Verdict:** Ready for use / Has issues in: `<codemod-id>, ...`

**Recommendations:**
- `<codemod-id>`: <specific fix — e.g. "add mongodb import guard", "remove `limit` from REMOVED_OPTIONS">
---

## Notes

- If the repo has no `src/` directory, search from the repo root (excluding `node_modules`)
- Zero hits from a transform is fine — it means the repo doesn't use that pattern
- If *all* transforms produce zero hits, check that the source files actually `import from 'mongodb'` — the CLI guards on this
- Pay attention to file paths: `lib/scripts/*.js` are often browser-side bundles that don't import from mongodb even if the project does elsewhere
- The upgrade report JSON is saved to `upgrade-report.json` in the repo root — read it for structured data if the CLI output is hard to parse
