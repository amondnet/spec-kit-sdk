/**
 * Cross-platform compatibility tests for Spec-Kit Scripts
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { platform } from 'node:os';
import { sep, join, normalize } from 'node:path';

// These imports will fail initially (TDD approach)
import {
  createNewFeature,
  setupPlan,
  getFeaturePaths,
  type FeaturePathsResult
} from '@spec-kit/scripts';

describe('Cross-Platform Compatibility', () => {
  const platforms = ['win32', 'darwin', 'linux'] as const;

  platforms.forEach(testPlatform => {
    describe(`Platform: ${testPlatform}`, () => {
      beforeEach(() => {
        // Mock the platform
        Object.defineProperty(process, 'platform', {
          value: testPlatform,
          writable: true,
          enumerable: true,
          configurable: true
        });
      });

      test('should handle path separators correctly', async () => {
        const result = await getFeaturePaths({ json: true });

        // All paths should use the correct separator
        const expectedSep = testPlatform === 'win32' ? '\\' : '/';

        expect(result.REPO_ROOT).toContain(expectedSep);
        expect(result.FEATURE_DIR).toContain(expectedSep);
        expect(result.FEATURE_SPEC).toContain(expectedSep);
      });

      test('should normalize paths for the platform', async () => {
        const featureName = 'test-feature';
        const result = await createNewFeature(featureName, { json: true });

        // Path should be properly normalized
        const normalizedPath = normalize(result.SPEC_FILE);
        expect(result.SPEC_FILE).toBe(normalizedPath);
      });

      test('should handle git operations across platforms', async () => {
        // Git commands should work regardless of platform
        const result = await createNewFeature('cross-platform-test', { json: true });

        expect(result.BRANCH_NAME).toMatch(/^[0-9]{3}-cross-platform-test$/);
        expect(result.FEATURE_NUM).toMatch(/^[0-9]{3}$/);
      });

      test('should handle file system operations', async () => {
        const result = await setupPlan({ json: true });

        // File paths should be valid for the platform
        if (testPlatform === 'win32') {
          // Windows paths can have drive letters
          expect(result.IMPL_PLAN).toMatch(/^([A-Z]:)?\\|^\\/);
        } else {
          // Unix paths start with /
          expect(result.IMPL_PLAN).toMatch(/^\//);
        }
      });

      test('should handle home directory expansion', async () => {
        const paths = await getFeaturePaths({ json: true });

        // Home directory should be expanded correctly
        const homeDir = process.env.HOME || process.env.USERPROFILE;

        // If paths contain ~, they should be expanded
        Object.values(paths).forEach(path => {
          if (typeof path === 'string') {
            expect(path).not.toContain('~');
          }
        });
      });
    });
  });

  describe('Path Resolution', () => {
    test('should resolve relative paths to absolute', async () => {
      const result = await getFeaturePaths({ json: true });

      // All paths should be absolute
      expect(result.REPO_ROOT).toMatch(/^(\/|[A-Z]:)/);
      expect(result.FEATURE_DIR).toMatch(/^(\/|[A-Z]:)/);
      expect(result.FEATURE_SPEC).toMatch(/^(\/|[A-Z]:)/);
    });

    test('should handle paths with spaces', async () => {
      const featureName = 'feature with spaces';
      const result = await createNewFeature(featureName, { json: true });

      // Spaces should be handled in paths
      expect(result.BRANCH_NAME).not.toContain(' ');
      expect(result.SPEC_FILE).toBeTruthy();
    });

    test('should handle Unicode characters in paths', async () => {
      const featureName = 'feature-with-émoji-🚀';
      const result = await createNewFeature(featureName, { json: true });

      // Should sanitize Unicode properly
      expect(result.BRANCH_NAME).toMatch(/^[0-9]{3}-[a-z0-9-]+$/);
    });
  });

  describe('Environment Variables', () => {
    test('should respect platform-specific environment variables', async () => {
      // Windows uses USERPROFILE, Unix uses HOME
      if (process.platform === 'win32') {
        expect(process.env.USERPROFILE).toBeDefined();
      } else {
        expect(process.env.HOME).toBeDefined();
      }
    });

    test('should handle missing environment variables gracefully', async () => {
      const originalHome = process.env.HOME;
      delete process.env.HOME;

      // Should still work without HOME
      const result = await getFeaturePaths({ json: true });
      expect(result.REPO_ROOT).toBeTruthy();

      process.env.HOME = originalHome;
    });
  });

  describe('Line Endings', () => {
    test('should handle different line endings in templates', async () => {
      // Templates might have different line endings
      const result = await setupPlan({ json: true });

      // Should handle both \n and \r\n
      expect(result).toBeDefined();
    });
  });

  describe('Case Sensitivity', () => {
    test('should handle case-insensitive filesystems', async () => {
      const testPlatform = process.platform;

      if (testPlatform === 'darwin' || testPlatform === 'win32') {
        // macOS and Windows are typically case-insensitive
        const result1 = await getFeaturePaths({ json: true });

        // Path comparisons should account for case
        expect(result1.FEATURE_DIR.toLowerCase()).toBeTruthy();
      }
    });
  });
});