# Installing mail-map-analyst on Unraid

## Prerequisites

- Unraid 6.12+ with Docker enabled

## Step 1: Create Configuration

Open an Unraid terminal and create the rules file:

```bash
mkdir -p /mnt/user/appdata/mail-map-analyst
mkdir -p /mnt/user/appdata/ollama
```

Create `/mnt/user/appdata/mail-map-analyst/rules.yaml`:

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

## Step 2: Add Ollama Container

Go to **Docker** tab → **Add Container**:

| Field | Value |
|-------|-------|
| **Name** | `ollama` |
| **Repository** | `ollama/ollama:latest` |

### Paths

| Container Path | Host Path | Access Mode |
|---------------|-----------|-------------|
| `/root/.ollama` | `/mnt/user/appdata/ollama` | Read/Write |

Click **Apply**. Ollama will start and be available at `http://ollama:11434` on the Docker network.

## Step 3: Add mail-map-analyst Container

Go to **Docker** tab → **Add Container**:

| Field | Value |
|-------|-------|
| **Name** | `mail-map-analyst` |
| **Repository** | `thisphilipp/mail-map-analyst:latest` |

### Variables

Add these environment variables:

| Name | Value |
|------|-------|
| `IMAP_HOST` | Your IMAP server (e.g., `imap.gmail.com`) |
| `IMAP_PORT` | `993` |
| `SMTP_HOST` | Your SMTP server (e.g., `smtp.gmail.com`) |
| `SMTP_PORT` | `587` |
| `MAIL_USER` | Your email address |
| `MAIL_PASSWORD` | Your email password or app password |
| `MODE` | `daemon` |
| `INTERVAL` | `15m` |
| `LOG_LEVEL` | `info` |
| `OLLAMA_URL` | `http://ollama:11434` |
| `OLLAMA_MODEL` | `gemma2:2b` |
| `TLS_REJECT_UNAUTHORIZED` | `false` (only if using self-signed certs) |

### Paths

| Container Path | Host Path | Access Mode |
|---------------|-----------|-------------|
| `/app/config/rules.yaml` | `/mnt/user/appdata/mail-map-analyst/rules.yaml` | Read Only |

### Networking

Both containers must be on the same Docker network. By default Unraid uses `bridge` — if using a custom network, ensure both containers share it.

### Apply

Click **Apply**. On first start the analyst will pull the Gemma 2B model into the Ollama container (~1.5 GB). This takes a few minutes.

## Step 4: Verify

Click the mail-map-analyst container icon → **Logs**. You should see:

```
{"ts":"...","level":"info","msg":"Starting mail-map-analyst","mode":"daemon","model":"gemma2:2b"}
{"ts":"...","level":"info","msg":"Pulling model","model":"gemma2:2b"}
{"ts":"...","level":"info","msg":"Model pulled successfully"}
{"ts":"...","level":"info","msg":"Connected to mail-mcp"}
{"ts":"...","level":"info","msg":"Daemon started","intervalMs":900000}
```

Send yourself a test email and wait for the next poll interval.

## Updating

Click the container icon → **Force Update**, or:

```bash
docker pull thisphilipp/mail-map-analyst:latest
```

## Troubleshooting

### Container won't start
- Verify all required variables are set (IMAP_HOST, SMTP_HOST, MAIL_USER, MAIL_PASSWORD, MODE)
- Check the rules.yaml path mapping
- Ensure Ollama container is running and accessible

### "Cannot reach Ollama" error
- Confirm the Ollama container is running: check its logs
- Verify `OLLAMA_URL` matches the Ollama container name (default: `http://ollama:11434`)
- Both containers must be on the same Docker network

### "Connection closed" / MCP error
- Usually an IMAP connection issue
- For self-hosted mail servers: set `TLS_REJECT_UNAUTHORIZED=false`
- Verify IMAP credentials with another email client
- Set `LOG_LEVEL=debug` for detailed error output

### Emails not being sorted
- Set `LOG_LEVEL=debug` for classification details
- Verify IMAP credentials with another email client
- Ensure `mailbox` in rules.yaml matches your server (usually `INBOX`)

### Gmail / Google Workspace
- Enable IMAP in Gmail settings
- Use an [App Password](https://myaccount.google.com/apppasswords)
- IMAP: `imap.gmail.com:993`, SMTP: `smtp.gmail.com:587`
