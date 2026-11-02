# termlog — Build Report

MCP Rebuild 1000, Batch 12. Original program build from the
packages-100 plan (cluster C #38: "Terminal session to clean,
shareable markdown. Redacts secrets patterns by default."),
built from the spec in
`~/workspace/mcp-rebuild-100/specs-batch12/termlog.md`. There is
no external original; the fixture is the program's defined
spec. Local build only — nothing pushed or published.

Identity: repo `termlog`, npm `@reneturcios/termlog`, MCP name
`io.github.CloudCorpRecords/termlog`, version `0.1.0`, bin
`termlog` → `dist/cli.js`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json`, `server.json` (description "Turn a raw
  terminal session into clean, shareable Markdown, redacting
  secret patterns by default.", 97 chars ≤100; npm entry
  carries `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/termlog:0.1.0` carries **no**
  `version` field), `Dockerfile` (node:20-alpine two-stage,
  label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/termlog"`),
  `tsconfig.json`, `.gitignore`, `LICENSE` (MIT, Copyright (c)
  2026 Rene Turcios), `README.md` (fresh text), `CHANGELOG.md`
  (single 0.1.0 entry, 2026-10-27), `package-lock.json`
  (Route 3, see below)
- `src/index.ts`, `src/cli.ts` (`clean --input <path>
  [--no-redact]`, `mcp`, `--version`; exit 2 usage / 1 runtime
  error), `src/mcp.ts`, `src/types.ts`, `src/termlog.ts` (core,
  `VERSION = "0.1.0"`)
- `test/termlog.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (publish-container IMAGE = `ghcr.io/cloudcorprecords/termlog`)

## Tools implemented (1)

- `clean_terminal_log` — `text` (string, required),
  `redact` (boolean, optional, default true — stated in the
  schema description only; no JSON `"default"` key). The
  fixture literal and the `src/mcp.ts` literal are identical,
  with no `additionalProperties` and no `$schema`.
  Missing `text` → `isError`.

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with explicit
  inputSchema literals exactly matching the fixture, per the
  standing fleet rule; zod still validates every `tools/call`.
- The core applies the five steps in the spec's exact order:
  (1) ANSI removal — CSI, OSC (BEL or ESC-\ terminated), and
  two-character escapes (ESC + intermediate + final char for
  the ()%# charset families, ESC + one char otherwise), every
  removed sequence counted; (2) per line, a trailing `\r` is
  dropped first, then only the segment after the last
  remaining `\r` is kept; (3) trailing spaces/tabs stripped;
  (4) redaction passes in pattern order — private_key (BEGIN/
  END headers must carry the same leading words), aws_access_key
  (`AKIA` + 16 of [0-9A-Z]), github_token (`gh` + one of
  p/o/u/s/r + `_` + 20+ alphanumerics), bearer (word's original
  casing preserved), kv_secret (key and separator preserved,
  quotes dropped) — one single pass per pattern, replacements
  never re-scanned by their own pattern; (5) 3+ newlines
  collapse to exactly 2 and edge blank lines are trimmed.
- Output: `{markdown, redactions, stats}`; markdown is the
  cleaned text in a ```console fence (`"```console\n```"` when
  the cleaned text is empty); redactions lists only kinds
  with count > 0, in pattern order; stats are
  `{input_lines, output_lines, ansi_sequences_removed,
  total_redactions}`.
- Local choice: line counts split on `\n`, with the empty
  text counted as 0 lines (a wholly empty session has no
  lines); the spec only pins the split rule and the empty
  markdown shape, both of which are honoured.

## Verification (foreground, this session)

- `npx tsc` exit 0 (`dist/cli.js` built)
- `npm test`: **18 tests, 18 pass, 0 fail** — CSI stripping +
  count, OSC (BEL and ESC-\ terminations) + count, charset
  and single escapes, CR overwrite (segment after last `\r`),
  trailing-`\r` drop, trailing-whitespace strip, each
  redaction kind with counts (private-key block, AWS ×2,
  GitHub token, Bearer casing preserved, kv quoted + bare),
  redaction kinds reported in pattern order, the pattern-order
  interaction (an AKIA string inside a private-key block
  counts once as private_key), redact:false path, blank-line
  collapse + edge trim, empty text, fence shape + line counts,
  missing-text rejection
- `dist/cli.js --version` → `0.1.0`; unknown command exits 2
  with usage; `clean` on a sample log redacts by default and
  leaves the key visible with `--no-redact`; a missing input
  file exits 1
- Parity: `harness/parity.py` vs
  `harness/fixtures/termlog-tools-original.json` →
  **PASS, parity 100.0, identical_tools 1/1**

## Lockfile status

`package-lock.json` generated clean via Route 3 (temp copy
with only `package.json`, offline `npm install
--package-lock-only --ignore-scripts --offline`), verified:
parses, name `@reneturcios/termlog`, **128 package entries**.
Local `node_modules` was installed offline in place for the
build/test run and is gitignored.

## Gaps / honest notes

- Unterminated OSC sequences are not spec'd; the ESC is
  removed as a two-character escape and the body text remains.
  All spec'd terminations (BEL, ESC-\) are handled and tested.
- Container build not exercised locally; the
  publish-container workflow smoke-tests the image at publish
  time.
