# Installing mail-map-analyst on Unraid

## Prerequisites

- Unraid 6.12+ with Docker enabled
- Docker Compose plugin installed (available via Community Applications)

## Step 1: Download the Project

Open an Unraid terminal (or SSH in):

```bash
mkdir -p /mnt/user/appdata/mail-map-analyst
cd /mnt/user/appdata/mail-map-analyst
wget https://raw.githubusercontent.com/philippgehrig/mail-map-analyst/main/docker-compose.yml
wget https://raw.githubusercontent.com/philippgehrig/mail-map-analyst/main/.env.example -O .env
mkdir -p config
wget https://raw.githubusercontent.com/philippgehrig/mail-map-analyst/main/config/rules.example.yaml -O config/rules.yaml
```

This gives you everything needed — the compose file already includes both the analyst and Ollama containers.

## Step 2: Configure

### Edit `.env`

```bash
nano /mnt/user/appdata/mail-map-analyst/.env
```

Fill in your mail server credentials:

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

### Edit `config/rules.yaml`

```bash
nano /mnt/user/appdata/mail-map-analyst/config/rules.yaml
```

Customize the sorting rules to your needs. See the [rules documentation](../../README.md) for all available actions.

## Step 3: Start

```bash
cd /mnt/user/appdata/mail-map-analyst
docker compose up -d
```

On first start, the Gemma 2B model is pulled automatically into Ollama. This may take a few minutes.

## Step 4: Verify

```bash
docker compose logs analyst -f
```

You should see:

```json
{"ts":"...","level":"info","msg":"Starting mail-map-analyst","mode":"daemon","model":"gemma2:2b"}
{"ts":"...","level":"info","msg":"Connected to mail-mcp"}
{"ts":"...","level":"info","msg":"Daemon started","intervalMs":900000}
```

Send yourself a test email and wait for the next poll interval.

## Updating

```bash
cd /mnt/user/appdata/mail-map-analyst
docker compose pull
docker compose up -d
```

## Already Running Ollama?

If you have an existing Ollama instance on your Unraid server, just set `OLLAMA_URL` in `.env` to point at it (e.g., `http://192.168.1.x:11434`) and remove or comment out the `ollama` service in `docker-compose.yml`.

## Scheduled Mode

If you prefer periodic runs over continuous operation:

1. Set `MODE=scheduled` in `.env`
2. Use Unraid's User Scripts plugin or cron:
   ```bash
   cd /mnt/user/appdata/mail-map-analyst && docker compose run --rm analyst
   ```

## Troubleshooting

### Container won't start
- Check all required variables are set: `docker compose config`
- Verify rules.yaml syntax: look for YAML indentation errors

### "Cannot reach Ollama" error
- Check Ollama is healthy: `docker compose ps`
- Wait for the healthcheck to pass (up to 50 seconds on first boot)

### Emails not being sorted
- Set `LOG_LEVEL=debug` for detailed classification output
- Verify your IMAP credentials work with another email client
- Ensure `mailbox` in rules.yaml matches your server (usually `INBOX`)

### Gmail / Google Workspace
- Enable IMAP in Gmail settings
- Use an [App Password](https://myaccount.google.com/apppasswords) — regular passwords won't work
- IMAP: `imap.gmail.com:993`, SMTP: `smtp.gmail.com:587`
