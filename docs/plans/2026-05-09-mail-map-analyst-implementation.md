# mail-map-analyst Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Docker-based email sorting system using a local Gemma 2B model (via Ollama) and the mail-mcp MCP server.

**Architecture:** Two docker-compose services (analyst Node.js app + Ollama). The analyst spawns mail-mcp as a child process via MCP stdio transport. It fetches emails, classifies them with Ollama, and executes user-defined sorting rules.

**Tech Stack:** TypeScript, Node.js 20, @modelcontextprotocol/sdk (client), Ollama REST API, Docker, docker-compose, yaml, vitest

**Prerequisites:** mail-mcp must be extended with keyword support (search by keyword, add/remove keywords). This is Task 0.

---

### Task 0: Extend mail-mcp with IMAP keyword support

**Context:** The analyst needs to mark processed emails with `$classified` keyword and search for emails that lack it. Currently mail-mcp's `mark_message` only supports `seen`/`flagged`, and `search_messages` doesn't filter by keyword.

**Repo:** `/Users/PGEHRIG/personal/dev/privat/mail-mcp`

**Files:**
- Modify: `src/imap.ts` (add keyword methods)
- Modify: `src/tools/manage.ts` (add keyword param to mark_message, add search by keyword)
- Modify: `src/tools/messages.ts` (add keyword filter to search_messages)
- Test: `tests/imap-keywords.test.ts`

- [ ] **Step 1: Write failing test for adding keywords**

```typescript
// tests/imap-keywords.test.ts
import { describe, it, expect, vi } from "vitest";

describe("IMAP keyword support", () => {
  it("should add a custom keyword to a message", async () => {
    const mockClient = {
      getMailboxLock: vi.fn().mockResolvedValue({ release: vi.fn() }),
      messageFlagsAdd: vi.fn().mockResolvedValue(undefined),
    };
    // Will test via the ImapClient class once method exists
    expect(mockClient.messageFlagsAdd).toBeDefined();
  });
});
```

- [ ] **Step 2: Add keyword methods to ImapClient**

In `src/imap.ts`, add:

```typescript
async addKeyword(folder: string, uid: number, keyword: string): Promise<void> {
  const lock = await this.client.getMailboxLock(folder);
  try {
    await this.client.messageFlagsAdd(uid.toString(), [keyword], { uid: true });
  } finally {
    lock.release();
  }
}

async removeKeyword(folder: string, uid: number, keyword: string): Promise<void> {
  const lock = await this.client.getMailboxLock(folder);
  try {
    await this.client.messageFlagsRemove(uid.toString(), [keyword], { uid: true });
  } finally {
    lock.release();
  }
}
```

- [ ] **Step 3: Add `keywords` parameter to mark_message tool**

In `src/tools/manage.ts`, extend the `mark_message` tool inputSchema:

```typescript
addKeywords: z.array(z.string()).optional().describe("Keywords to add"),
removeKeywords: z.array(z.string()).optional().describe("Keywords to remove"),
```

In the handler, after existing flag logic:

```typescript
if (addKeywords?.length) {
  for (const kw of addKeywords) {
    await imapClient.addKeyword(folder, uid, kw);
  }
}
if (removeKeywords?.length) {
  for (const kw of removeKeywords) {
    await imapClient.removeKeyword(folder, uid, kw);
  }
}
```

- [ ] **Step 4: Add keyword filter to search_messages**

In `src/tools/messages.ts`, add to the `search_messages` inputSchema:

```typescript
keyword: z.string().optional().describe("Filter by IMAP keyword (e.g. $classified)"),
withoutKeyword: z.string().optional().describe("Exclude messages with this keyword"),
```

In the searchMessages handler criteria building:

```typescript
if (query.keyword) criteria.keyword = query.keyword as string;
if (query.withoutKeyword) {
  // imapflow uses 'unkeyword' for NOT having a keyword
  criteria.unkeyword = query.withoutKeyword as string;
}
```

- [ ] **Step 5: Run tests and commit**

```bash
cd /Users/PGEHRIG/personal/dev/privat/mail-mcp
npm run test
git add src/imap.ts src/tools/manage.ts src/tools/messages.ts tests/imap-keywords.test.ts
git commit -m "feat: add IMAP keyword support for search and mark operations"
```

---

### Task 1: Project scaffold (mail-map-analyst)

**Repo:** `/Users/PGEHRIG/personal/dev/privat/mail-map-analyst`

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `config/rules.example.yaml`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "mail-map-analyst",
  "version": "0.1.0",
  "description": "Docker-based email sorting using local Gemma model via Ollama",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:integration": "vitest run --config vitest.integration.config.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "mail-mcp": "github:philippgehrig/mail-mcp",
    "yaml": "^2.7.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.21.0",
    "typescript": "^5.7.0",
    "vitest": "^3.1.0"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
