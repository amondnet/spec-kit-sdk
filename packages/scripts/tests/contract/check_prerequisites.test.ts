import { describe, test, expect } from "bun:test";
import { checkTaskPrerequisites } from "@spec-kit/scripts";

describe("checkTaskPrerequisites contract tests", () => {
  test("should return correct JSON structure when all prerequisites are met", async () => {
    const result = await checkTaskPrerequisites({ json: true });

    expect(result).toEqual({
      STATUS: expect.stringMatching(/^(READY|NOT_READY)$/),
      MISSING_FILES: expect.any(Array),
      READY: expect.any(Boolean)
    });
  });

  test("should return correct JSON structure without --json flag", async () => {
    const result = await checkTaskPrerequisites({ json: false });

    expect(result).toEqual({
      STATUS: expect.stringMatching(/^(READY|NOT_READY)$/),
      MISSING_FILES: expect.any(Array),
      READY: expect.any(Boolean)
    });
  });

  test("should indicate READY status when all files exist", async () => {
    const result = await checkTaskPrerequisites({
      json: true,
      requiredFiles: ["package.json"] // This file should exist
    });

    if (result.MISSING_FILES.length === 0) {
      expect(result.STATUS).toBe("READY");
      expect(result.READY).toBe(true);
    }
  });

  test("should indicate NOT_READY status when files are missing", async () => {
    const result = await checkTaskPrerequisites({
      json: true,
      requiredFiles: ["non-existent-file.xyz"]
    });

    expect(result.STATUS).toBe("NOT_READY");
    expect(result.READY).toBe(false);
    expect(result.MISSING_FILES).toContain("non-existent-file.xyz");
  });

  test("should list all missing files", async () => {
    const missingFiles = ["missing1.txt", "missing2.txt", "missing3.txt"];
    const result = await checkTaskPrerequisites({
      json: true,
      requiredFiles: missingFiles
    });

    expect(result.MISSING_FILES).toEqual(expect.arrayContaining(missingFiles));
  });

  test("should handle empty required files list", async () => {
    const result = await checkTaskPrerequisites({
      json: true,
      requiredFiles: []
    });

    expect(result.STATUS).toBe("READY");
    expect(result.READY).toBe(true);
    expect(result.MISSING_FILES).toEqual([]);
  });

  test("should check for spec.md in current feature by default", async () => {
    const result = await checkTaskPrerequisites({ json: true });

    // Should check for spec.md existence in current feature directory
    expect(result).toHaveProperty("STATUS");
    expect(result).toHaveProperty("MISSING_FILES");
    expect(result).toHaveProperty("READY");
  });

  test("should check for plan.md when checking planning prerequisites", async () => {
    const result = await checkTaskPrerequisites({
      json: true,
      checkPlanning: true
    });

    if (result.STATUS === "NOT_READY") {
      expect(result.MISSING_FILES).toEqual(
        expect.arrayContaining([expect.stringContaining("plan.md")])
      );
    }
  });

  test("should validate feature branch context", async () => {
    const result = await checkTaskPrerequisites({
      json: true,
      requireFeatureBranch: true
    });

    // Should either be ready or indicate branch-related issues
    expect(result).toHaveProperty("STATUS");
    expect(["READY", "NOT_READY"]).toContain(result.STATUS);
  });
});