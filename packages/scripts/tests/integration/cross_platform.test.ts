/**
 * Integration tests for cross-platform compatibility
 * Tests cross-platform path handling (Windows, macOS, Linux)
 * Tests git operations across platforms
 * Tests file system operations with different path separators
 */

import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  PlatformMocker,
  FileSystemMocker,
  GitMocker,
  TEST_CONFIG,
  TestDataGenerator
} from "../setup.ts";

// Import functions from @spec-kit/scripts (will fail until implemented)
import {
  createNewFeature,
  setupPlan,
  updateAgentContext,
  checkTaskPrerequisites,
  getFeaturePaths
} from "@spec-kit/scripts";

describe("Cross-Platform Compatibility Tests", () => {
  let platformMocker: PlatformMocker;
  let fsMocker: FileSystemMocker;
  let gitMocker: GitMocker;

  beforeEach(() => {
    platformMocker = new PlatformMocker();
    fsMocker = new FileSystemMocker();
    gitMocker = new GitMocker();
  });

  afterEach(() => {
    platformMocker.restore();
    fsMocker.restore();
  });

  describe("Path Handling Across Platforms", () => {
    TEST_CONFIG.platforms.forEach(platform => {
      describe(`Platform: ${platform}`, () => {
        beforeEach(() => {
          platformMocker.mockPlatform(platform);
          fsMocker.mockMethods();
        });

        test("should handle path separators correctly", async () => {
          const featureName = TestDataGenerator.generateFeatureName();

          // Mock file system to return existing specs
          fsMocker.mockDirectoryExists("specs", true);
          fsMocker.mockReaddir("specs", ["001-existing-feature", "002-another-feature"]);

          const result = await createNewFeature(featureName, { json: true });

          expect(result).toBeDefined();
          expect(result.SPEC_FILE).toBeDefined();

          if (platform === 'win32') {
            // Windows should handle both forward and backward slashes
            expect(result.SPEC_FILE).toMatch(/^specs[\/\\]\d{3}-[\w-]+[\/\\]spec\.md$/);
          } else {
            // Unix-like systems use forward slashes
            expect(result.SPEC_FILE).toMatch(/^specs\/\d{3}-[\w-]+\/spec\.md$/);
          }
        });

        test("should handle working directory correctly", async () => {
          const testCwd = platform === 'win32' ? 'C:\\test\\project' : '/test/project';
          platformMocker.mockCwd(testCwd);

          const result = await getFeaturePaths({ json: true });

          expect(result).toBeDefined();
          expect(result.PROJECT_ROOT).toBeDefined();

          if (platform === 'win32') {
            expect(result.PROJECT_ROOT).toMatch(/^[A-Z]:[\/\\]/);
          } else {
            expect(result.PROJECT_ROOT).toMatch(/^\//);
          }
        });

        test("should handle file path resolution", async () => {
          const featureNum = TestDataGenerator.generateFeatureNumber();
          const featureName = TestDataGenerator.generateFeatureName();

          fsMocker.mockDirectoryExists("specs", true);
          fsMocker.mockReaddir("specs", []);

          const result = await createNewFeature(featureName, {
            json: true,
            featureNum
          });

          expect(result.SPEC_FILE).toBeDefined();

          // Verify path components are correctly joined regardless of platform
          const pathParts = result.SPEC_FILE.split(/[\/\\]/);
          expect(pathParts[0]).toBe('specs');
          expect(pathParts[1]).toMatch(/^\d{3}-[\w-]+$/);
          expect(pathParts[2]).toBe('spec.md');
        });

        test("should handle environment variables correctly", async () => {
          const envVars = platform === 'win32'
            ? { HOME: 'C:\\Users\\test', USERPROFILE: 'C:\\Users\\test' }
            : { HOME: '/home/test', USER: 'test' };

          platformMocker.mockEnv(envVars);

          const result = await updateAgentContext('claude', {
            json: true,
            userHome: true
          });

          expect(result).toBeDefined();
          // Should work regardless of platform-specific env vars
        });

        test("should handle temp directory paths", async () => {
          const tempDir = platform === 'win32'
            ? 'C:\\Windows\\Temp\\spec-kit-test'
            : '/tmp/spec-kit-test';

          platformMocker.mockEnv({ TMPDIR: tempDir, TEMP: tempDir, TMP: tempDir });

          const result = await checkTaskPrerequisites({
            json: true,
            useTempDir: true
          });

          expect(result).toBeDefined();
          // Should handle temp directories appropriately for each platform
        });
      });
    });
  });

  describe("Git Operations Across Platforms", () => {
    TEST_CONFIG.platforms.forEach(platform => {
      describe(`Git on ${platform}`, () => {
        beforeEach(() => {
          platformMocker.mockPlatform(platform);
          gitMocker.mockBranchList(['main', '001-test-feature'], 'main');
          gitMocker.mockStatus({ isClean: () => true });
        });

        test("should handle git branch names correctly", async () => {
          const featureName = "My Feature with Spaces & Symbols!";

          const result = await createNewFeature(featureName, { json: true });

          expect(result.BRANCH_NAME).toBeDefined();
          expect(result.BRANCH_NAME).toMatch(/^\d{3}-[\w-]+$/);

          // Branch names should be sanitized consistently across platforms
          expect(result.BRANCH_NAME).not.toContain(' ');
          expect(result.BRANCH_NAME).not.toContain('&');
          expect(result.BRANCH_NAME).not.toContain('!');
        });

        test("should handle git repository detection", async () => {
          fsMocker.mockDirectoryExists('.git', true);

          const result = await checkTaskPrerequisites({ json: true });

          expect(result).toBeDefined();
          expect(result.IS_GIT_REPO).toBe(true);
        });

        test("should handle git branch creation", async () => {
          const featureName = TestDataGenerator.generateFeatureName();

          const result = await createNewFeature(featureName, {
            json: true,
            createBranch: true
          });

          expect(result).toBeDefined();
          expect(result.BRANCH_CREATED).toBeDefined();
        });

        test("should handle git status check", async () => {
          gitMocker.mockStatus({
            isClean: () => false,
            modified: ['test.ts'],
            staged: [],
            not_added: ['new-file.ts']
          });

          const result = await checkTaskPrerequisites({ json: true });

          expect(result).toBeDefined();
          expect(result.GIT_STATUS).toBeDefined();
        });
      });
    });
  });

  describe("File System Operations Across Platforms", () => {
    TEST_CONFIG.platforms.forEach(platform => {
      describe(`File System on ${platform}`, () => {
        beforeEach(() => {
          platformMocker.mockPlatform(platform);
          fsMocker.mockMethods();
        });

        test("should handle directory creation", async () => {
          const featureName = TestDataGenerator.generateFeatureName();

          fsMocker.mockDirectoryExists("specs", true);
          fsMocker.mockReaddir("specs", []);
          fsMocker.mockDirectoryExists(`specs/003-${featureName.replace(/\s+/g, '-')}`, false);

          const result = await createNewFeature(featureName, {
            json: true,
            createDirectories: true
          });

          expect(result).toBeDefined();
          expect(result.DIRECTORIES_CREATED).toBeDefined();
        });

        test("should handle file reading/writing", async () => {
          const templateContent = "# Feature Template\n\nDescription: {{description}}";
          fsMocker.mockReadFile("templates/spec-template.md", templateContent);

          const result = await setupPlan({
            json: true,
            useTemplate: true
          });

          expect(result).toBeDefined();
          expect(result.TEMPLATE_PROCESSED).toBeDefined();
        });

        test("should handle symbolic links (Unix only)", async () => {
          if (platform !== 'win32') {
            fsMocker.mockFileExists("scripts/common.sh", true);

            const result = await checkTaskPrerequisites({
              json: true,
              checkSymlinks: true
            });

            expect(result).toBeDefined();
            expect(result.SYMLINKS_VALID).toBeDefined();
          }
        });

        test("should handle file permissions (Unix only)", async () => {
          if (platform !== 'win32') {
            const result = await checkTaskPrerequisites({
              json: true,
              checkPermissions: true
            });

            expect(result).toBeDefined();
            expect(result.PERMISSIONS_OK).toBeDefined();
          }
        });

        test("should handle case sensitivity differences", async () => {
          const featureName = "Test Feature";

          // Mock existing files with different cases
          if (platform === 'win32') {
            // Windows is case-insensitive
            fsMocker.mockFileExists("SPECS/test-feature/spec.md", false);
            fsMocker.mockFileExists("specs/test-feature/spec.md", false);
          } else {
            // Unix is case-sensitive
            fsMocker.mockFileExists("SPECS/test-feature/spec.md", false);
            fsMocker.mockFileExists("specs/test-feature/spec.md", false);
          }

          const result = await createNewFeature(featureName, { json: true });

          expect(result).toBeDefined();
          expect(result.SPEC_FILE).toBeDefined();
        });
      });
    });
  });

  describe("Error Handling Across Platforms", () => {
    TEST_CONFIG.platforms.forEach(platform => {
      describe(`Error Handling on ${platform}`, () => {
        beforeEach(() => {
          platformMocker.mockPlatform(platform);
          fsMocker.mockMethods();
        });

        test("should handle permission errors appropriately", async () => {
          const error = platform === 'win32'
            ? new Error('EACCES: permission denied')
            : new Error('EACCES: permission denied, open \'/protected/file\'');

          fsMocker.fsPromises.writeFile.mockRejectedValue(error);

          await expect(createNewFeature("test", {
            json: true,
            createFiles: true
          })).rejects.toThrow();
        });

        test("should handle path too long errors (Windows)", async () => {
          if (platform === 'win32') {
            const longPath = 'C:\\' + 'very-long-directory-name\\'.repeat(50) + 'file.md';

            fsMocker.fsPromises.writeFile.mockRejectedValue(
              new Error('ENAMETOOLONG: name too long')
            );

            await expect(createNewFeature("test", {
              json: true,
              outputPath: longPath
            })).rejects.toThrow();
          }
        });

        test("should handle disk space errors", async () => {
          fsMocker.fsPromises.writeFile.mockRejectedValue(
            new Error('ENOSPC: no space left on device')
          );

          await expect(setupPlan({
            json: true,
            generateLargeFiles: true
          })).rejects.toThrow();
        });

        test("should handle network drive issues (Windows)", async () => {
          if (platform === 'win32') {
            platformMocker.mockCwd('\\\\network\\share\\project');

            fsMocker.fsPromises.access.mockRejectedValue(
              new Error('ENOENT: no such file or directory')
            );

            const result = await checkTaskPrerequisites({ json: true });

            expect(result).toBeDefined();
            expect(result.NETWORK_ACCESSIBLE).toBeDefined();
          }
        });
      });
    });
  });

  describe("Character Encoding Across Platforms", () => {
    TEST_CONFIG.platforms.forEach(platform => {
      describe(`Character Encoding on ${platform}`, () => {
        beforeEach(() => {
          platformMocker.mockPlatform(platform);
          fsMocker.mockMethods();
        });

        test("should handle Unicode characters in feature names", async () => {
          const unicodeFeatureName = "测试功能 Test Féature with émojis 🚀";

          const result = await createNewFeature(unicodeFeatureName, { json: true });

          expect(result).toBeDefined();
          expect(result.BRANCH_NAME).toBeDefined();

          // Branch name should be ASCII-safe
          expect(result.BRANCH_NAME).toMatch(/^[0-9a-zA-Z-]+$/);
        });

        test("should handle special characters in paths", async () => {
          const specialChars = platform === 'win32'
            ? 'feature<>:"|?*name'  // Windows invalid chars
            : 'feature/with\\special:chars';  // Unix special chars

          const result = await createNewFeature(specialChars, { json: true });

          expect(result).toBeDefined();
          expect(result.BRANCH_NAME).not.toMatch(/[<>:"|?*\\\/]/);
        });

        test("should handle encoding in file content", async () => {
          const unicodeContent = "# Feature 测试\n\nThis has émojis 🎉 and special chars";

          fsMocker.mockReadFile("template.md", unicodeContent);

          const result = await setupPlan({
            json: true,
            processTemplate: true
          });

          expect(result).toBeDefined();
          expect(result.CONTENT_PROCESSED).toBeDefined();
        });
      });
    });
  });
});