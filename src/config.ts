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
