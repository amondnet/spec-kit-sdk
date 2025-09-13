/**
 * Integration tests for JSON format compatibility
 * Compare TypeScript output with shell script output
 * Test exact JSON format matching
 * Verify property ordering
 * Test special character escaping
 */

import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  JsonComparator,
  TestDataGenerator,
  TEST_CONFIG
} from "../setup.ts";

import { execSync } from "child_process";
import path from "path";

// Import functions from @spec-kit/scripts (will fail until implemented)
import {
  createNewFeature,
  setupPlan,
  updateAgentContext,
  checkTaskPrerequisites,
  getFeaturePaths
} from "@spec-kit/scripts";

describe("JSON Format Compatibility Tests", () => {
  const projectRoot = process.env.PROJECT_ROOT || "/home/coder/IdeaProjects/spec-kit";
  const scriptsDir = path.join(projectRoot, "scripts", "bash");

  // Helper function to execute shell script and capture JSON output
  const executeShellScript = (scriptName: string, args: string[] = []): any => {
    try {
      const scriptPath = path.join(scriptsDir, scriptName);
      const command = `bash "${scriptPath}" ${args.join(' ')} --json`;
      const output = execSync(command, {
        encoding: 'utf8',
        cwd: projectRoot,
        timeout: 30000
      });

      // Extract JSON from output (scripts may have non-JSON output before/after)
      const jsonMatch = output.match(/\{.*\}/s);
      if (!jsonMatch) {
        throw new Error(`No JSON found in shell script output: ${output}`);
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new Error(`Failed to execute shell script ${scriptName}: ${error.message}`);
    }
  };

  describe("createNewFeature JSON Compatibility", () => {
    const scriptName = "create-new-feature.sh";

    test("should produce identical JSON structure for basic feature creation", async () => {
      const featureName = TestDataGenerator.generateFeatureName();

      // Get TypeScript output
      const tsResult = await createNewFeature(featureName, { json: true });

      // Get shell script output
      const shellResult = executeShellScript(scriptName, [featureName]);

      // Compare JSON structures
      const comparison = JsonComparator.compareJsonStrings(
        JSON.stringify(tsResult),
        JSON.stringify(shellResult)
      );

      expect(comparison.isEqual).toBe(true);
      if (!comparison.isEqual) {
        console.log("Differences found:", comparison.differences);
      }
    });

    test("should maintain property order consistency", async () => {
      const featureName = TestDataGenerator.generateFeatureName();

      const tsResult = await createNewFeature(featureName, { json: true });
      const shellResult = executeShellScript(scriptName, [featureName]);

      // Check that both outputs have the same property keys
      const tsKeys = Object.keys(tsResult);
      const shellKeys = Object.keys(shellResult);

      expect(tsKeys.sort()).toEqual(shellKeys.sort());

      // Check that properties appear in the same order
      expect(tsKeys).toEqual(shellKeys);
    });

    test("should handle special characters identically", async () => {
      const specialFeatureName = "Feature with 'quotes', \"double quotes\", & symbols!";

      const tsResult = await createNewFeature(specialFeatureName, { json: true });
      const shellResult = executeShellScript(scriptName, [specialFeatureName]);

      // Both should produce the same sanitized branch name
      expect(tsResult.BRANCH_NAME).toBe(shellResult.BRANCH_NAME);
      expect(tsResult.SPEC_FILE).toBe(shellResult.SPEC_FILE);
    });

    test("should produce identical feature number formats", async () => {
      const featureName = TestDataGenerator.generateFeatureName();

      const tsResult = await createNewFeature(featureName, { json: true });
      const shellResult = executeShellScript(scriptName, [featureName]);

      // Feature numbers should be 3-digit zero-padded
      expect(tsResult.FEATURE_NUM).toMatch(/^\d{3}$/);
      expect(shellResult.FEATURE_NUM).toMatch(/^\d{3}$/);

      // Both should generate the same feature number for the same state
      expect(parseInt(tsResult.FEATURE_NUM)).toBeGreaterThan(0);
      expect(parseInt(shellResult.FEATURE_NUM)).toBeGreaterThan(0);
    });

    test("should handle Unicode characters consistently", async () => {
      const unicodeFeatureName = "测试功能 with émojis 🚀 and symbols ★";

      const tsResult = await createNewFeature(unicodeFeatureName, { json: true });
      const shellResult = executeShellScript(scriptName, [unicodeFeatureName]);

      expect(tsResult.BRANCH_NAME).toBe(shellResult.BRANCH_NAME);
      expect(tsResult.SPEC_FILE).toBe(shellResult.SPEC_FILE);
    });

    test("should produce valid JSON with proper escaping", async () => {
      const problematicName = 'Feature with "nested \\"quotes\\"" and \\backslashes\\';

      const tsResult = await createNewFeature(problematicName, { json: true });
      const shellResult = executeShellScript(scriptName, [problematicName]);

      // Both outputs should be valid JSON
      expect(JsonComparator.isValidJson(JSON.stringify(tsResult))).toBe(true);
      expect(JsonComparator.isValidJson(JSON.stringify(shellResult))).toBe(true);

      // Content should be identical
      expect(tsResult.BRANCH_NAME).toBe(shellResult.BRANCH_NAME);
    });
  });

  describe("setupPlan JSON Compatibility", () => {
    const scriptName = "setup-plan.sh";

    test("should produce identical JSON structure", async () => {
      const tsResult = await setupPlan({ json: true });
      const shellResult = executeShellScript(scriptName, []);

      const comparison = JsonComparator.compareJsonStrings(
        JSON.stringify(tsResult),
        JSON.stringify(shellResult)
      );

      expect(comparison.isEqual).toBe(true);
    });

    test("should maintain consistent property types", async () => {
      const tsResult = await setupPlan({ json: true, includeTemplates: true });
      const shellResult = executeShellScript(scriptName, ["--include-templates"]);

      // Check that corresponding properties have the same types
      Object.keys(tsResult).forEach(key => {
        if (shellResult.hasOwnProperty(key)) {
          expect(typeof tsResult[key]).toBe(typeof shellResult[key]);
        }
      });
    });

    test("should handle array properties identically", async () => {
      const tsResult = await setupPlan({
        json: true,
        generateMultipleFiles: true
      });
      const shellResult = executeShellScript(scriptName, ["--generate-multiple"]);

      // If arrays are present, they should be identical
      Object.keys(tsResult).forEach(key => {
        if (Array.isArray(tsResult[key]) && Array.isArray(shellResult[key])) {
          expect(tsResult[key]).toEqual(shellResult[key]);
        }
      });
    });
  });

  describe("updateAgentContext JSON Compatibility", () => {
    const scriptName = "update-agent-context.sh";

    test("should produce identical JSON for different agent types", async () => {
      const agentTypes = ['claude', 'gemini', 'copilot'];

      for (const agentType of agentTypes) {
        const tsResult = await updateAgentContext(agentType, { json: true });
        const shellResult = executeShellScript(scriptName, [agentType]);

        const comparison = JsonComparator.compareJsonStrings(
          JSON.stringify(tsResult),
          JSON.stringify(shellResult)
        );

        expect(comparison.isEqual).toBe(true);
      }
    });

    test("should handle configuration paths consistently", async () => {
      const tsResult = await updateAgentContext('claude', {
        json: true,
        configPath: '/custom/path'
      });
      const shellResult = executeShellScript(scriptName, ['claude', '--config-path', '/custom/path']);

      expect(tsResult.CONFIG_PATH).toBe(shellResult.CONFIG_PATH);
    });

    test("should maintain boolean flag consistency", async () => {
      const tsResult = await updateAgentContext('claude', {
        json: true,
        backup: true,
        force: true
      });
      const shellResult = executeShellScript(scriptName, ['claude', '--backup', '--force']);

      expect(typeof tsResult.BACKUP_CREATED).toBe(typeof shellResult.BACKUP_CREATED);
      expect(typeof tsResult.FORCE_UPDATE).toBe(typeof shellResult.FORCE_UPDATE);
    });
  });

  describe("checkTaskPrerequisites JSON Compatibility", () => {
    const scriptName = "check-task-prerequisites.sh";

    test("should produce identical validation results", async () => {
      const tsResult = await checkTaskPrerequisites({ json: true });
      const shellResult = executeShellScript(scriptName, []);

      const comparison = JsonComparator.compareJsonStrings(
        JSON.stringify(tsResult),
        JSON.stringify(shellResult)
      );

      expect(comparison.isEqual).toBe(true);
    });

    test("should handle boolean checks consistently", async () => {
      const tsResult = await checkTaskPrerequisites({
        json: true,
        checkGit: true,
        checkNodeModules: true
      });
      const shellResult = executeShellScript(scriptName, ['--check-git', '--check-node-modules']);

      // Boolean properties should match
      const booleanProps = ['IS_GIT_REPO', 'HAS_NODE_MODULES', 'HAS_PACKAGE_JSON'];
      booleanProps.forEach(prop => {
        if (tsResult.hasOwnProperty(prop) && shellResult.hasOwnProperty(prop)) {
          expect(typeof tsResult[prop]).toBe('boolean');
          expect(typeof shellResult[prop]).toBe('boolean');
          expect(tsResult[prop]).toBe(shellResult[prop]);
        }
      });
    });

    test("should handle error conditions identically", async () => {
      const tsResult = await checkTaskPrerequisites({
        json: true,
        strictMode: true
      });
      const shellResult = executeShellScript(scriptName, ['--strict']);

      // Error arrays should be identical
      if (tsResult.ERRORS && shellResult.ERRORS) {
        expect(Array.isArray(tsResult.ERRORS)).toBe(true);
        expect(Array.isArray(shellResult.ERRORS)).toBe(true);
        expect(tsResult.ERRORS.length).toBe(shellResult.ERRORS.length);
      }
    });
  });

  describe("getFeaturePaths JSON Compatibility", () => {
    const scriptName = "get-feature-paths.sh";

    test("should produce identical path structures", async () => {
      const tsResult = await getFeaturePaths({ json: true });
      const shellResult = executeShellScript(scriptName, []);

      const comparison = JsonComparator.compareJsonStrings(
        JSON.stringify(tsResult),
        JSON.stringify(shellResult)
      );

      expect(comparison.isEqual).toBe(true);
    });

    test("should handle feature number parameter identically", async () => {
      const featureNum = TestDataGenerator.generateFeatureNumber();

      const tsResult = await getFeaturePaths({
        json: true,
        featureNum
      });
      const shellResult = executeShellScript(scriptName, [featureNum]);

      expect(tsResult.FEATURE_NUM).toBe(shellResult.FEATURE_NUM);
      expect(tsResult.SPEC_DIR).toBe(shellResult.SPEC_DIR);
      expect(tsResult.SPEC_FILE).toBe(shellResult.SPEC_FILE);
    });

    test("should maintain absolute path consistency", async () => {
      const tsResult = await getFeaturePaths({
        json: true,
        absolutePaths: true
      });
      const shellResult = executeShellScript(scriptName, ['--absolute']);

      // All path properties should be absolute
      const pathProps = ['PROJECT_ROOT', 'SPECS_DIR', 'SCRIPTS_DIR', 'TEMPLATES_DIR'];
      pathProps.forEach(prop => {
        if (tsResult.hasOwnProperty(prop) && shellResult.hasOwnProperty(prop)) {
          expect(path.isAbsolute(tsResult[prop])).toBe(true);
          expect(path.isAbsolute(shellResult[prop])).toBe(true);
          expect(tsResult[prop]).toBe(shellResult[prop]);
        }
      });
    });
  });

  describe("Complex JSON Structure Compatibility", () => {
    test("should handle nested objects identically", async () => {
      const tsResult = await setupPlan({
        json: true,
        includeMetadata: true,
        nestedConfig: {
          templates: true,
          validation: true
        }
      });

      const shellResult = executeShellScript("setup-plan.sh", [
        '--include-metadata',
        '--nested-config',
        'templates:true,validation:true'
      ]);

      // Nested objects should be structurally identical
      if (tsResult.METADATA && shellResult.METADATA) {
        const metadataComparison = JsonComparator.compareIgnoreOrder(
          tsResult.METADATA,
          shellResult.METADATA
        );
        expect(metadataComparison).toBe(true);
      }
    });

    test("should handle null and undefined values consistently", async () => {
      const tsResult = await createNewFeature("test", {
        json: true,
        optionalField: null,
        undefinedField: undefined
      });

      const shellResult = executeShellScript("create-new-feature.sh", [
        "test",
        "--optional-field", "null"
      ]);

      // Both should handle null values the same way (exclude undefined)
      Object.keys(tsResult).forEach(key => {
        if (tsResult[key] === null) {
          expect(shellResult[key]).toBeNull();
        }
        if (tsResult[key] === undefined) {
          expect(shellResult.hasOwnProperty(key)).toBe(false);
        }
      });
    });

    test("should maintain number precision", async () => {
      const tsResult = await checkTaskPrerequisites({
        json: true,
        includeTimestamps: true
      });

      const shellResult = executeShellScript("check-task-prerequisites.sh", [
        "--include-timestamps"
      ]);

      // Timestamps should maintain precision
      if (tsResult.TIMESTAMP && shellResult.TIMESTAMP) {
        expect(typeof tsResult.TIMESTAMP).toBe('number');
        expect(typeof shellResult.TIMESTAMP).toBe('number');
        // Allow small differences due to execution timing
        expect(Math.abs(tsResult.TIMESTAMP - shellResult.TIMESTAMP)).toBeLessThan(1000);
      }
    });

    test("should handle large JSON objects without truncation", async () => {
      const largeDescription = "A".repeat(10000); // Large description

      const tsResult = await createNewFeature(largeDescription, {
        json: true,
        includeLargeData: true
      });

      const shellResult = executeShellScript("create-new-feature.sh", [
        largeDescription,
        "--include-large-data"
      ]);

      // Both should handle large content without truncation
      const comparison = JsonComparator.compareIgnoreOrder(tsResult, shellResult);
      expect(comparison).toBe(true);
    });
  });

  describe("JSON Schema Validation", () => {
    test("should conform to expected schema structure", async () => {
      const expectedSchemas = {
        createNewFeature: {
          required: ['BRANCH_NAME', 'SPEC_FILE', 'FEATURE_NUM'],
          properties: {
            BRANCH_NAME: 'string',
            SPEC_FILE: 'string',
            FEATURE_NUM: 'string'
          }
        },
        setupPlan: {
          required: ['PLAN_CREATED', 'FILES_GENERATED'],
          properties: {
            PLAN_CREATED: 'boolean',
            FILES_GENERATED: 'object'
          }
        },
        checkTaskPrerequisites: {
          required: ['PREREQUISITES_MET', 'CHECKS_PASSED'],
          properties: {
            PREREQUISITES_MET: 'boolean',
            CHECKS_PASSED: 'object'
          }
        }
      };

      for (const [functionName, schema] of Object.entries(expectedSchemas)) {
        let result;

        switch (functionName) {
          case 'createNewFeature':
            result = await createNewFeature("test", { json: true });
            break;
          case 'setupPlan':
            result = await setupPlan({ json: true });
            break;
          case 'checkTaskPrerequisites':
            result = await checkTaskPrerequisites({ json: true });
            break;
        }

        // Check required properties exist
        schema.required.forEach(prop => {
          expect(result).toHaveProperty(prop);
        });

        // Check property types
        Object.entries(schema.properties).forEach(([prop, type]) => {
          if (result.hasOwnProperty(prop)) {
            expect(typeof result[prop]).toBe(type);
          }
        });
      }
    });

    test("should not include unexpected properties", async () => {
      const allowedProperties = {
        createNewFeature: ['BRANCH_NAME', 'SPEC_FILE', 'FEATURE_NUM', 'SPEC_DIR', 'BRANCH_CREATED'],
        setupPlan: ['PLAN_CREATED', 'FILES_GENERATED', 'TEMPLATES_USED', 'CONFIG_UPDATED'],
        checkTaskPrerequisites: ['PREREQUISITES_MET', 'CHECKS_PASSED', 'ERRORS', 'WARNINGS'],
        updateAgentContext: ['CONTEXT_UPDATED', 'CONFIG_PATH', 'BACKUP_CREATED'],
        getFeaturePaths: ['PROJECT_ROOT', 'SPECS_DIR', 'SCRIPTS_DIR', 'FEATURE_NUM', 'SPEC_DIR', 'SPEC_FILE']
      };

      for (const [functionName, allowed] of Object.entries(allowedProperties)) {
        let result;

        switch (functionName) {
          case 'createNewFeature':
            result = await createNewFeature("test", { json: true });
            break;
          case 'setupPlan':
            result = await setupPlan({ json: true });
            break;
          case 'checkTaskPrerequisites':
            result = await checkTaskPrerequisites({ json: true });
            break;
          case 'updateAgentContext':
            result = await updateAgentContext('claude', { json: true });
            break;
          case 'getFeaturePaths':
            result = await getFeaturePaths({ json: true });
            break;
        }

        // Check that only allowed properties are present
        Object.keys(result).forEach(prop => {
          expect(allowed).toContain(prop);
        });
      }
    });
  });
});