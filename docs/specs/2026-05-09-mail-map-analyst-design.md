# mail-map-analyst Design Specification

**Date:** 2026-05-09
**Status:** Draft

---

## Overview

mail-map-analyst is a Docker-based email analysis system that runs a local Gemma 2B model (via Ollama) to automatically classify and sort emails. It connects to the user's mail server via the [mail-mcp](https://github.com/philippgehrig/mail-mcp) MCP server, consumed as an npm dependency and spawned as a child process communicating over the stdio MCP protocol.

The system is fully self-hosted — no cloud AI services are involved. Classification rules are user-defined in a mounted YAML file, making the system flexible and transparent.

---

## Architecture

The system is composed of two Docker services orchestrated via docker-compose:

### Services

- **`analyst`**: A Node.js application that:
  - Spawns mail-mcp as a child process using MCP SDK's `StdioClientTransport`
  - Calls Ollama's REST API for email classification
  - Executes sorting actions based on classification results

- **`ollama`**: The official `ollama/ollama` Docker image serving the Gemma 2B quantized model for local inference.

### Key Design Decisions

- **mail-mcp as npm dependency**: Installed from `github:philippgehrig/mail-mcp`. This allows the analyst to communicate with any IMAP/SMTP server through the well-defined MCP tool interface without reimplementing email protocols.
- **MCP stdio transport**: On startup, the analyst spawns the mail-mcp subprocess and connects via the MCP SDK's `StdioClientTransport`, enabling structured tool calls for email operations.
- **Local LLM**: All classification happens on-device via Ollama, ensuring email content never leaves the user's infrastructure.

---

## Configuration

### Environment Variables

Connection and runtime settings are configured via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `IMAP_HOST` | IMAP server hostname | *(required)* |
| `IMAP_PORT` | IMAP server port | `993` |
| `SMTP_HOST` | SMTP server hostname | *(required)* |
| `SMTP_PORT` | SMTP server port | `587` |
| `MAIL_USER` | Email account username | *(required)* |
| `MAIL_PASSWORD` | Email account password | *(required)* |
| `MAIL_FROM` | Sender address for forwarded emails | `MAIL_USER` |
| `OLLAMA_URL` | Ollama API endpoint | `http://ollama:11434` |
| `OLLAMA_MODEL` | Model to use for classification | `gemma2:2b` |
| `MODE` | Operating mode | *(required)* |
| `INTERVAL` | Processing interval (scheduled mode only) | `15m` |
| `LOG_LEVEL` | Minimum log level | `info` |

`MODE` accepts two values:
- `daemon` — continuous operation using IMAP IDLE
- `scheduled` — process-and-exit

### Rules Configuration (YAML)

Classification rules are defined in a mounted YAML file at `/app/config/rules.yaml`:

```yaml
mailbox: INBOX
rules:
  - name: newsletters
    description: "Marketing emails, digests, automated content from subscriptions"
    actions:
      - action: move
        target: Newsletters
  - name: receipts
    description: "Purchase confirmations, invoices, payment notifications"
    actions:
      - action: move
        target: Receipts
      - action: mark_read
  - name: action-required
    description: "Emails that explicitly ask me to do something or need a reply"
    actions:
      - action: flag
    prompt: "Extract the deadline if mentioned"
  - name: default
    description: "Anything that doesn't match above rules"
    actions:
      - action: none
```

---

## Rule System

### Structure

Each rule consists of:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique identifier for the rule |
| `description` | Yes | Natural language description used in the LLM classification prompt |
| `actions` | Yes | List of actions to execute when the rule matches |
| `prompt` | No | Additional question to ask the model about the email |

### Matching Behavior

- **All matching rules apply** — an email can match multiple rules, and all their actions execute.
- If multiple rules specify a `move` action, the **last matching move wins** (later rules override earlier ones for move destinations).
- The `default` rule (if defined) acts as a catch-all when no other rules match.

### Available Actions

| Action | Parameters | Description |
|--------|-----------|-------------|
| `move` | `target` (folder name) | Move email to target folder; folder created if missing |
| `copy` | `target` (folder name) | Copy email to target folder |
| `flag` | — | Set IMAP flagged status |
| `tag` | `value` (keyword) | Add custom IMAP keyword |
| `delete` | — | Move email to trash |
| `mark_read` | — | Mark email as read (set \Seen flag) |
| `forward` | `to` (email address) | Forward email to specified address |
| `none` | — | No action taken |

### Custom Prompts

When a rule includes a `prompt` field, after classification the system sends a follow-up prompt to the model with the email content and the custom question. The result is:
- Stored as an IMAP keyword annotation (if supported by server)
- Logged in structured output for external consumption

---

## Processing Pipeline

For each processing cycle:

1. **Fetch unprocessed emails** from the configured mailbox via mail-mcp, filtering by absence of the `$classified` IMAP keyword.

2. **For each email:**
   - Read subject and body (plain text preferred) via mail-mcp
   - Build a classification prompt containing all rule names and their descriptions
   - Send the prompt to Ollama and receive a list of matching rule names
   - Execute all actions from all matching rules (respecting last-move-wins for conflicts)
   - If any matched rule has a custom `prompt`, send a follow-up prompt and store/log the result

3. **Mark email** with the `$classified` IMAP keyword to prevent reprocessing.

### Classification Prompt Design

