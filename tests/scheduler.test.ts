import { describe, it, expect, vi } from "vitest";
import { runScheduled } from "../src/scheduler.js";

describe("runScheduled", () => {
  it("calls pipeline.processOnce and returns count", async () => {
    const mockPipeline = { processOnce: vi.fn().mockResolvedValue(5) };
    const mockLogger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const count = await runScheduled(mockPipeline as any, mockLogger);
    expect(count).toBe(5);
    expect(mockPipeline.processOnce).toHaveBeenCalledOnce();
  });

  it("returns 0 when no messages processed", async () => {
    const mockPipeline = { processOnce: vi.fn().mockResolvedValue(0) };
    const mockLogger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const count = await runScheduled(mockPipeline as any, mockLogger);
    expect(count).toBe(0);
  });
});
