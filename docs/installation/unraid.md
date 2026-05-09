# Installing mail-map-analyst on Unraid

## Prerequisites

- Unraid 6.12+ with Docker enabled
- Docker Compose plugin installed (available via Community Applications)

## Step 1: Create Directory Structure

Open an Unraid terminal (or SSH in) and create the app directory:

```bash
mkdir -p /mnt/user/appdata/mail-map-analyst/config
```

## Step 2: Create Configuration Files

### rules.yaml

Create `/mnt/user/appdata/mail-map-analyst/config/rules.yaml`:

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
    prompt: "Extract the deadline if mentioned, respond with just the date or 'none'"

  - name: default
    description: "Anything that doesn't match the above rules stays in INBOX"
    actions:
      - action: none
```

Customize the rules to match your needs.

### .env

Create `/mnt/user/appdata/mail-map-analyst/.env`:

```
IMAP_HOST=imap.example.com
IMAP_PORT=993
SMTP_HOST=smtp.example.com
SMTP_PORT=587
MAIL_USER=you@example.com
MAIL_PASSWORD=your-app-password
MAIL_FROM=you@example.com
OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=gemma2:2b
MODE=daemon
INTERVAL=15m
LOG_LEVEL=info
```

### docker-compose.yml

Create `/mnt/user/appdata/mail-map-analyst/docker-compose.yml`:

```yaml
services:
  analyst:
    image: thisphilipp/mail-map-analyst:latest
    container_name: mail-map-analyst
    env_file: .env
    volumes:
      - ./config/rules.yaml:/app/config/rules.yaml:ro
    depends_on:
      ollama:
        condition: service_healthy
    restart: unless-stopped

  ollama:
    image: ollama/ollama
    container_name: mail-map-analyst-ollama
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

> **Already running Ollama?** If you have an existing Ollama container, remove the `ollama` service from the compose file and set `OLLAMA_URL=http://<unraid-ip>:11434` in your `.env` instead.

## Step 3: Start the Stack

```bash
cd /mnt/user/appdata/mail-map-analyst
docker compose up -d
```

On first start, the analyst will pull the Gemma 2B model into Ollama automatically. This may take a few minutes depending on your internet connection.

## Step 4: Verify

Check the logs:

```bash
docker compose logs analyst -f
```

You should see:

```json
{"ts":"...","level":"info","msg":"Starting mail-map-analyst","mode":"daemon","model":"gemma2:2b"}
{"ts":"...","level":"info","msg":"Connected to mail-mcp"}
{"ts":"...","level":"info","msg":"Daemon started","intervalMs":900000}
```

Send yourself a test email and wait for the next poll interval. Check that it gets moved/flagged according to your rules.

## Updating

```bash
cd /mnt/user/appdata/mail-map-analyst
docker compose pull
docker compose up -d
```

## Using Scheduled Mode Instead

If you prefer to run the analyst periodically rather than continuously (saves resources):

1. Set `MODE=scheduled` in your `.env`
2. Remove the `restart: unless-stopped` from the analyst service
3. Use Unraid's User Scripts plugin or cron to run:
   ```bash
   cd /mnt/user/appdata/mail-map-analyst && docker compose up analyst
   ```
   on your desired schedule (e.g., every 15 minutes).

## Troubleshooting

### Container won't start
- Check that all required environment variables are set in `.env`
- Verify the rules.yaml path is correct: `docker compose config` will show resolved paths

### "Cannot reach Ollama" error
- Check Ollama is healthy: `docker compose ps`
- If using an external Ollama, verify the URL and that it's reachable from the analyst container

### Emails not being sorted
- Set `LOG_LEVEL=debug` in `.env` and restart for detailed classification output
- Verify your IMAP credentials work (test with another email client)
- Ensure the mailbox name in `rules.yaml` matches your server (usually `INBOX`)

### Gmail / Google Workspace
- Enable IMAP in Gmail settings
- Use an [App Password](https://myaccount.google.com/apppasswords) instead of your regular password
- IMAP host: `imap.gmail.com`, SMTP host: `smtp.gmail.com`
