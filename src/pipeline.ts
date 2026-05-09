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

    const matchedRules = this.rulesConfig.rules.filter((r) => matchedNames.includes(r.name) && r.prompt);
    for (const rule of matchedRules) {
      const result = await this.classifier.runCustomPrompt(rule.prompt!, full.subject, full.body);
      this.logger.info("Custom prompt result", {
        email_uid: String(msg.uid),
        rule: rule.name,
        result,
      });
    }

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
