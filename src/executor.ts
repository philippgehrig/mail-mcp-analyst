import type { Rule, RuleAction } from "./config.js";
import type { MailMcpClient } from "./mcp-client.js";
import type { Logger } from "./logger.js";

export function resolveActions(matchedNames: string[], rules: Rule[]): RuleAction[] {
  const matched = rules.filter((r) => matchedNames.includes(r.name));
  const allActions: RuleAction[] = matched.flatMap((r) => r.actions);

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
