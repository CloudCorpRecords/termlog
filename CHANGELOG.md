# Changelog

## 0.1.0 (2026-10-27)

- Initial release: `clean_terminal_log` MCP tool and `clean`
  CLI command turning a raw terminal session into clean,
  shareable markdown.
- Five steps in order: ANSI escape removal (counted),
  carriage-return overwrite semantics, trailing-whitespace
  strip, secret redaction in pattern order (private_key,
  aws_access_key, github_token, bearer, kv_secret; on by
  default), and blank-line collapse.
