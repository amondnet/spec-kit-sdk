import { describe, test, expect } from "bun:test";
import { getFeaturePaths } from "@spec-kit/scripts";

describe("getFeaturePaths contract tests", () => {
  test("should return complete path object with all required fields", async () => {
    const result = await getFeaturePaths({ json: true });

    expect(result).toEqual({
      featureNum: expect.stringMatching(/^\d{3}$/),
      branchName: expect.stringMatching(/^\d{3}-[\w-]+$/),
      specsDir: expect.stringMatching(/^specs\/\d{3}-[\w-]+$/),
      specFile: expect.stringContaining("spec.md"),
      planFile: expect.stringContaining("plan.md"),
      tasksFile: expect.stringContaining("tasks.md"),
      absoluteSpecsDir: expect.stringContaining("/specs/"),
      absoluteSpecFile: expect.stringContaining("/spec.md"),
      absolutePlanFile: expect.stringContaining("/plan.md"),
      absoluteTasksFile: expect.stringContaining("/tasks.md")
    });
  });

  test("should return correct path object without --json flag", async () => {
    const result = await getFeaturePaths({ json: false });

    expect(result).toEqual({
      featureNum: expect.stringMatching(/^\d{3}$/),
      branchName: expect.stringMatching(/^\d{3}-[\w-]+$/),
      specsDir: expect.stringMatching(/^specs\/\d{3}-[\w-]+$/),
      specFile: expect.stringContaining("spec.md"),
      planFile: expect.stringContaining("plan.md"),
      tasksFile: expect.stringContaining("tasks.md"),
      absoluteSpecsDir: expect.stringContaining("/specs/"),
      absoluteSpecFile: expect.stringContaining("/spec.md"),
      absolutePlanFile: expect.stringContaining("/plan.md"),
      absoluteTasksFile: expect.stringContaining("/tasks.md")
    });
  });

  test("should ensure feature number consistency across all paths", async () => {
    const result = await getFeaturePaths({ json: true });

    expect(result.branchName).toStartWith(result.featureNum + "-");
    expect(result.specsDir).toContain(result.featureNum + "-");
    expect(result.specFile).toContain(result.featureNum + "-");
    expect(result.planFile).toContain(result.featureNum + "-");
    expect(result.tasksFile).toContain(result.featureNum + "-");
  });

  test("should provide both relative and absolute paths", async () => {
    const result = await getFeaturePaths({ json: true });

    // Relative paths should not start with /
    expect(result.specsDir).not.toStartWith("/");
    expect(result.specFile).not.toStartWith("/");
    expect(result.planFile).not.toStartWith("/");
    expect(result.tasksFile).not.toStartWith("/");

    // Absolute paths should start with /
    expect(result.absoluteSpecsDir).toStartWith("/");
    expect(result.absoluteSpecFile).toStartWith("/");
    expect(result.absolutePlanFile).toStartWith("/");
    expect(result.absoluteTasksFile).toStartWith("/");
  });

  test("should maintain consistent directory structure", async () => {
    const result = await getFeaturePaths({ json: true });

    const expectedDir = `specs/${result.branchName}`;

    expect(result.specsDir).toBe(expectedDir);
    expect(result.specFile).toBe(`${expectedDir}/spec.md`);
    expect(result.planFile).toBe(`${expectedDir}/plan.md`);
    expect(result.tasksFile).toBe(`${expectedDir}/tasks.md`);
  });

  test("should handle feature number from current branch", async () => {
    const result = await getFeaturePaths({ json: true });

    // Feature number should be extracted from current branch or generated
    expect(result.featureNum).toMatch(/^\d{3}$/);
    expect(parseInt(result.featureNum)).toBeGreaterThan(0);
    expect(parseInt(result.featureNum)).toBeLessThan(1000);
  });

  test("should provide paths for all standard feature files", async () => {
    const result = await getFeaturePaths({ json: true });

    expect(result.specFile).toMatch(/\/spec\.md$/);
    expect(result.planFile).toMatch(/\/plan\.md$/);
    expect(result.tasksFile).toMatch(/\/tasks\.md$/);
  });

  test("should handle custom feature number parameter", async () => {
    const customFeatureNum = "042";
    const result = await getFeaturePaths({
      json: true,
      featureNum: customFeatureNum
    });

    expect(result.featureNum).toBe(customFeatureNum);
    expect(result.branchName).toStartWith(customFeatureNum + "-");
  });

  test("should ensure absolute paths include project root", async () => {
    const result = await getFeaturePaths({ json: true });

    expect(result.absoluteSpecsDir).toContain("/spec-kit");
    expect(result.absoluteSpecFile).toContain("/spec-kit");
    expect(result.absolutePlanFile).toContain("/spec-kit");
    expect(result.absoluteTasksFile).toContain("/spec-kit");
  });
});