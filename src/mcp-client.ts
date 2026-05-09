import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Logger } from "./logger.js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export interface MailConfig {
  imap: { host: string; port: number };
  smtp: { host: string; port: number };
  auth: { user: string; pass: string };
  mailFrom: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

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
    const mailMcpPath = resolve(__dirname, "../node_modules/mail-mcp/dist/index.js");

    this.transport = new StdioClientTransport({
      command: "node",
      args: [mailMcpPath],
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
