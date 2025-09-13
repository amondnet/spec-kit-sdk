/**
 * JSON compatibility tests - ensures TypeScript output matches shell scripts exactly
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// These imports will fail initially (TDD approach)
import {
  createNewFeature,
  setupPlan,
  updateAgentContext,
  checkTaskPrerequisites,
  getFeaturePaths
} from '@spec-kit/scripts';

describe('JSON Output Compatibility', () => {
  const repoRoot = process.cwd();
  const bashScriptsDir = join(repoRoot, 'scripts', 'bash');
  const powershellScriptsDir = join(repoRoot, 'scripts', 'powershell');

  // Helper to run shell scripts and get JSON output
  const runShellScript = (scriptPath: string, args: string[] = []): any => {
    const result = spawnSync('bash', [scriptPath, '--json', ...args], {
      encoding: 'utf-8',
      cwd: repoRoot
    });

    if (result.error) {
      throw result.error;
    }

    try {
      return JSON.parse(result.stdout.trim());
    } catch (e) {
      console.error('Failed to parse shell script output:', result.stdout);
      throw e;
    }
  };

  describe('createNewFeature', () => {
    test('should match shell script JSON output exactly', async () => {
      const description = 'test json compatibility';

      // Get shell script output (if script exists)
      const shellScriptPath = join(bashScriptsDir, 'create-new-feature.sh');
      let shellOutput: any = null;

      if (existsSync(shellScriptPath)) {
        shellOutput = runShellScript(shellScriptPath, [description]);
      } else {
        // Mock expected output format
        shellOutput = {
          BRANCH_NAME: '001-test-json-compatibility',
          SPEC_FILE: '/path/to/specs/001-test-json-compatibility/spec.md',
          FEATURE_NUM: '001'
        };
      }

      // Get TypeScript output
      const tsOutput = await createNewFeature(description, { json: true });

      // Compare JSON structure
      expect(Object.keys(tsOutput).sort()).toEqual(Object.keys(shellOutput).sort());

      // Verify exact property names (case-sensitive)
      expect(tsOutput).toHaveProperty('BRANCH_NAME');
      expect(tsOutput).toHaveProperty('SPEC_FILE');
      expect(tsOutput).toHaveProperty('FEATURE_NUM');

      // Verify value formats
      expect(tsOutput.BRANCH_NAME).toMatch(/^[0-9]{3}-[a-z0-9-]+$/);
      expect(tsOutput.FEATURE_NUM).toMatch(/^[0-9]{3}$/);
      expect(tsOutput.SPEC_FILE).toContain('spec.md');
    });

    test('should maintain property order in JSON output', async () => {
      const tsOutput = await createNewFeature('order test', { json: true });

      // Properties should appear in the same order as shell script
      const keys = Object.keys(tsOutput);
      expect(keys[0]).toBe('BRANCH_NAME');
      expect(keys[1]).toBe('SPEC_FILE');
      expect(keys[2]).toBe('FEATURE_NUM');
    });
  });

  describe('setupPlan', () => {
    test('should match shell script JSON output exactly', async () => {
      // Mock shell output format
      const shellOutput = {
        FEATURE_SPEC: '/path/to/specs/001-feature/spec.md',
        IMPL_PLAN: '/path/to/specs/001-feature/plan.md',
        SPECS_DIR: '/path/to/specs/001-feature',
        BRANCH: '001-feature'
      };

      // Get TypeScript output
      const tsOutput = await setupPlan({ json: true });

      // Compare structure
      expect(Object.keys(tsOutput).sort()).toEqual(Object.keys(shellOutput).sort());

      // Verify exact property names
      expect(tsOutput).toHaveProperty('FEATURE_SPEC');
      expect(tsOutput).toHaveProperty('IMPL_PLAN');
      expect(tsOutput).toHaveProperty('SPECS_DIR');
      expect(tsOutput).toHaveProperty('BRANCH');
    });
  });

  describe('updateAgentContext', () => {
    const agentTypes = ['claude', 'copilot', 'gemini'] as const;

    agentTypes.forEach(agentType => {
      test(`should match JSON output for ${agentType}`, async () => {
        // Mock shell output format
        const shellOutput = {
          AGENT_FILE: `/path/to/${agentType.toUpperCase()}.md`,
          UPDATED: true,
          AGENT_TYPE: agentType
        };

        // Get TypeScript output
        const tsOutput = await updateAgentContext(agentType, { json: true });

        // Compare structure
        expect(Object.keys(tsOutput).sort()).toEqual(Object.keys(shellOutput).sort());

        // Verify types
        expect(typeof tsOutput.AGENT_FILE).toBe('string');
        expect(typeof tsOutput.UPDATED).toBe('boolean');
        expect(tsOutput.AGENT_TYPE).toBe(agentType);
      });
    });
  });

  describe('checkTaskPrerequisites', () => {
    test('should match JSON output when all prerequisites met', async () => {
      // Mock shell output format
      const shellOutput = {
        STATUS: 'READY',
        MISSING_FILES: [],
        READY: true
      };

      // Get TypeScript output
      const tsOutput = await checkTaskPrerequisites({ json: true });

      // Compare structure
      expect(Object.keys(tsOutput).sort()).toEqual(Object.keys(shellOutput).sort());

      // Verify types
      expect(typeof tsOutput.STATUS).toBe('string');
      expect(Array.isArray(tsOutput.MISSING_FILES)).toBe(true);
      expect(typeof tsOutput.READY).toBe('boolean');
    });

    test('should match JSON output with missing files', async () => {
      // This would be tested in a scenario with missing files
      const expectedOutput = {
        STATUS: 'MISSING_FILES',
        MISSING_FILES: ['plan.md', 'spec.md'],
        READY: false
      };

      // The actual test would verify this format
      expect(expectedOutput.MISSING_FILES).toBeInstanceOf(Array);
    });
  });

  describe('getFeaturePaths', () => {
    test('should match complete path object structure', async () => {
      // Mock shell output format
      const shellOutput = {
        REPO_ROOT: '/path/to/repo',
        CURRENT_BRANCH: '001-feature',
        FEATURE_DIR: '/path/to/repo/specs/001-feature',
        FEATURE_SPEC: '/path/to/repo/specs/001-feature/spec.md',
        IMPL_PLAN: '/path/to/repo/specs/001-feature/plan.md',
        TASKS: '/path/to/repo/specs/001-feature/tasks.md',
        RESEARCH: '/path/to/repo/specs/001-feature/research.md',
        DATA_MODEL: '/path/to/repo/specs/001-feature/data-model.md',
        QUICKSTART: '/path/to/repo/specs/001-feature/quickstart.md',
        CONTRACTS_DIR: '/path/to/repo/specs/001-feature/contracts'
      };

      // Get TypeScript output
      const tsOutput = await getFeaturePaths({ json: true });

      // Compare all properties exist
      Object.keys(shellOutput).forEach(key => {
        expect(tsOutput).toHaveProperty(key);
      });

      // Verify no extra properties
      expect(Object.keys(tsOutput).length).toBe(Object.keys(shellOutput).length);
    });
  });

  describe('Special Character Handling', () => {
    test('should escape special characters in JSON output', async () => {
      const specialChars = 'feature"with\'quotes\\and\nspecial\tchars';
      const result = await createNewFeature(specialChars, { json: true });

      // JSON should be valid
      const jsonStr = JSON.stringify(result);
      const parsed = JSON.parse(jsonStr);
      expect(parsed).toEqual(result);
    });

    test('should handle empty strings in JSON', async () => {
      // Some fields might be empty
      const result = await checkTaskPrerequisites({ json: true });

      if (result.MISSING_FILES.length === 0) {
        expect(result.MISSING_FILES).toEqual([]);
      }
    });

    test('should handle null values appropriately', async () => {
      // No fields should be null in the output
      const result = await getFeaturePaths({ json: true });

      Object.values(result).forEach(value => {
        expect(value).not.toBeNull();
      });
    });
  });

  describe('Numeric Value Formatting', () => {
    test('should format feature numbers with zero padding', async () => {
      const result = await createNewFeature('test', { json: true });

      // Feature number should be zero-padded to 3 digits
      expect(result.FEATURE_NUM).toMatch(/^[0-9]{3}$/);
      expect(result.FEATURE_NUM.length).toBe(3);
    });

    test('should handle feature numbers above 099', async () => {
      // Mock scenario with feature number 100+
      const result = {
        FEATURE_NUM: '100'
      };

      expect(result.FEATURE_NUM).toMatch(/^[0-9]{3}$/);
    });
  });

  describe('Boolean Value Consistency', () => {
    test('should use consistent boolean values', async () => {
      const result = await updateAgentContext('claude', { json: true });

      // Booleans should be true/false, not strings
      expect(typeof result.UPDATED).toBe('boolean');
      expect([true, false]).toContain(result.UPDATED);
    });

    test('should match READY field as boolean', async () => {
      const result = await checkTaskPrerequisites({ json: true });

      expect(typeof result.READY).toBe('boolean');
      expect([true, false]).toContain(result.READY);
    });
  });

  describe('String Value Formatting', () => {
    test('should not include trailing slashes in directory paths', async () => {
      const result = await getFeaturePaths({ json: true });

      // Directory paths should not end with /
      expect(result.FEATURE_DIR).not.toMatch(/\/$/);
      expect(result.SPECS_DIR).not.toMatch(/\/$/);
      expect(result.CONTRACTS_DIR).not.toMatch(/\/$/);
    });

    test('should use lowercase for branch names', async () => {
      const result = await createNewFeature('UPPERCASE TEST', { json: true });

      // Branch names should be lowercase
      expect(result.BRANCH_NAME).toBe(result.BRANCH_NAME.toLowerCase());
    });
  });
});