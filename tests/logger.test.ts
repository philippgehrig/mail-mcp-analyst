import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger } from "../src/logger.js";

describe("logger", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it("outputs structured JSON to stdout", () => {
    const logger = createLogger("info");
    logger.info("test message", { email_uid: "123" });
    const output = writeSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.level).toBe("info");
    expect(parsed.msg).toBe("test message");
    expect(parsed.email_uid).toBe("123");
    expect(parsed.ts).toBeDefined();
  });

  it("respects log level", () => {
    const logger = createLogger("warn");
    logger.info("should be suppressed");
    expect(writeSpy).not.toHaveBeenCalled();
    logger.warn("should appear");
    expect(writeSpy).toHaveBeenCalled();
  });

  it("outputs debug when level is debug", () => {
    const logger = createLogger("debug");
    logger.debug("debug msg");
    expect(writeSpy).toHaveBeenCalled();
    const parsed = JSON.parse(writeSpy.mock.calls[0][0] as string);
    expect(parsed.level).toBe("debug");
  });
});
