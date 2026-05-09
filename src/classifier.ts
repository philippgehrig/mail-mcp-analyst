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