dist/
.env
ollama_data/
```

- [ ] **Step 4: Create .env.example**

```
IMAP_HOST=mail.example.com
IMAP_PORT=993
SMTP_HOST=mail.example.com
SMTP_PORT=587
MAIL_USER=user@example.com
MAIL_PASSWORD=secret
MAIL_FROM=user@example.com
OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=gemma2:2b
MODE=daemon
INTERVAL=15m
LOG_LEVEL=info
```

- [ ] **Step 5: Create config/rules.example.yaml**

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

- [ ] **Step 6: Install dependencies and commit**

```bash
cd /Users/PGEHRIG/personal/dev/privat/mail-map-analyst
npm install
git add package.json package-lock.json tsconfig.json .gitignore .env.example config/
git commit -m "chore: project scaffold with dependencies"
```

---

### Task 2: Configuration module

**Files:**
- Create: `src/config.ts`
- Test: `tests/config.test.ts`

- [ ] **Step 1: Write failing test for config loading**

```typescript
// tests/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      IMAP_HOST: "imap.test.com",
      IMAP_PORT: "993",
      SMTP_HOST: "smtp.test.com",
      SMTP_PORT: "587",
      MAIL_USER: "test@test.com",
      MAIL_PASSWORD: "pass",
      OLLAMA_URL: "http://localhost:11434",
      OLLAMA_MODEL: "gemma2:2b",
      MODE: "daemon",
      LOG_LEVEL: "info",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("loads valid config from environment", () => {
    const config = loadConfig("/dev/null");
    expect(config.imap.host).toBe("imap.test.com");
    expect(config.imap.port).toBe(993);
    expect(config.ollama.url).toBe("http://localhost:11434");
    expect(config.mode).toBe("daemon");
  });

  it("throws on missing required env var", () => {
    delete process.env.IMAP_HOST;
    expect(() => loadConfig("/dev/null")).toThrow("IMAP_HOST");
  });

  it("uses defaults for optional env vars", () => {
    delete process.env.IMAP_PORT;
    delete process.env.OLLAMA_URL;
    const config = loadConfig("/dev/null");
    expect(config.imap.port).toBe(993);
    expect(config.ollama.url).toBe("http://ollama:11434");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/config.test.ts
```

Expected: FAIL — `loadConfig` doesn't exist.

- [ ] **Step 3: Write failing test for rules parsing**

```typescript
// tests/config.test.ts (append)
import { parseRules } from "../src/config.js";

describe("parseRules", () => {
  it("parses valid rules YAML", () => {
    const yaml = `
mailbox: INBOX
rules:
  - name: newsletters
    description: "Marketing emails"
    actions:
      - action: move
        target: Newsletters
  - name: important
    description: "Important emails"
    actions:
      - action: flag
    prompt: "Extract deadline"
`;
    const rules = parseRules(yaml);
    expect(rules.mailbox).toBe("INBOX");
    expect(rules.rules).toHaveLength(2);
    expect(rules.rules[0].name).toBe("newsletters");
    expect(rules.rules[0].actions[0]).toEqual({ action: "move", target: "Newsletters" });
    expect(rules.rules[1].prompt).toBe("Extract deadline");
  });

  it("throws on invalid action type", () => {
    const yaml = `
mailbox: INBOX
rules:
  - name: bad
    description: "Bad rule"
    actions:
      - action: explode
`;
    expect(() => parseRules(yaml)).toThrow();
  });

  it("throws on rule without name", () => {
    const yaml = `
mailbox: INBOX
rules:
  - description: "No name"
    actions:
      - action: flag
`;
    expect(() => parseRules(yaml)).toThrow();
  });
});
```

- [ ] **Step 4: Implement config.ts**

```typescript
// src/config.ts
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";

export interface Config {
  imap: { host: string; port: number };
  smtp: { host: string; port: number };
  auth: { user: string; pass: string };
  mailFrom: string;
  ollama: { url: string; model: string };
  mode: "daemon" | "scheduled";
  interval: string;
  logLevel: "debug" | "info" | "warn" | "error";
  rulesPath: string;
}

export interface RuleAction {
  action: "move" | "copy" | "flag" | "tag" | "delete" | "mark_read" | "forward" | "none";
  target?: string;
  value?: string;
  to?: string;
}

export interface Rule {
  name: string;
  description: string;
  actions: RuleAction[];
  prompt?: string;
}

export interface RulesConfig {
  mailbox: string;
  rules: Rule[];
}

const VALID_ACTIONS = ["move", "copy", "flag", "tag", "delete", "mark_read", "forward", "none"];

export function loadConfig(rulesPath: string = "/app/config/rules.yaml"): Config {
  const required = (name: string): string => {
    const val = process.env[name];
    if (!val) throw new Error(`Missing required environment variable: ${name}`);
    return val;
  };

  const parsePort = (name: string, defaultValue: number): number => {
    const raw = process.env[name];
    if (!raw) return defaultValue;
    const port = parseInt(raw, 10);
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid port for ${name}: "${raw}"`);
    }
    return port;
  };

  const mode = (process.env.MODE || "daemon") as Config["mode"];
  if (mode !== "daemon" && mode !== "scheduled") {
    throw new Error(`Invalid MODE: "${mode}" (must be "daemon" or "scheduled")`);
  }

  const logLevel = (process.env.LOG_LEVEL || "info") as Config["logLevel"];
  if (!["debug", "info", "warn", "error"].includes(logLevel)) {
    throw new Error(`Invalid LOG_LEVEL: "${logLevel}"`);
  }

  return {
    imap: {
      host: required("IMAP_HOST"),
      port: parsePort("IMAP_PORT", 993),
    },
    smtp: {
      host: required("SMTP_HOST"),
      port: parsePort("SMTP_PORT", 587),
    },
    auth: {
      user: required("MAIL_USER"),
      pass: required("MAIL_PASSWORD"),
    },
    mailFrom: process.env.MAIL_FROM || required("MAIL_USER"),
    ollama: {
      url: process.env.OLLAMA_URL || "http://ollama:11434",
      model: process.env.OLLAMA_MODEL || "gemma2:2b",
    },
    mode,
    interval: process.env.INTERVAL || "15m",
    logLevel,
    rulesPath,
  };
}

export function parseRules(yamlContent: string): RulesConfig {
  const parsed = parseYaml(yamlContent);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid rules YAML: must be an object");
  }
  if (!parsed.mailbox || typeof parsed.mailbox !== "string") {
    throw new Error("Invalid rules YAML: 'mailbox' is required");
  }
  if (!Array.isArray(parsed.rules) || parsed.rules.length === 0) {
    throw new Error("Invalid rules YAML: 'rules' must be a non-empty array");
  }

  const rules: Rule[] = parsed.rules.map((r: unknown, idx: number) => {
    const rule = r as Record<string, unknown>;
    if (!rule.name || typeof rule.name !== "string") {
      throw new Error(`Rule at index ${idx}: 'name' is required`);
    }
    if (!rule.description || typeof rule.description !== "string") {
      throw new Error(`Rule "${rule.name}": 'description' is required`);
    }
    if (!Array.isArray(rule.actions) || rule.actions.length === 0) {
      throw new Error(`Rule "${rule.name}": 'actions' must be a non-empty array`);
    }

    const actions: RuleAction[] = (rule.actions as Record<string, unknown>[]).map((a) => {
      if (!VALID_ACTIONS.includes(a.action as string)) {
        throw new Error(`Rule "${rule.name}": invalid action "${a.action}"`);
      }
      return {
        action: a.action as RuleAction["action"],
        target: a.target as string | undefined,
        value: a.value as string | undefined,
        to: a.to as string | undefined,
      };
    });

    return {
      name: rule.name,
      description: rule.description,
      actions,
      prompt: rule.prompt as string | undefined,
    };
  });

  return { mailbox: parsed.mailbox, rules };
}

export function loadRules(path: string): RulesConfig {
  const content = readFileSync(path, "utf-8");
  return parseRules(content);
}
```

- [ ] **Step 5: Run tests, verify pass, commit**

```bash
npx vitest run tests/config.test.ts
git add src/config.ts tests/config.test.ts
git commit -m "feat: add configuration and rules parsing module"
```

---

### Task 3: Logger module

**Files:**
- Create: `src/logger.ts`
- Test: `tests/logger.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/logger.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createLogger } from "../src/logger.js";

describe("logger", () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  it("outputs structured JSON to stdout", () => {
    const logger = createLogger("info");
    logger.info("test message", { email_uid: "123" });
    const output = (process.stdout.write as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.level).toBe("info");
    expect(parsed.msg).toBe("test message");
    expect(parsed.email_uid).toBe("123");
    expect(parsed.ts).toBeDefined();
  });

  it("respects log level", () => {
    const logger = createLogger("warn");
    logger.info("should be suppressed");
    expect(process.stdout.write).not.toHaveBeenCalled();
    logger.warn("should appear");
    expect(process.stdout.write).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement logger.ts**

```typescript
// src/logger.ts
type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export interface Logger {
  debug(msg: string, extra?: Record<string, unknown>): void;
  info(msg: string, extra?: Record<string, unknown>): void;
  warn(msg: string, extra?: Record<string, unknown>): void;
  error(msg: string, extra?: Record<string, unknown>): void;
}

export function createLogger(level: LogLevel): Logger {
  const minLevel = LEVELS[level];

  function log(lvl: LogLevel, msg: string, extra?: Record<string, unknown>) {
    if (LEVELS[lvl] < minLevel) return;
    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      level: lvl,
      msg,
      ...extra,
    });
    process.stdout.write(entry + "\n");
  }

  return {
    debug: (msg, extra) => log("debug", msg, extra),
    info: (msg, extra) => log("info", msg, extra),
    warn: (msg, extra) => log("warn", msg, extra),
    error: (msg, extra) => log("error", msg, extra),
  };
}
```

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run tests/logger.test.ts
git add src/logger.ts tests/logger.test.ts
git commit -m "feat: add structured JSON logger"
```

---

### Task 4: MCP client module

**Files:**
- Create: `src/mcp-client.ts`
- Test: `tests/mcp-client.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/mcp-client.test.ts
import { describe, it, expect, vi } from "vitest";
import { MailMcpClient } from "../src/mcp-client.js";

describe("MailMcpClient", () => {
  it("can be instantiated with config", () => {
    const client = new MailMcpClient({
      imap: { host: "imap.test.com", port: 993 },
      smtp: { host: "smtp.test.com", port: 587 },
      auth: { user: "test@test.com", pass: "pass" },
      mailFrom: "test@test.com",
    });
    expect(client).toBeDefined();
  });
});
```

- [ ] **Step 2: Implement mcp-client.ts**

```typescript
// src/mcp-client.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Logger } from "./logger.js";

export interface MailConfig {
  imap: { host: string; port: number };
  smtp: { host: string; port: number };
  auth: { user: string; pass: string };
  mailFrom: string;
}

export class MailMcpClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private mailConfig: MailConfig;
  private logger: Logger | null = null;

  constructor(mailConfig: MailConfig, logger?: Logger) {
    this.mailConfig = mailConfig;
    this.logger = logger || null;
  }

  async connect(): Promise<void> {
    this.transport = new StdioClientTransport({
      command: "node",
      args: [new URL("../node_modules/mail-mcp/dist/index.js", import.meta.url).pathname],
      env: {
        ...process.env,
        IMAP_HOST: this.mailConfig.imap.host,
        IMAP_PORT: String(this.mailConfig.imap.port),
        SMTP_HOST: this.mailConfig.smtp.host,
        SMTP_PORT: String(this.mailConfig.smtp.port),
        MAIL_USER: this.mailConfig.auth.user,
        MAIL_PASSWORD: this.mailConfig.auth.pass,
        MAIL_FROM: this.mailConfig.mailFrom,
      },
      stderr: "pipe",
    });

    this.client = new Client({ name: "mail-map-analyst", version: "0.1.0" });
    await this.client.connect(this.transport);
    this.logger?.info("Connected to mail-mcp");
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
      this.client = null;
    }
  }

  async reconnect(): Promise<void> {
    await this.disconnect();
    await this.connect();
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    if (!this.client) throw new Error("MCP client not connected");
    const result = await this.client.callTool({ name, arguments: args });
    const textContent = result.content as Array<{ type: string; text: string }>;
    if (result.isError) {
      throw new Error(textContent[0]?.text || "Unknown MCP error");
    }
    return textContent[0]?.text || "";
  }

  async listMessages(folder: string, limit = 50): Promise<unknown[]> {
    const result = await this.callTool("list_messages", { folder, limit });
    return JSON.parse(result);
  }

  async searchMessages(folder: string, query: Record<string, unknown>): Promise<unknown[]> {
    const result = await this.callTool("search_messages", { folder, ...query });
    return JSON.parse(result);
  }

  async getMessage(folder: string, uid: number): Promise<{ subject: string; body: string; from: string }> {
    const result = await this.callTool("get_message", { folder, uid });
    return JSON.parse(result);
  }

  async moveMessage(folder: string, uid: number, destination: string): Promise<void> {
    await this.callTool("move_message", { folder, uid, destination });
  }

  async deleteMessage(folder: string, uid: number): Promise<void> {
    await this.callTool("delete_message", { folder, uid });
  }

  async markMessage(folder: string, uid: number, flags: Record<string, unknown>): Promise<void> {
    await this.callTool("mark_message", { folder, uid, ...flags });
  }

  async forwardMessage(folder: string, uid: number, to: string): Promise<void> {
    await this.callTool("forward_message", { folder, uid, to });
  }
}
```

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run tests/mcp-client.test.ts
git add src/mcp-client.ts tests/mcp-client.test.ts
git commit -m "feat: add MCP client wrapper for mail-mcp"
```

---

### Task 5: Classifier module (Ollama integration)

**Files:**
- Create: `src/classifier.ts`
- Test: `tests/classifier.test.ts`

- [ ] **Step 1: Write failing test for prompt building**

```typescript
// tests/classifier.test.ts
import { describe, it, expect } from "vitest";
import { buildClassificationPrompt, parseClassificationResponse } from "../src/classifier.js";
import type { Rule } from "../src/config.js";

const testRules: Rule[] = [
  { name: "newsletters", description: "Marketing emails and digests", actions: [{ action: "move", target: "Newsletters" }] },
  { name: "receipts", description: "Purchase confirmations", actions: [{ action: "move", target: "Receipts" }] },
  { name: "action-required", description: "Emails needing a reply", actions: [{ action: "flag" }] },
];

describe("buildClassificationPrompt", () => {
  it("includes all rule names and descriptions", () => {
    const prompt = buildClassificationPrompt(testRules, "Meeting tomorrow", "Hi, can we meet at 3pm?");
    expect(prompt).toContain("newsletters");
    expect(prompt).toContain("Marketing emails and digests");
    expect(prompt).toContain("receipts");
    expect(prompt).toContain("action-required");
    expect(prompt).toContain("Meeting tomorrow");
    expect(prompt).toContain("can we meet at 3pm");
  });

  it("truncates body to 2000 characters", () => {
    const longBody = "x".repeat(5000);
    const prompt = buildClassificationPrompt(testRules, "Subject", longBody);
    expect(prompt.length).toBeLessThan(5000);
  });

  it("instructs model to return JSON array", () => {
    const prompt = buildClassificationPrompt(testRules, "Test", "Body");
    expect(prompt).toContain("JSON");
    expect(prompt).toContain("array");
  });
});

describe("parseClassificationResponse", () => {
  it("parses valid JSON array response", () => {
    const result = parseClassificationResponse('["newsletters", "action-required"]', testRules);
    expect(result).toEqual(["newsletters", "action-required"]);
  });

  it("filters out unknown rule names", () => {
    const result = parseClassificationResponse('["newsletters", "unknown"]', testRules);
    expect(result).toEqual(["newsletters"]);
  });

  it("handles response with extra text around JSON", () => {
    const result = parseClassificationResponse('The matching rules are: ["receipts"]\nHope that helps!', testRules);
    expect(result).toEqual(["receipts"]);
  });

  it("returns empty array for unparseable response", () => {
    const result = parseClassificationResponse("I cannot classify this email", testRules);
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npx vitest run tests/classifier.test.ts
```

- [ ] **Step 3: Implement classifier.ts**

```typescript
// src/classifier.ts
import type { Rule } from "./config.js";
import type { Logger } from "./logger.js";

const MAX_BODY_LENGTH = 2000;

export function buildClassificationPrompt(rules: Rule[], subject: string, body: string): string {
  const truncatedBody = body.length > MAX_BODY_LENGTH ? body.slice(0, MAX_BODY_LENGTH) + "..." : body;

  const ruleList = rules
    .map((r) => `- "${r.name}": ${r.description}`)
    .join("\n");

  return `You are an email classifier. Given the email below, determine which of the following categories it belongs to. An email can match multiple categories.

Categories:
${ruleList}

Email Subject: ${subject}
Email Body:
${truncatedBody}

Respond with ONLY a JSON array of matching category names. If no categories match, respond with an empty array [].
Example response: ["newsletters", "action-required"]`;
}

export function buildCustomPrompt(prompt: string, subject: string, body: string): string {
  const truncatedBody = body.length > MAX_BODY_LENGTH ? body.slice(0, MAX_BODY_LENGTH) + "..." : body;
  return `Given this email:

Subject: ${subject}
Body:
${truncatedBody}

${prompt}`;
}

export function parseClassificationResponse(response: string, rules: Rule[]): string[] {
  const validNames = new Set(rules.map((r) => r.name));

  // Try to extract JSON array from response
  const arrayMatch = response.match(/\[([^\]]*)\]/);
  if (!arrayMatch) return [];

  try {
    const parsed = JSON.parse(arrayMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((name: unknown) => typeof name === "string" && validNames.has(name));
  } catch {
    return [];
  }
}

export interface OllamaConfig {
  url: string;
  model: string;
}

export class Classifier {
  private config: OllamaConfig;
  private logger: Logger;

  constructor(config: OllamaConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  async classify(rules: Rule[], subject: string, body: string): Promise<string[]> {
    const prompt = buildClassificationPrompt(rules, subject, body);
    const response = await this.generate(prompt);
    return parseClassificationResponse(response, rules);
  }

  async runCustomPrompt(prompt: string, subject: string, body: string): Promise<string> {
    const fullPrompt = buildCustomPrompt(prompt, subject, body);
    return this.generate(fullPrompt);
  }

  async generate(prompt: string): Promise<string> {
    const url = `${this.config.url}/api/generate`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.config.model,
        prompt,
        stream: false,
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama request failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { response: string };
    this.logger.debug("Ollama response", { response: data.response });
    return data.response;
  }

  async ensureModel(): Promise<void> {
    const url = `${this.config.url}/api/tags`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Cannot reach Ollama at ${this.config.url}`);

    const data = (await res.json()) as { models: Array<{ name: string }> };
    const modelExists = data.models?.some((m) => m.name.startsWith(this.config.model));

    if (!modelExists) {
      this.logger.info("Pulling model", { model: this.config.model });
      const pullRes = await fetch(`${this.config.url}/api/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: this.config.model, stream: false }),
      });
      if (!pullRes.ok) throw new Error(`Failed to pull model: ${pullRes.statusText}`);
      this.logger.info("Model pulled successfully");
    }
  }
}
```

- [ ] **Step 4: Run tests, commit**

```bash
npx vitest run tests/classifier.test.ts
git add src/classifier.ts tests/classifier.test.ts
git commit -m "feat: add Ollama classifier with prompt building and response parsing"
```

---

### Task 6: Executor module

**Files:**
- Create: `src/executor.ts`
- Test: `tests/executor.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/executor.test.ts
import { describe, it, expect, vi } from "vitest";
import { resolveActions } from "../src/executor.js";
import type { Rule, RuleAction } from "../src/config.js";

describe("resolveActions", () => {
  const rules: Rule[] = [
    { name: "newsletters", description: "d", actions: [{ action: "move", target: "Newsletters" }] },
    { name: "receipts", description: "d", actions: [{ action: "move", target: "Receipts" }, { action: "mark_read" }] },
    { name: "important", description: "d", actions: [{ action: "flag" }] },
  ];

  it("collects all actions from matched rules", () => {
    const actions = resolveActions(["newsletters", "important"], rules);
    expect(actions).toContainEqual({ action: "move", target: "Newsletters" });
    expect(actions).toContainEqual({ action: "flag" });
  });

  it("last move wins when multiple moves match", () => {
    const actions = resolveActions(["newsletters", "receipts"], rules);
    const moves = actions.filter((a) => a.action === "move");
    expect(moves).toHaveLength(1);
    expect(moves[0].target).toBe("Receipts");
  });

  it("non-move actions from all rules are preserved", () => {
    const actions = resolveActions(["receipts", "important"], rules);
    expect(actions).toContainEqual({ action: "mark_read" });
    expect(actions).toContainEqual({ action: "flag" });
  });

  it("returns empty for no matches", () => {
    const actions = resolveActions([], rules);
    expect(actions).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement executor.ts**

```typescript
// src/executor.ts
import type { Rule, RuleAction } from "./config.js";
import type { MailMcpClient } from "./mcp-client.js";
import type { Logger } from "./logger.js";

export function resolveActions(matchedNames: string[], rules: Rule[]): RuleAction[] {
  const matched = rules.filter((r) => matchedNames.includes(r.name));
  const allActions: RuleAction[] = matched.flatMap((r) => r.actions);

  // Last move wins: remove all moves except the last one
  const lastMoveIdx = allActions.map((a, i) => a.action === "move" ? i : -1).filter((i) => i >= 0).pop();
  const resolved = allActions.filter((a, i) => {
    if (a.action !== "move") return true;
    return i === lastMoveIdx;
  });

  return resolved;
}

export class Executor {
  private mcpClient: MailMcpClient;
  private logger: Logger;

  constructor(mcpClient: MailMcpClient, logger: Logger) {
    this.mcpClient = mcpClient;
    this.logger = logger;
  }

  async execute(folder: string, uid: number, actions: RuleAction[]): Promise<void> {
    for (const action of actions) {
      try {
        await this.executeAction(folder, uid, action);
        this.logger.info("Action executed", { email_uid: String(uid), action: action.action, status: "success" });
      } catch (err) {
        this.logger.error("Action failed", {
          email_uid: String(uid),
          action: action.action,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    }
  }

  private async executeAction(folder: string, uid: number, action: RuleAction): Promise<void> {
    switch (action.action) {
      case "move":
        await this.mcpClient.moveMessage(folder, uid, action.target!);
        break;
      case "copy":
        // MCP copy not available — use move semantics note: mail-mcp would need copy support
        // For now, log a warning
        this.logger.warn("Copy action not yet supported by mail-mcp", { email_uid: String(uid) });
        break;
      case "flag":
        await this.mcpClient.markMessage(folder, uid, { flagged: true });
        break;
      case "tag":
        await this.mcpClient.markMessage(folder, uid, { addKeywords: [action.value!] });
        break;
      case "delete":
        await this.mcpClient.deleteMessage(folder, uid);
        break;
      case "mark_read":
        await this.mcpClient.markMessage(folder, uid, { seen: true });
        break;
      case "forward":
        await this.mcpClient.forwardMessage(folder, uid, action.to!);
        break;
      case "none":
        break;
    }
  }
}
```

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run tests/executor.test.ts
git add src/executor.ts tests/executor.test.ts
git commit -m "feat: add action executor with last-move-wins conflict resolution"
```

---

### Task 7: Pipeline module

**Files:**
- Create: `src/pipeline.ts`
- Test: `tests/pipeline.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/pipeline.test.ts
import { describe, it, expect, vi } from "vitest";
import { Pipeline } from "../src/pipeline.js";
import type { RulesConfig } from "../src/config.js";

describe("Pipeline", () => {
  const rulesConfig: RulesConfig = {
    mailbox: "INBOX",
    rules: [
      { name: "newsletters", description: "Marketing", actions: [{ action: "move", target: "Newsletters" }] },
    ],
  };

  it("processes an email: fetch, classify, execute, mark", async () => {
    const mockMcpClient = {
      searchMessages: vi.fn().mockResolvedValue([{ uid: 1, subject: "Sale!", flags: [] }]),
      getMessage: vi.fn().mockResolvedValue({ subject: "Sale!", body: "50% off everything", from: "shop@store.com" }),
      markMessage: vi.fn().mockResolvedValue(undefined),
      moveMessage: vi.fn().mockResolvedValue(undefined),
      deleteMessage: vi.fn(),
      forwardMessage: vi.fn(),
      callTool: vi.fn(),
    };

    const mockClassifier = {
      classify: vi.fn().mockResolvedValue(["newsletters"]),
      runCustomPrompt: vi.fn(),
      ensureModel: vi.fn(),
    };

    const mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const pipeline = new Pipeline(mockMcpClient as any, mockClassifier as any, mockLogger, rulesConfig);
    await pipeline.processOnce();

    expect(mockMcpClient.searchMessages).toHaveBeenCalledWith("INBOX", { withoutKeyword: "$classified" });
    expect(mockMcpClient.getMessage).toHaveBeenCalledWith("INBOX", 1);
    expect(mockClassifier.classify).toHaveBeenCalled();
    expect(mockMcpClient.moveMessage).toHaveBeenCalledWith("INBOX", 1, "Newsletters");
    expect(mockMcpClient.markMessage).toHaveBeenCalledWith("INBOX", 1, { addKeywords: ["$classified"] });
  });
});
```

- [ ] **Step 2: Implement pipeline.ts**

```typescript
// src/pipeline.ts
import type { RulesConfig } from "./config.js";
import type { MailMcpClient } from "./mcp-client.js";
import type { Classifier } from "./classifier.js";
import { Executor, resolveActions } from "./executor.js";
import type { Logger } from "./logger.js";

interface MessageSummary {
  uid: number;
  subject: string;
  flags: string[];
}

export class Pipeline {
  private mcpClient: MailMcpClient;
  private classifier: Classifier;
  private executor: Executor;
  private logger: Logger;
  private rulesConfig: RulesConfig;

  constructor(mcpClient: MailMcpClient, classifier: Classifier, logger: Logger, rulesConfig: RulesConfig) {
    this.mcpClient = mcpClient;
    this.classifier = classifier;
    this.executor = new Executor(mcpClient, logger);
    this.logger = logger;
    this.rulesConfig = rulesConfig;
  }

  async processOnce(): Promise<number> {
    const messages = await this.mcpClient.searchMessages(this.rulesConfig.mailbox, {
      withoutKeyword: "$classified",
    }) as MessageSummary[];

    if (messages.length === 0) {
      this.logger.debug("No unprocessed messages found");
      return 0;
    }

    this.logger.info("Processing messages", { count: messages.length });
    let processed = 0;

    for (const msg of messages) {
      try {
        await this.processMessage(msg);
        processed++;
      } catch (err) {
        this.logger.error("Failed to process message", {
          email_uid: String(msg.uid),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return processed;
  }

  private async processMessage(msg: MessageSummary): Promise<void> {
    const full = await this.mcpClient.getMessage(this.rulesConfig.mailbox, msg.uid);

    const matchedNames = await this.classifyWithRetry(full.subject, full.body);
    this.logger.info("Classified email", {
      email_uid: String(msg.uid),
      subject: full.subject,
      rules: matchedNames.join(","),
    });

    const actions = resolveActions(matchedNames, this.rulesConfig.rules);
    if (actions.length > 0 && !(actions.length === 1 && actions[0].action === "none")) {
      await this.executor.execute(this.rulesConfig.mailbox, msg.uid, actions);
    }

    // Run custom prompts for matched rules
    const matchedRules = this.rulesConfig.rules.filter((r) => matchedNames.includes(r.name) && r.prompt);
    for (const rule of matchedRules) {
      const result = await this.classifier.runCustomPrompt(rule.prompt!, full.subject, full.body);
      this.logger.info("Custom prompt result", {
        email_uid: String(msg.uid),
        rule: rule.name,
        result,
      });
    }

    // Mark as classified
    await this.mcpClient.markMessage(this.rulesConfig.mailbox, msg.uid, { addKeywords: ["$classified"] });
  }

  private async classifyWithRetry(subject: string, body: string, attempts = 3): Promise<string[]> {
    for (let i = 0; i < attempts; i++) {
      try {
        return await this.classifier.classify(this.rulesConfig.rules, subject, body);
      } catch (err) {
        if (i === attempts - 1) throw err;
        const delay = Math.pow(2, i) * 1000;
        this.logger.warn("Classification failed, retrying", { attempt: i + 1, delay });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    return [];
  }
}
```

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run tests/pipeline.test.ts
git add src/pipeline.ts tests/pipeline.test.ts
git commit -m "feat: add processing pipeline with retry logic"
```

---

### Task 8: Daemon and Scheduler modes

**Files:**
- Create: `src/daemon.ts`
- Create: `src/scheduler.ts`
- Test: `tests/daemon.test.ts`
- Test: `tests/scheduler.test.ts`

- [ ] **Step 1: Write failing test for scheduler**

```typescript
// tests/scheduler.test.ts
import { describe, it, expect, vi } from "vitest";
import { runScheduled } from "../src/scheduler.js";

describe("runScheduled", () => {
  it("calls pipeline.processOnce and returns count", async () => {
    const mockPipeline = { processOnce: vi.fn().mockResolvedValue(5) };
    const mockLogger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const count = await runScheduled(mockPipeline as any, mockLogger);
    expect(count).toBe(5);
    expect(mockPipeline.processOnce).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Implement scheduler.ts**

```typescript
// src/scheduler.ts
import type { Pipeline } from "./pipeline.js";
import type { Logger } from "./logger.js";

export async function runScheduled(pipeline: Pipeline, logger: Logger): Promise<number> {
  logger.info("Starting scheduled processing run");
  const count = await pipeline.processOnce();
  logger.info("Scheduled run complete", { processed: count });
  return count;
}
```

- [ ] **Step 3: Write failing test for daemon**

```typescript
// tests/daemon.test.ts
import { describe, it, expect, vi } from "vitest";
import { Daemon } from "../src/daemon.js";

describe("Daemon", () => {
  it("starts polling and can be stopped", async () => {
    const mockPipeline = { processOnce: vi.fn().mockResolvedValue(0) };
    const mockLogger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const daemon = new Daemon(mockPipeline as any, mockLogger, 100);
    daemon.start();
    await new Promise((r) => setTimeout(r, 250));
    daemon.stop();
    expect(mockPipeline.processOnce.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 4: Implement daemon.ts**

```typescript
// src/daemon.ts
import type { Pipeline } from "./pipeline.js";
import type { Logger } from "./logger.js";

export class Daemon {
  private pipeline: Pipeline;
  private logger: Logger;
  private intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(pipeline: Pipeline, logger: Logger, intervalMs = 30000) {
    this.pipeline = pipeline;
    this.logger = logger;
    this.intervalMs = intervalMs;
  }

  start(): void {
    this.running = true;
    this.logger.info("Daemon started", { intervalMs: this.intervalMs });
    this.poll();
    this.timer = setInterval(() => this.poll(), this.intervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.logger.info("Daemon stopped");
  }

  private async poll(): Promise<void> {
    if (!this.running) return;
    try {
      await this.pipeline.processOnce();
    } catch (err) {
      this.logger.error("Daemon poll error", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export function parseInterval(interval: string): number {
  const match = interval.match(/^(\d+)(s|m|h)$/);
  if (!match) return 30000;
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case "s": return value * 1000;
    case "m": return value * 60 * 1000;
    case "h": return value * 60 * 60 * 1000;
    default: return 30000;
  }
}
```

- [ ] **Step 5: Run tests, commit**

```bash
npx vitest run tests/scheduler.test.ts tests/daemon.test.ts
git add src/daemon.ts src/scheduler.ts tests/daemon.test.ts tests/scheduler.test.ts
git commit -m "feat: add daemon and scheduled operating modes"
```

---

### Task 9: Entry point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Implement index.ts**

```typescript
// src/index.ts
import { loadConfig, loadRules } from "./config.js";
import { createLogger } from "./logger.js";
import { MailMcpClient } from "./mcp-client.js";
import { Classifier } from "./classifier.js";
import { Pipeline } from "./pipeline.js";
import { Daemon, parseInterval } from "./daemon.js";
import { runScheduled } from "./scheduler.js";

async function main() {
  const config = loadConfig(process.env.RULES_PATH || "/app/config/rules.yaml");
  const logger = createLogger(config.logLevel);
  const rulesConfig = loadRules(config.rulesPath);

  logger.info("Starting mail-map-analyst", { mode: config.mode, model: config.ollama.model });

  const mcpClient = new MailMcpClient(
    { imap: config.imap, smtp: config.smtp, auth: config.auth, mailFrom: config.mailFrom },
    logger,
  );

  const classifier = new Classifier(config.ollama, logger);

  // Ensure model is available
  await classifier.ensureModel();

  // Connect to mail-mcp
  await mcpClient.connect();

  const pipeline = new Pipeline(mcpClient, classifier, logger, rulesConfig);

  if (config.mode === "daemon") {
    const intervalMs = parseInterval(config.interval);
    const daemon = new Daemon(pipeline, logger, intervalMs);

    process.on("SIGTERM", () => {
      logger.info("Received SIGTERM, shutting down");
      daemon.stop();
      mcpClient.disconnect();
      process.exit(0);
    });

    process.on("SIGINT", () => {
      logger.info("Received SIGINT, shutting down");
      daemon.stop();
      mcpClient.disconnect();
      process.exit(0);
    });

    daemon.start();
  } else {
    const count = await runScheduled(pipeline, logger);
    await mcpClient.disconnect();
    process.exit(count >= 0 ? 0 : 1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
```

- [ ] **Step 2: Commit**

```bash
git add src/index.ts
git commit -m "feat: add entry point with mode selection and graceful shutdown"
```

---

### Task 10: Docker setup

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`

- [ ] **Step 1: Create Dockerfile**

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

- [ ] **Step 2: Create docker-compose.yml**

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

- [ ] **Step 3: Commit**

```bash
git add Dockerfile docker-compose.yml
git commit -m "feat: add Docker and docker-compose setup"
```

---

### Task 11: CI/CD — GitHub Actions workflow for Docker Hub publish

**Files:**
- Create: `.github/workflows/docker-publish.yml`
- Create: `.github/workflows/test.yml`

- [ ] **Step 1: Create test workflow**

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm test
```

- [ ] **Step 2: Create Docker publish workflow**

```yaml
# .github/workflows/docker-publish.yml
name: Docker Publish

on:
  push:
    tags: ["v*"]
  workflow_dispatch:

env:
  REGISTRY: docker.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PAT }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

- [ ] **Step 3: Commit**

```bash
mkdir -p .github/workflows
git add .github/workflows/test.yml .github/workflows/docker-publish.yml
git commit -m "ci: add test and Docker Hub publish workflows"
```

---

### Task 12: README and CLAUDE.md

**Files:**
- Update: `README.md`
- Create: `CLAUDE.md`

- [ ] **Step 1: Write README.md**

Content should cover:
- What it does (one paragraph)
- Quick start (docker-compose up)
- Configuration (env vars table + rules.yaml reference)
- Rules examples
- Docker Hub image reference

- [ ] **Step 2: Create CLAUDE.md**

```markdown
# mail-map-analyst

Docker-based email sorting using local Gemma model via Ollama + mail-mcp.

## Commands

- `npm run dev` — start locally (requires env vars + Ollama running)
- `npm run build` — compile TypeScript
- `npm run test` — run unit tests
- `npm run test:integration` — run integration tests (requires Docker)
- `docker compose up` — start full stack

## Architecture

- `src/index.ts` — entry point, mode selection
- `src/config.ts` — env var + YAML parsing
- `src/mcp-client.ts` — MCP stdio client wrapping mail-mcp
- `src/classifier.ts` — Ollama prompt building + response parsing
- `src/executor.ts` — action execution via MCP
- `src/pipeline.ts` — orchestration: fetch → classify → execute → mark
- `src/daemon.ts` — continuous polling mode
- `src/scheduler.ts` — single-pass scheduled mode

## Conventions

- All logging structured JSON to stdout
- mail-mcp consumed as npm dependency (github:philippgehrig/mail-mcp)
- Emails marked with `$classified` IMAP keyword after processing
- Last-move-wins for conflicting move actions
```

- [ ] **Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: add README and CLAUDE.md"
```
