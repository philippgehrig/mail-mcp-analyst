# mail-map-analyst

Automatically sort and classify your emails using a local Gemma 2B model via Ollama. Fully self-hosted — no cloud AI services involved.

## Quick Start

```yaml
# docker-compose.yml
services:
  analyst:
    image: thisphilipp/mail-map-analyst:latest
    environment:
      - IMAP_HOST=imap.example.com
      - SMTP_HOST=smtp.example.com
      - MAIL_USER=you@example.com
      - MAIL_PASSWORD=your-app-password
      - MODE=daemon
      - OLLAMA_URL=http://ollama:11434
    volumes:
      - ./rules.yaml:/app/config/rules.yaml:ro
    depends_on:
      - ollama

  ollama:
    image: ollama/ollama:latest
    volumes:
      - ollama_data:/root/.ollama

volumes:
  ollama_data:
```

```bash
docker compose up -d
```

The analyst connects to an external Ollama instance and automatically pulls the model on first start.

## Configuration

### Environment Variables

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
| `OLLAMA_MODEL` | Model for classification | `gemma2:2b` |
| `MODE` | `daemon` (continuous) or `scheduled` (run-once) | *(required)* |
| `INTERVAL` | Poll interval in daemon mode | `15m` |
| `LOG_LEVEL` | `debug`, `info`, `warn`, or `error` | `info` |
| `TLS_REJECT_UNAUTHORIZED` | Set to `false` for self-signed mail server certs | `true` |

### Rules (rules.yaml)

```yaml
mailbox: INBOX
rules:
  - name: newsletters
    description: "Marketing emails, digests, subscriptions"
    actions:
      - action: move
        target: Newsletters

  - name: action-required
    description: "Emails that need a reply or action"
    actions:
      - action: flag
    prompt: "Extract the deadline if mentioned"
```

### Available Actions

| Action | Parameters | Description |
|--------|-----------|-------------|
| `move` | `target` | Move to folder (created if missing) |
| `copy` | `target` | Copy to folder |
| `flag` | — | Set IMAP flagged status |
| `tag` | `value` | Add custom IMAP keyword |
| `delete` | — | Move to trash |
| `mark_read` | — | Mark as read |
| `forward` | `to` | Forward to email address |
| `none` | — | No action |

Rules can match multiple emails, and emails can match multiple rules. If multiple rules specify `move`, the last matching move wins.

## Docker Hub

```bash
docker pull thisphilipp/mail-map-analyst:latest
```

The image requires an external Ollama instance. Point `OLLAMA_URL` to your Ollama server, or use the docker-compose setup above to run one alongside the analyst.

## Development

```bash
npm install
npm run build
npm test
npm run dev  # requires env vars + running Ollama
```

## License

MIT
