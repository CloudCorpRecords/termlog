/**
 * termlog types.
 *
 * termlog turns a raw terminal session into clean, shareable
 * markdown. The cleanup is a pure local text transform applied
 * in a fixed order:
 *
 *   1. ANSI escape sequences are removed (and counted).
 *   2. Carriage returns apply progress-bar overwrite semantics.
 *   3. Trailing spaces/tabs are stripped from each line.
 *   4. Secret patterns are redacted (unless disabled), in a
 *      fixed pattern order, each replacement counted per kind.
 *   5. Runs of blank lines collapse; edge blank lines trim.
 *
 * The result is the cleaned text wrapped in a ```console fence,
 * the per-kind redaction counts, and line/sequence statistics.
 */

/** The redaction kinds, in the order their patterns are applied. */
export type RedactionKind =
  | "private_key"
  | "aws_access_key"
  | "github_token"
  | "bearer"
  | "kv_secret";

/** One kind's replacement count (only kinds with count > 0 are reported). */
export interface RedactionCount {
  kind: RedactionKind;
  count: number;
}

/** Statistics about the transform. Line counts split on "\n". */
export interface TermlogStats {
  input_lines: number;
  output_lines: number;
  ansi_sequences_removed: number;
  total_redactions: number;
}

/** The result of cleaning one terminal session. */
export interface TermlogResult {
  /** The cleaned text fenced as ```console markdown. */
  markdown: string;
  redactions: RedactionCount[];
  stats: TermlogStats;
}
