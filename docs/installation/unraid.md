# Installing mail-map-analyst on Unraid

## Prerequisites

- Unraid 6.12+ with Docker enabled

## Step 1: Create Configuration

Open an Unraid terminal and create the rules file:

```bash
mkdir -p /mnt/user/appdata/mail-map-analyst
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

## Step 2: Add Container

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

### Paths

| Container Path | Host Path | Access Mode |
|---------------|-----------|-------------|
| `/app/config/rules.yaml` | `/mnt/user/appdata/mail-map-analyst/rules.yaml` | Read Only |
| `/root/.ollama` | `/mnt/user/appdata/mail-map-analyst/ollama` | Read/Write |

The `/root/.ollama` volume persists the AI model so it doesn't re-download on container restart.

### Apply

Click **Apply**. On first start the container will download the Gemma 2B model (~1.5 GB). This takes a few minutes.

## Step 3: Verify

Click the container icon → **Logs**. You should see:

```
Waiting for Ollama to start...
Ollama is ready
Pulling model: gemma2:2b
Model pulled successfully
{"ts":"...","level":"info","msg":"Starting mail-map-analyst","mode":"daemon","model":"gemma2:2b"}
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

### Emails not being sorted
- Set `LOG_LEVEL=debug` for classification details
- Verify IMAP credentials with another email client
- Ensure `mailbox` in rules.yaml matches your server (usually `INBOX`)

### Gmail / Google Workspace
- Enable IMAP in Gmail settings
- Use an [App Password](https://myaccount.google.com/apppasswords)
- IMAP: `imap.gmail.com:993`, SMTP: `smtp.gmail.com:587`
