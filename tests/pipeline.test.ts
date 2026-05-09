import { describe, it, expect, vi } from "vitest";
import { Pipeline } from "../src/pipeline.js";
import type { RulesConfig } from "../src/config.js";

describe("Pipeline", () => {
  const rulesConfig: RulesConfig = {
    mailbox: "INBOX",
    rules: [
      { name: "newsletters", description: "Marketing", actions: [{ action: "move", target: "Newsletters" }] },
    ],
  };

  it("processes an email: fetch, classify, execute, mark", async () => {
    const mockMcpClient = {
      searchMessages: vi.fn().mockResolvedValue([{ uid: 1, subject: "Sale!", flags: [] }]),
      getMessage: vi.fn().mockResolvedValue({ subject: "Sale!", body: "50% off everything", from: "shop@store.com" }),
      markMessage: vi.fn().mockResolvedValue(undefined),
      moveMessage: vi.fn().mockResolvedValue(undefined),
      deleteMessage: vi.fn(),
      forwardMessage: vi.fn(),
      callTool: vi.fn(),
    };

    const mockClassifier = {
      classify: vi.fn().mockResolvedValue(["newsletters"]),
      runCustomPrompt: vi.fn(),
      ensureModel: vi.fn(),
    };

    const mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const pipeline = new Pipeline(mockMcpClient as any, mockClassifier as any, mockLogger, rulesConfig);
    const count = await pipeline.processOnce();

    expect(count).toBe(1);
    expect(mockMcpClient.searchMessages).toHaveBeenCalledWith("INBOX", { withoutKeyword: "$classified" });
    expect(mockMcpClient.getMessage).toHaveBeenCalledWith("INBOX", 1);
    expect(mockClassifier.classify).toHaveBeenCalled();
    expect(mockMcpClient.moveMessage).toHaveBeenCalledWith("INBOX", 1, "Newsletters");
    expect(mockMcpClient.markMessage).toHaveBeenCalledWith("INBOX", 1, { addKeywords: ["$classified"] });
  });

  it("returns 0 when no unprocessed messages", async () => {
    const mockMcpClient = {
      searchMessages: vi.fn().mockResolvedValue([]),
      getMessage: vi.fn(),
      markMessage: vi.fn(),
      moveMessage: vi.fn(),
      deleteMessage: vi.fn(),
      forwardMessage: vi.fn(),
      callTool: vi.fn(),
    };

    const mockClassifier = {
      classify: vi.fn(),
      runCustomPrompt: vi.fn(),
      ensureModel: vi.fn(),
    };

    const mockLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    const pipeline = new Pipeline(mockMcpClient as any, mockClassifier as any, mockLogger, rulesConfig);
    const count = await pipeline.processOnce();

    expect(count).toBe(0);
    expect(mockMcpClient.getMessage).not.toHaveBeenCalled();
  });

  it("continues processing on individual message failure", async () => {
    const mockMcpClient = {
      searchMessages: vi.fn().mockResolvedValue([
        { uid: 1, subject: "Fail", flags: [] },
        { uid: 2, subject: "Pass", flags: [] },
      ]),
      getMessage: vi.fn()
        .mockRejectedValueOnce(new Error("network error"))
        .mockResolvedValueOnce({ subject: "Pass", body: "ok", from: "a@b.com" }),
      markMessage: vi.fn().mockResolvedValue(undefined),
      moveMessage: vi.fn().mockResolvedValue(undefined),
      deleteMessage: vi.fn(),
      forwardMessage: vi.fn(),
      callTool: vi.fn(),
    };

    const mockClassifier = {
      classify: vi.fn().mockResolvedValue(["newsletters"]),
      runCustomPrompt: vi.fn(),
      ensureModel: vi.fn(),
    };

    const mockLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    const pipeline = new Pipeline(mockMcpClient as any, mockClassifier as any, mockLogger, rulesConfig);
    const count = await pipeline.processOnce();

    expect(count).toBe(1);
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
