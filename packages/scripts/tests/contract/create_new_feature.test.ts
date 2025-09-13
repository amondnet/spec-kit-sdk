import { describe, test, expect } from "bun:test";
import { createNewFeature } from "@spec-kit/scripts";

describe("createNewFeature contract tests", () => {
  test("should return correct JSON structure with --json flag", async () => {
    const result = await createNewFeature("test feature description", { json: true });

    expect(result).toEqual({
      BRANCH_NAME: expect.stringMatching(/^\d{3}-[\w-]+$/),
      SPEC_FILE: expect.stringContaining("spec.md"),
      FEATURE_NUM: expect.stringMatching(/^\d{3}$/)
    });
  });

  test("should return correct JSON structure without --json flag", async () => {
    const result = await createNewFeature("another test feature", { json: false });

    expect(result).toEqual({
      BRANCH_NAME: expect.stringMatching(/^\d{3}-[\w-]+$/),
      SPEC_FILE: expect.stringContaining("spec.md"),
      FEATURE_NUM: expect.stringMatching(/^\d{3}$/)
    });
  });

  test("should auto-increment feature numbers", async () => {
    const result1 = await createNewFeature("first feature", { json: true });
    const result2 = await createNewFeature("second feature", { json: true });

    const num1 = parseInt(result1.FEATURE_NUM);
    const num2 = parseInt(result2.FEATURE_NUM);

    expect(num2).toBeGreaterThan(num1);
  });

  test("should handle feature names with spaces and special characters", async () => {
    const result = await createNewFeature("My Feature with Spaces & Symbols!", { json: true });

    expect(result.BRANCH_NAME).toMatch(/^\d{3}-[\w-]+$/);
    expect(result.BRANCH_NAME).not.toContain(" ");
    expect(result.BRANCH_NAME).not.toContain("&");
    expect(result.BRANCH_NAME).not.toContain("!");
  });

  test("should generate consistent spec file path format", async () => {
    const result = await createNewFeature("test feature", { json: true });

    expect(result.SPEC_FILE).toMatch(/^specs\/\d{3}-[\w-]+\/spec\.md$/);
  });

  test("should use feature number in branch name", async () => {
    const result = await createNewFeature("test feature", { json: true });

    expect(result.BRANCH_NAME).toStartWith(result.FEATURE_NUM + "-");
  });
});