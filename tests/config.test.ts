import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig, parseRules } from "../src/config.js";

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

  it("throws on invalid MODE", () => {
    process.env.MODE = "invalid";
    expect(() => loadConfig("/dev/null")).toThrow("Invalid MODE");
  });

  it("throws on invalid LOG_LEVEL", () => {
    process.env.LOG_LEVEL = "verbose";
    expect(() => loadConfig("/dev/null")).toThrow("Invalid LOG_LEVEL");
  });
});

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
    expect(rules.rules[0].actions[0]).toEqual({ action: "move", target: "Newsletters", value: undefined, to: undefined });
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

  it("throws on empty rules array", () => {
    const yaml = `
mailbox: INBOX
rules: []
`;
    expect(() => parseRules(yaml)).toThrow();
  });
});
