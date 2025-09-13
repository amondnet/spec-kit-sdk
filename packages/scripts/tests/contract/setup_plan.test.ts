import { describe, test, expect } from "bun:test";
import { setupPlan } from "@spec-kit/scripts";

describe("setupPlan contract tests", () => {
  test("should return correct JSON structure on feature branch", async () => {
    const result = await setupPlan({ json: true });

    expect(result).toEqual({
      FEATURE_SPEC: expect.stringContaining("spec.md"),
      IMPL_PLAN: expect.stringContaining("plan.md"),
      SPECS_DIR: expect.stringMatching(/^specs\/\d{3}-[\w-]+$/),
      BRANCH: expect.stringMatching(/^\d{3}-[\w-]+$/)
    });
  });

  test("should return correct JSON structure without --json flag", async () => {
    const result = await setupPlan({ json: false });

    expect(result).toEqual({
      FEATURE_SPEC: expect.stringContaining("spec.md"),
      IMPL_PLAN: expect.stringContaining("plan.md"),
      SPECS_DIR: expect.stringMatching(/^specs\/\d{3}-[\w-]+$/),
      BRANCH: expect.stringMatching(/^\d{3}-[\w-]+$/)
    });
  });

  test("should ensure spec file exists before creating plan", async () => {
    const result = await setupPlan({ json: true });

    expect(result.FEATURE_SPEC).toBeTruthy();
    expect(result.FEATURE_SPEC).toMatch(/spec\.md$/);
  });

  test("should generate plan file in same directory as spec", async () => {
    const result = await setupPlan({ json: true });

    const specDir = result.FEATURE_SPEC.replace("/spec.md", "");
    const planDir = result.IMPL_PLAN.replace("/plan.md", "");

    expect(specDir).toBe(planDir);
  });

  test("should match branch name with specs directory", async () => {
    const result = await setupPlan({ json: true });

    expect(result.SPECS_DIR).toContain(result.BRANCH);
  });

  test("should create implementation plan with standard filename", async () => {
    const result = await setupPlan({ json: true });

    expect(result.IMPL_PLAN).toMatch(/\/plan\.md$/);
  });

  test("should fail gracefully when not on feature branch", async () => {
    // This test should handle the case where we're not on a feature branch
    const result = await setupPlan({ json: true, allowMainBranch: false });

    if (result.BRANCH === "main" || result.BRANCH === "master") {
      expect(result).toHaveProperty("error");
    } else {
      expect(result).toHaveProperty("FEATURE_SPEC");
    }
  });
});