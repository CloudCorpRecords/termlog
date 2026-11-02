# termlog

Paste a terminal session into a chat or a doc and you paste
everything: colour codes, progress bars that rewrote themselves
a hundred times, and — too often — the API key that scrolled by
in the middle. termlog cleans a raw session into shareable
markdown in one local pass:

1. **ANSI removal** — CSI, OSC, and two-character escape
   sequences are stripped, and every removal is counted
2. **Carriage returns** — each line keeps only what followed
   its last `\r`, so a progress bar collapses to its final state
3. **Trailing whitespace** — trailing spaces and tabs stripped
4. **Redaction** (on by default) — private-key blocks, AWS
   access key ids, GitHub tokens, Bearer credentials, and
   `key = value` secrets are replaced with `[REDACTED:<kind>]`
   markers, applied in that pattern order and counted per kind
5. **Blank lines** — runs of 3+ newlines collapse to exactly 2,
   and blank lines at the edges are trimmed

The result is the cleaned text in a ` ```console ` fence, the
redaction counts, and line statistics. Pure local text
transform: no network, no configuration.

## CLI

```bash
npx @reneturcios/termlog clean --input session.log
npx @reneturcios/termlog clean --input session.log --no-redact
npx @reneturcios/termlog --version
```

The input file is read as UTF-8 and the output object is
printed as JSON. Exit codes: `0` on success, `1` on a runtime
error (including an unreadable input file), `2` on a usage
error.

## MCP server

```bash
npx -y @reneturcios/termlog mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "termlog": {
      "command": "npx",
      "args": ["-y", "@reneturcios/termlog", "mcp"]
    }
  }
}
```

### Tools

- `clean_terminal_log` — Turn a raw terminal session into
  clean, shareable Markdown.
  - `text` (string, required) — the raw terminal session text
  - `redact` (boolean, optional, default true) — apply secret
    redaction

  Returns `{markdown, redactions, stats}`: the fenced cleaned
  text, the per-kind redaction counts (kinds with a count
  above zero, in pattern order), and `{input_lines,
  output_lines, ansi_sequences_removed, total_redactions}`.

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/termlog
docker run --rm -v "$PWD:/w" ghcr.io/cloudcorprecords/termlog clean --input /w/session.log
```

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # tsx --test test/*.test.ts (pure local, no network)
npm run dev     # run the CLI from source
```

## License

MIT — Copyright (c) 2026 Rene Turcios
