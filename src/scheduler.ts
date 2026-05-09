import type { Pipeline } from "./pipeline.js";
import type { Logger } from "./logger.js";

export async function runScheduled(pipeline: Pipeline, logger: Logger): Promise<number> {
  logger.info("Starting scheduled processing run");
  const count = await pipeline.processOnce();
  logger.info("Scheduled run complete", { processed: count });
  return count;
}
