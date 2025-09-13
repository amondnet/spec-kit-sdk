import { describe, test, expect } from "bun:test";
import { updateAgentContext } from "@spec-kit/scripts";

describe("updateAgentContext contract tests", () => {
  test("should return correct JSON structure for claude agent", async () => {
    const result = await updateAgentContext("claude", { json: true });

    expect(result).toEqual({
      AGENT_FILE: expect.stringContaining(".claude"),
      UPDATED: expect.any(Boolean),
      AGENT_TYPE: "claude"
    });
  });

  test("should return correct JSON structure for copilot agent", async () => {
    const result = await updateAgentContext("copilot", { json: true });

    expect(result).toEqual({
      AGENT_FILE: expect.stringContaining("copilot"),
      UPDATED: expect.any(Boolean),
      AGENT_TYPE: "copilot"
    });
  });

  test("should return correct JSON structure for gemini agent", async () => {
    const result = await updateAgentContext("gemini", { json: true });

    expect(result).toEqual({
      AGENT_FILE: expect.stringContaining("gemini"),
      UPDATED: expect.any(Boolean),
      AGENT_TYPE: "gemini"
    });
  });

  test("should return correct JSON structure without --json flag", async () => {
    const result = await updateAgentContext("claude", { json: false });

    expect(result).toEqual({
      AGENT_FILE: expect.stringContaining(".claude"),
      UPDATED: expect.any(Boolean),
      AGENT_TYPE: "claude"
    });
  });

  test("should validate agent type parameter", async () => {
    await expect(updateAgentContext("invalid-agent", { json: true }))
      .rejects.toThrow(/Invalid agent type/);
  });

  test("should handle case-insensitive agent types", async () => {
    const result1 = await updateAgentContext("CLAUDE", { json: true });
    const result2 = await updateAgentContext("claude", { json: true });

    expect(result1.AGENT_TYPE).toBe("claude");
    expect(result2.AGENT_TYPE).toBe("claude");
  });

  test("should return different agent files for different agent types", async () => {
    const claudeResult = await updateAgentContext("claude", { json: true });
    const copilotResult = await updateAgentContext("copilot", { json: true });
    const geminiResult = await updateAgentContext("gemini", { json: true });

    expect(claudeResult.AGENT_FILE).not.toBe(copilotResult.AGENT_FILE);
    expect(claudeResult.AGENT_FILE).not.toBe(geminiResult.AGENT_FILE);
    expect(copilotResult.AGENT_FILE).not.toBe(geminiResult.AGENT_FILE);
  });

  test("should indicate successful update when agent file is modified", async () => {
    const result = await updateAgentContext("claude", { json: true, force: true });

    expect(result.UPDATED).toBe(true);
  });

  test("should handle dry-run mode", async () => {
    const result = await updateAgentContext("claude", { json: true, dryRun: true });

    expect(result).toHaveProperty("AGENT_FILE");
    expect(result).toHaveProperty("UPDATED");
    expect(result).toHaveProperty("AGENT_TYPE");
  });
});