The prompt to Ollama includes:
- The email subject and body text
- A structured list of all rule names with their descriptions
- Instructions to return only the names of rules that match the email
- Output format specification (JSON array of rule name strings)

---

## Operating Modes

### Daemon Mode

- Uses IMAP IDLE to watch the configured mailbox for new messages
- Processes incoming emails in real-time as they arrive
- Maintains persistent connections to both IMAP (via mail-mcp) and Ollama
- Automatically reconnects on connection loss with exponential backoff

### Scheduled Mode

- Processes all unclassified emails in the configured mailbox
- Exits after processing is complete
- Designed to be triggered by:
  - Docker restart policy (`restart: on-failure`)
  - External cron job
  - Container orchestration scheduling
- The `INTERVAL` environment variable is informational for cron configuration but not enforced by the application itself in this mode

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Ollama unreachable | Retry 3x with exponential backoff, skip email (retry next cycle) |
| mail-mcp crash | Respawn child process, reconnect MCP client |
| IMAP connection lost | Reconnect with backoff (daemon), exit with error (scheduled) |
| Unknown classification | Log warning, no action taken |
| Action failure | Log error, skip marking as `$classified` (will retry next cycle) |

### Retry Strategy

- Exponential backoff: 1s, 2s, 4s (3 attempts)
- Emails that fail processing are not marked as `$classified`, ensuring they are retried in subsequent cycles
- In daemon mode, transient failures do not halt the IDLE watcher

---

## Startup Sequence

1. **Validate environment variables** — fail fast if required vars are missing
2. **Parse rules.yaml** — validate structure, report errors with line numbers
3. **Spawn mail-mcp subprocess** — connect via MCP SDK's `StdioClientTransport`
4. **Check Ollama connectivity** — pull model if not already available locally
5. **Enter operating mode** — start IDLE watcher (daemon) or begin processing run (scheduled)

---

## Logging

- All logs emitted to **stdout** (Docker captures via logging driver)
- **Structured JSON format**:

```json
{
  "ts": "2026-05-09T10:30:00.000Z",
  "level": "info",
  "email_uid": "1234",
  "rule": "newsletters",
  "action": "move",
  "status": "success"
}
```

- `LOG_LEVEL` configurable via environment variable (`debug`, `info`, `warn`, `error`)
- Classification results logged at `info` level
- MCP communication details logged at `debug` level
- Action failures logged at `error` level with full context

---

## Project Structure

```
mail-map-analyst/
├── docker-compose.yml
├── Dockerfile
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # entry point — starts daemon or scheduled run
│   ├── config.ts         # loads env vars + parses rules.yaml
│   ├── mcp-client.ts     # spawns mail-mcp, connects MCP client
│   ├── classifier.ts     # builds prompts, calls Ollama, returns rule names
│   ├── executor.ts       # takes classification results, runs actions via MCP
│   ├── pipeline.ts       # orchestrates: fetch → classify → execute → mark
│   ├── daemon.ts         # IMAP IDLE watcher (continuous mode)
│   └── scheduler.ts      # process-and-exit (scheduled mode)
├── config/
│   └── rules.example.yaml
└── README.md
```

### Module Responsibilities

| Module | Responsibility |
|--------|---------------|
| `index.ts` | Parse args, load config, wire dependencies, start mode |
| `config.ts` | Environment variable validation, YAML parsing, typed config object |
| `mcp-client.ts` | Spawn mail-mcp process, manage lifecycle, expose typed MCP tool calls |
| `classifier.ts` | Prompt construction, Ollama HTTP calls, response parsing |
| `executor.ts` | Map rule actions to MCP tool calls, handle conflicts (last move wins) |
| `pipeline.ts` | Top-level orchestration: fetch, classify, execute, mark |
| `daemon.ts` | IMAP IDLE loop, trigger pipeline on new messages |
| `scheduler.ts` | Single-pass processing, exit with appropriate code |

---

## Docker Setup

### docker-compose.yml

```yaml
services:
  analyst:
    build: .
    env_file: .env
    volumes:
      - ./config/rules.yaml:/app/config/rules.yaml:ro
    depends_on:
      ollama:
        condition: service_healthy
    restart: unless-stopped

  ollama:
    image: ollama/ollama
    volumes:
      - ollama_data:/root/.ollama
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:11434/api/tags"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  ollama_data:
```

### Dockerfile

```dockerfile
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

ENTRYPOINT ["node", "dist/index.js"]
```

The entrypoint script checks Ollama model availability and pulls the model if missing before starting the main application logic.

---

## Testing Strategy

### Unit Tests

- **Config parsing**: Validate environment variable defaults, required field enforcement, YAML schema validation
- **Prompt building**: Verify classification prompts include all rule descriptions, correct output format instructions
- **Action conflict resolution**: Confirm last-move-wins behavior, multiple actions from multiple rules merge correctly
- **Response parsing**: Handle malformed Ollama responses, partial matches, empty results

### Integration Tests

- **docker-compose with Ollama + GreenMail**: Same testing pattern as the mail-mcp repository
- Full pipeline test: send email to GreenMail, run classification, verify email moved/flagged correctly
- Error scenario tests: Ollama unavailable, IMAP disconnection, invalid rule configurations
- MCP client lifecycle: spawn, crash recovery, reconnection

### Test Commands

```bash
npm run test              # unit tests
npm run test:integration  # integration tests (requires Docker)
```
