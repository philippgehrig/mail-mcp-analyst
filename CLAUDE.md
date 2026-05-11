# mail-map-analyst

Docker-based email sorting using an external Ollama instance + mail-mcp.

## Commands

- `npm run dev` — start locally (requires env vars + Ollama running)
- `npm run build` — compile TypeScript
- `npm run test` — run unit tests
- `npm run test:integration` — run integration tests (requires Docker)
- `docker compose up` — start analyst + Ollama containers

## Architecture

- `src/index.ts` — entry point, mode selection
- `src/config.ts` — env var + YAML parsing
- `src/mcp-client.ts` — MCP stdio client wrapping mail-mcp
- `src/classifier.ts` — Ollama prompt building + response parsing
- `src/executor.ts` — action execution via MCP
- `src/pipeline.ts` — orchestration: fetch -> classify -> execute -> mark
- `src/daemon.ts` — continuous polling mode
- `src/scheduler.ts` — single-pass scheduled mode

## Conventions

- All logging structured JSON to stdout
- mail-mcp consumed as npm dependency (github:philippgehrig/mail-mcp)
- Emails marked with `$classified` IMAP keyword after processing
- Last-move-wins for conflicting move actions
