#!/usr/bin/env node
/**
 * termlog CLI.
 *
 *   termlog clean --input <path> [--no-redact]
 *   termlog mcp
 *
 * The input file may be raw terminal output; it is read as
 * UTF-8 and the output object is printed as JSON. Pure local
 * computation: no network, no configuration. Argument
 * validation happens before any file is read.
 * Exit codes: 0 success, 1 runtime error (including an
 * unreadable input file), 2 usage error.
 */
import { readFileSync } from "node:fs";
import { cleanTerminalLog, formatPayload, VERSION } from "./termlog.js";

function usage(): never {
  console.error(`Usage:
  termlog clean --input <path> [--no-redact]
  termlog mcp
  termlog --version`);
  process.exit(2);
}

function flag(rest: string[], name: string): string | undefined {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") {
    console.log(VERSION);
    return;
  }
  if (cmd === "mcp") {
    await import("./mcp.js");
    return;
  }
  if (cmd !== "clean") usage();

  // ---- Argument validation (before any file is read) ----
  if (
    rest.some(
      (a) => a.startsWith("--") && a !== "--input" && a !== "--no-redact",
    )
  ) {
    usage();
  }
  const inputPath = flag(rest, "--input");
  if (inputPath === undefined) usage();
  const redact = !rest.includes("--no-redact");

  let text: string;
  try {
    text = readFileSync(inputPath, "utf8");
  } catch (err) {
    console.error(
      `error: cannot read input file '${inputPath}': ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }

  try {
    const out = cleanTerminalLog(text, redact);
    console.log(formatPayload(out));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

void main();
