# Installing mail-map-analyst on Unraid

## Prerequisites

- Unraid 6.12+ with Docker enabled
- Community Applications plugin installed (recommended)
- Ollama container running (or you'll set one up below)

## Step 1: Set Up Ollama (if not already running)

1. Go to **Docker** tab in Unraid
2. Click **Add Container**
3. Configure:
   - **Name:** `ollama`
   - **Repository:** `ollama/ollama`
   - **Network Type:** `bridge` (or your custom network)
   - **Port Mapping:** `11434` → `11434`
   - Add a **Path** mapping:
     - **Container Path:** `/root/.ollama`
     - **Host Path:** `/mnt/user/appdata/ollama`
4. Click **Apply**
5. Once running, open Unraid terminal and pull the model:
   ```bash
   docker exec ollama ollama pull gemma2:2b
   ```

## Step 2: Create Configuration Files

1. Create the rules file on your Unraid server:
   ```bash
   mkdir -p /mnt/user/appdata/mail-map-analyst
   ```

2. Create `/mnt/user/appdata/mail-map-analyst/rules.yaml`:
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

## Step 3: Add mail-map-analyst Container

1. Go to **Docker** tab → **Add Container**
2. Configure:

   | Field | Value |
   |-------|-------|
   | **Name** | `mail-map-analyst` |
   | **Repository** | `thisphilipp/mail-map-analyst:latest` |
   | **Network Type** | Same network as Ollama (e.g., `bridge`) |

3. Add the following **Variables** (click "Add another Path, Port, Variable, Label or Device" → select "Variable"):

   | Name | Value |
   |------|-------|
   | `IMAP_HOST` | Your mail server (e.g., `imap.gmail.com`) |
   | `IMAP_PORT` | `993` |
   | `SMTP_HOST` | Your SMTP server (e.g., `smtp.gmail.com`) |
   | `SMTP_PORT` | `587` |
   | `MAIL_USER` | Your email address |
   | `MAIL_PASSWORD` | Your email password or app password |
   | `MAIL_FROM` | Your email address |
   | `OLLAMA_URL` | `http://ollama:11434` (if on same Docker network) or `http://<unraid-ip>:11434` |
   | `OLLAMA_MODEL` | `gemma2:2b` |
   | `MODE` | `daemon` |
   | `INTERVAL` | `15m` |
   | `LOG_LEVEL` | `info` |

4. Add a **Path** mapping:

   | Container Path | Host Path | Access Mode |
   |---------------|-----------|-------------|
   | `/app/config/rules.yaml` | `/mnt/user/appdata/mail-map-analyst/rules.yaml` | Read Only |

5. Click **Apply**

## Step 4: Networking

If both containers use the default `bridge` network, `http://ollama:11434` should work as the `OLLAMA_URL`. If not, use your Unraid server's IP address instead:

```
OLLAMA_URL=http://192.168.1.x:11434
```

Alternatively, create a custom Docker network for both containers to share:

```bash
docker network create mail-analyst-net
```

Then set both containers to use `mail-analyst-net` as their network.

## Step 5: Verify

1. Check the container logs in the Unraid Docker tab (click the container icon → **Logs**)
2. You should see:
   ```json
   {"ts":"...","level":"info","msg":"Starting mail-map-analyst","mode":"daemon","model":"gemma2:2b"}
   {"ts":"...","level":"info","msg":"Connected to mail-mcp"}
   {"ts":"...","level":"info","msg":"Daemon started","intervalMs":900000}
   ```
3. Send yourself a test email and wait for the next poll interval
4. Check that the email was moved/flagged according to your rules

## Troubleshooting

### Container won't start
- Check that all required environment variables are set (especially `IMAP_HOST`, `SMTP_HOST`, `MAIL_USER`, `MAIL_PASSWORD`, `MODE`)
- Verify the rules.yaml path mapping is correct

### "Cannot reach Ollama" error
- Verify Ollama container is running
- Check the `OLLAMA_URL` — if containers aren't on the same network, use the host IP
- Test connectivity: `docker exec mail-map-analyst wget -qO- http://ollama:11434/api/tags`

### Emails not being sorted
- Check `LOG_LEVEL=debug` for detailed classification output
- Verify your IMAP credentials work (test with another email client)
- Ensure the mailbox name in `rules.yaml` matches your server (usually `INBOX`)

### Gmail / Google Workspace
- Enable IMAP in Gmail settings
- Use an [App Password](https://myaccount.google.com/apppasswords) instead of your regular password
- IMAP host: `imap.gmail.com`, SMTP host: `smtp.gmail.com`

## Updating

To update to a newer version:
1. Docker tab → click the container icon → **Force Update**
2. Or pull manually: `docker pull thisphilipp/mail-map-analyst:latest` and recreate
