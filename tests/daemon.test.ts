import { describe, it, expect, vi } from "vitest";
import { Daemon, parseInterval } from "../src/daemon.js";

describe("Daemon", () => {
  it("starts polling and can be stopped", async () => {
    const mockPipeline = { processOnce: vi.fn().mockResolvedValue(0) };
    const mockLogger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const daemon = new Daemon(mockPipeline as any, mockLogger, 100);
    daemon.start();
    await new Promise((r) => setTimeout(r, 350));
    daemon.stop();
    expect(mockPipeline.processOnce.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("handles errors during poll without crashing", async () => {
    const mockPipeline = { processOnce: vi.fn().mockRejectedValue(new Error("fail")) };
    const mockLogger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const daemon = new Daemon(mockPipeline as any, mockLogger, 100);
    daemon.start();
    await new Promise((r) => setTimeout(r, 150));
    daemon.stop();
    expect(mockLogger.error).toHaveBeenCalled();
  });
});

describe("parseInterval", () => {
  it("parses seconds", () => {
    expect(parseInterval("30s")).toBe(30000);
  });

  it("parses minutes", () => {
    expect(parseInterval("15m")).toBe(900000);
  });

  it("parses hours", () => {
    expect(parseInterval("1h")).toBe(3600000);
  });

  it("returns default for invalid format", () => {
    expect(parseInterval("abc")).toBe(30000);
  });
});
