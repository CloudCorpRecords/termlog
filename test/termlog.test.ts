import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanTerminalLog } from "../src/termlog.js";

/**
 * All tests are pure local text transforms over inline strings:
 * no filesystem, no network. The five processing steps are
 * pinned in the spec's order — ANSI removal, CR overwrites,
 * trailing-whitespace strip, redaction, blank-line collapse.
 */

const ESC = "\u001b";
const BEL = "\u0007";

describe("cleanTerminalLog — ANSI removal", () => {
  it("strips CSI sequences and counts every one", () => {
    const out = cleanTerminalLog(`${ESC}[31mred${ESC}[0m plain`);
    assert.equal(out.markdown, "```console\nred plain\n```");
    assert.equal(out.stats.ansi_sequences_removed, 2);
  });

  it("strips OSC sequences terminated by BEL and by ESC backslash", () => {
    const out = cleanTerminalLog(
      `${ESC}]0;window title${BEL}hello${ESC}]8;;https://example.com${ESC}\\link`,
    );
    assert.equal(out.markdown, "```console\nhellolink\n```");
    assert.equal(out.stats.ansi_sequences_removed, 2);
  });

  it("strips charset escapes (ESC + intermediate + final) and single escapes", () => {
    const out = cleanTerminalLog(`${ESC}(Btext${ESC}c`);
    assert.equal(out.markdown, "```console\ntext\n```");
    assert.equal(out.stats.ansi_sequences_removed, 2);
  });
});

describe("cleanTerminalLog — carriage returns and whitespace", () => {
  it("keeps only the segment after the last CR (progress-bar overwrite)", () => {
    const out = cleanTerminalLog("progress 10%\rprogress 90%\ndone");
    assert.equal(out.markdown, "```console\nprogress 90%\ndone\n```");
  });

  it("drops a trailing CR with no other effect", () => {
    const out = cleanTerminalLog("abc\r\ndef");
    assert.equal(out.markdown, "```console\nabc\ndef\n```");
  });

  it("strips trailing spaces and tabs from each line", () => {
    const out = cleanTerminalLog("hi   \t\nthere  ");
    assert.equal(out.markdown, "```console\nhi\nthere\n```");
  });
});

describe("cleanTerminalLog — redaction kinds", () => {
  it("redacts a private-key block spanning lines as one line", () => {
    const out = cleanTerminalLog(
      "before\n-----BEGIN RSA PRIVATE KEY-----\nMIIxyz123\n-----END RSA PRIVATE KEY-----\nafter",
    );
    assert.equal(
      out.markdown,
      "```console\nbefore\n[REDACTED:private_key]\nafter\n```",
    );
    assert.deepEqual(out.redactions, [{ kind: "private_key", count: 1 }]);
    assert.equal(out.stats.total_redactions, 1);
  });

  it("redacts AWS access key ids and counts repeats", () => {
    const out = cleanTerminalLog(
      "a AKIAIOSFODNN7EXAMPLE b AKIAZZZZZZZZZZZZZZZZ c",
    );
    assert.equal(
      out.markdown,
      "```console\na [REDACTED:aws_access_key] b [REDACTED:aws_access_key] c\n```",
    );
    assert.deepEqual(out.redactions, [{ kind: "aws_access_key", count: 2 }]);
  });

  it("redacts GitHub tokens", () => {
    const out = cleanTerminalLog("token ghp_abcdefghijklmnopqrst here");
    assert.equal(out.markdown, "```console\ntoken [REDACTED:github_token] here\n```");
    assert.deepEqual(out.redactions, [{ kind: "github_token", count: 1 }]);
  });

  it("redacts Bearer credentials, preserving the word's original casing", () => {
    const out = cleanTerminalLog("Authorization: bearer abcdefgh1234 end");
    assert.equal(
      out.markdown,
      "```console\nAuthorization: bearer [REDACTED:bearer] end\n```",
    );
    assert.deepEqual(out.redactions, [{ kind: "bearer", count: 1 }]);
  });

  it("redacts key-value secrets, preserving key and separator, dropping quotes", () => {
    const out = cleanTerminalLog(
      'password=hunter2secret\napi_key: "supersecretvalue"',
    );
    assert.equal(
      out.markdown,
      "```console\npassword=[REDACTED:kv_secret]\napi_key: [REDACTED:kv_secret]\n```",
    );
    assert.deepEqual(out.redactions, [{ kind: "kv_secret", count: 2 }]);
  });

  it("reports redaction kinds in pattern order", () => {
    const out = cleanTerminalLog(
      "password=abcd1234\nAKIAIOSFODNN7EXAMPLE",
    );
    assert.deepEqual(out.redactions, [
      { kind: "aws_access_key", count: 1 },
      { kind: "kv_secret", count: 1 },
    ]);
    assert.equal(out.stats.total_redactions, 2);
  });

  it("counts an AKIA string inside a private-key block once, as private_key", () => {
    const out = cleanTerminalLog(
      "-----BEGIN PRIVATE KEY-----\nAKIAIOSFODNN7EXAMPLE\n-----END PRIVATE KEY-----",
    );
    assert.equal(out.markdown, "```console\n[REDACTED:private_key]\n```");
    assert.deepEqual(out.redactions, [{ kind: "private_key", count: 1 }]);
    assert.equal(out.stats.total_redactions, 1);
  });

  it("leaves secrets untouched when redact is false", () => {
    const out = cleanTerminalLog("key AKIAIOSFODNN7EXAMPLE", false);
    assert.equal(out.markdown, "```console\nkey AKIAIOSFODNN7EXAMPLE\n```");
    assert.deepEqual(out.redactions, []);
    assert.equal(out.stats.total_redactions, 0);
  });
});

describe("cleanTerminalLog — blank lines, empty text, shape", () => {
  it("collapses 3+ consecutive newlines to exactly 2 and trims edge blank lines", () => {
    const out = cleanTerminalLog("\n\n\na\n\n\n\nb\n\n\n");
    assert.equal(out.markdown, "```console\na\n\nb\n```");
    assert.equal(out.stats.output_lines, 3);
  });

  it("accepts empty text and produces the empty-cleaned result", () => {
    const out = cleanTerminalLog("");
    assert.equal(out.markdown, "```console\n```");
    assert.deepEqual(out.redactions, []);
    assert.deepEqual(out.stats, {
      input_lines: 0,
      output_lines: 0,
      ansi_sequences_removed: 0,
      total_redactions: 0,
    });
  });

  it("wraps cleaned text in a console fence and counts lines", () => {
    const out = cleanTerminalLog("one\ntwo");
    assert.equal(out.markdown, "```console\none\ntwo\n```");
    assert.equal(out.stats.input_lines, 2);
    assert.equal(out.stats.output_lines, 2);
  });

  it("rejects a missing text argument", () => {
    assert.throws(() => cleanTerminalLog(undefined), /text is required/);
  });
});
