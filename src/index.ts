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

  await classifier.ensureModel();
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
