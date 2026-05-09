import { describe, it, expect } from "vitest";
import { buildClassificationPrompt, parseClassificationResponse } from "../src/classifier.js";
import type { Rule } from "../src/config.js";

const testRules: Rule[] = [
  { name: "newsletters", description: "Marketing emails and digests", actions: [{ action: "move", target: "Newsletters" }] },
  { name: "receipts", description: "Purchase confirmations", actions: [{ action: "move", target: "Receipts" }] },
  { name: "action-required", description: "Emails needing a reply", actions: [{ action: "flag" }] },
];

describe("buildClassificationPrompt", () => {
  it("includes all rule names and descriptions", () => {
    const prompt = buildClassificationPrompt(testRules, "Meeting tomorrow", "Hi, can we meet at 3pm?");
    expect(prompt).toContain("newsletters");
    expect(prompt).toContain("Marketing emails and digests");
    expect(prompt).toContain("receipts");
    expect(prompt).toContain("action-required");
    expect(prompt).toContain("Meeting tomorrow");
    expect(prompt).toContain("can we meet at 3pm");
  });

  it("truncates body to 2000 characters", () => {
    const longBody = "x".repeat(5000);
    const prompt = buildClassificationPrompt(testRules, "Subject", longBody);
    expect(prompt).toContain("...");
    expect(prompt.indexOf("x".repeat(2001))).toBe(-1);
  });

  it("instructs model to return JSON array", () => {
    const prompt = buildClassificationPrompt(testRules, "Test", "Body");
    expect(prompt).toContain("JSON");
    expect(prompt).toContain("array");
  });
});

describe("parseClassificationResponse", () => {
  it("parses valid JSON array response", () => {
    const result = parseClassificationResponse('["newsletters", "action-required"]', testRules);
    expect(result).toEqual(["newsletters", "action-required"]);
  });

  it("filters out unknown rule names", () => {
    const result = parseClassificationResponse('["newsletters", "unknown"]', testRules);
    expect(result).toEqual(["newsletters"]);
  });

  it("handles response with extra text around JSON", () => {
    const result = parseClassificationResponse('The matching rules are: ["receipts"]\nHope that helps!', testRules);
    expect(result).toEqual(["receipts"]);
  });

  it("returns empty array for unparseable response", () => {
    const result = parseClassificationResponse("I cannot classify this email", testRules);
    expect(result).toEqual([]);
  });

  it("returns empty array for non-array JSON", () => {
    const result = parseClassificationResponse('{"rule": "newsletters"}', testRules);
    expect(result).toEqual([]);
  });
});
