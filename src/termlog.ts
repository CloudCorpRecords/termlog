/**
 * termlog core: clean a raw terminal session into shareable
 * markdown, redacting secret patterns by default.
 *
 *   cleanTerminalLog(text, redact = true) -> {markdown, redactions, stats}
 *
 * The five steps run in exactly this order:
 *
 * 1. ANSI removal — CSI sequences (ESC [ ... final byte @-~),
 *    OSC sequences (ESC ] ... ended by BEL or ESC \), and
 *    two-character escapes: ESC plus one intermediate char and
 *    one final char for the ()%# charset families, ESC plus a
 *    single char otherwise. Every removed sequence is counted
 *    in stats.ansi_sequences_removed.
 * 2. Carriage returns — within each line (split on \n), keep
 *    only the segment after the LAST \r (progress-bar overwrite
 *    semantics). A trailing \r at end of line is dropped first,
 *    with no other effect.
 * 3. Trailing whitespace — trailing spaces/tabs stripped from
 *    each line.
 * 4. Redaction (only when redact is true), one single pass per
 *    pattern, in this order; replacement text is never
 *    re-scanned by its own pattern:
 *      private_key    -----BEGIN <words> PRIVATE KEY----- ...
 *                     -----END <words> PRIVATE KEY----- block
 *                     (spanning lines) -> [REDACTED:private_key]
 *      aws_access_key AKIA + 16 chars of [0-9A-Z]
 *      github_token   gh + one of p/o/u/s/r + _ + 20+ [A-Za-z0-9]
 *      bearer         Bearer (any casing) + whitespace + a
 *                     non-space token of 8+ chars; the word's
 *                     original casing is preserved
 *      kv_secret      a (password|passwd|secret|token|api[_-]?key)
 *                     key (any casing) + = or : + optional
 *                     whitespace + a double-quoted, single-quoted,
 *                     or bare 4+ char value; key and separator
 *                     are preserved, quotes are dropped
 * 5. Blank-line collapse — 3+ consecutive newlines become
 *    exactly 2; leading and trailing blank lines are trimmed.
 *
 * Pure local text transform: no network, no files, nothing is
 * fetched or guessed.
 */
import type { RedactionCount, RedactionKind, TermlogResult } from "./types.js";

export const VERSION = "0.1.0";

/** Step 1: remove ANSI escape sequences, counting each removal. */
function stripAnsi(input: string): { text: string; removed: number } {
  let removed = 0;
  const count = () => {
    removed += 1;
    return "";
  };
  let text = input;
  // CSI: ESC [ parameter/intermediate bytes, final byte @-~.
  text = text.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, count);
  // OSC: ESC ] ... terminated by BEL or by ESC \.
  text = text.replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g, count);
  // Charset escapes: ESC + one of ()%# + one final char.
  text = text.replace(/\u001b[()#%][\s\S]/g, count);
  // Any remaining two-character escape: ESC + a single char.
  text = text.replace(/\u001b[\s\S]/g, count);
  return { text, removed };
}

/** Steps 2-3: per-line CR overwrite semantics, then trailing-whitespace strip. */
function cleanLines(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      let out = line;
      // A trailing \r is dropped with no other effect.
      if (out.endsWith("\r")) out = out.slice(0, -1);
      // Keep only the segment after the last remaining \r.
      const idx = out.lastIndexOf("\r");
      if (idx >= 0) out = out.slice(idx + 1);
      return out.replace(/[ \t]+$/, "");
    })
    .join("\n");
}

interface RedactionPass {
  kind: RedactionKind;
  pattern: RegExp;
  replacement: (match: string, ...groups: string[]) => string;
}

const REDACTION_PASSES: RedactionPass[] = [
  {
    kind: "private_key",
    // The END header must carry the same leading words as BEGIN.
    pattern:
      /-----BEGIN ((?:[A-Z0-9]+ )*)PRIVATE KEY-----[\s\S]*?-----END \1PRIVATE KEY-----/g,
    replacement: () => "[REDACTED:private_key]",
  },
  {
    kind: "aws_access_key",
    pattern: /AKIA[0-9A-Z]{16}/g,
    replacement: () => "[REDACTED:aws_access_key]",
  },
  {
    kind: "github_token",
    pattern: /gh[pousr]_[A-Za-z0-9]{20,}/g,
    replacement: () => "[REDACTED:github_token]",
  },
  {
    kind: "bearer",
    pattern: /(Bearer)\s+\S{8,}/gi,
    replacement: (_match, word: string) => `${word} [REDACTED:bearer]`,
  },
  {
    kind: "kv_secret",
    pattern:
      /\b((?:password|passwd|secret|token|api[_-]?key)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|\S{4,})/gi,
    replacement: (_match, head: string) => `${head}[REDACTED:kv_secret]`,
  },
];

/** Step 4: apply the redaction passes in order, counting per kind. */
function redactText(text: string): { text: string; redactions: RedactionCount[] } {
  const redactions: RedactionCount[] = [];
  let out = text;
  for (const pass of REDACTION_PASSES) {
    let count = 0;
    out = out.replace(pass.pattern, (match: string, ...groups: unknown[]) => {
      count += 1;
      return pass.replacement(match, ...(groups as string[]));
    });
    if (count > 0) redactions.push({ kind: pass.kind, count });
  }
  return { text: out, redactions };
}

/** Line count by splitting on \n; the empty text has zero lines. */
function lineCount(text: string): number {
  return text === "" ? 0 : text.split("\n").length;
}

/** Clean one raw terminal session. `text` is required; empty is valid. */
export function cleanTerminalLog(text: unknown, redact?: unknown): TermlogResult {
  if (typeof text !== "string") throw new Error("text is required");
  const doRedact = redact === undefined ? true : redact;
  if (typeof doRedact !== "boolean") throw new Error("redact must be a boolean");

  const input_lines = lineCount(text);

  // Steps 1-3.
  const ansi = stripAnsi(text);
  let cleaned = cleanLines(ansi.text);

  // Step 4.
  let redactions: RedactionCount[] = [];
  if (doRedact) {
    const redacted = redactText(cleaned);
    cleaned = redacted.text;
    redactions = redacted.redactions;
  }

  // Step 5: collapse 3+ newlines to exactly 2; trim edge blank lines.
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "").replace(/\n+$/, "");

  const total_redactions = redactions.reduce((sum, r) => sum + r.count, 0);
  const markdown =
    cleaned === "" ? "```console\n```" : "```console\n" + cleaned + "\n```";

  return {
    markdown,
    redactions,
    stats: {
      input_lines,
      output_lines: lineCount(cleaned),
      ansi_sequences_removed: ansi.removed,
      total_redactions,
    },
  };
}

/** Render a payload as the JSON text block MCP clients show. */
export function formatPayload(payload: unknown): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}
