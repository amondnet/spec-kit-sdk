/**
 * File Operations Utilities
 *
 * Provides file system operations for the spec-kit library including
 * template copying, directory creation, file existence checks, and
 * feature number calculation.
 */

import { stat, mkdir, copyFile, readdir, access } from 'fs/promises';
import { constants } from 'fs';
import path from 'path';
import { FileOperationError, FEATURE_NUMBER_PATTERN } from '../contracts/spec-kit-library.js';

export class FileOperations {
  /**
   * Copy template file to destination
   * Creates destination directory if it doesn't exist
   * @param templatePath Source template file path
   * @param destPath Destination file path
   * @throws FileOperationError if copy operation fails
   */
  async copyTemplate(templatePath: string, destPath: string): Promise<void> {
    try {
      // Check if template file exists
      if (!await this.fileExists(templatePath)) {
        throw new FileOperationError(`Template file not found: ${templatePath}`);
      }

      // Ensure destination directory exists
      const destDir = path.dirname(destPath);
      await this.createDirectory(destDir);

      // Copy the file
      await copyFile(templatePath, destPath);
    } catch (error) {
      if (error instanceof FileOperationError) {
        throw error;
      }
      throw new FileOperationError(
        `Failed to copy template from "${templatePath}" to "${destPath}": ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Create directory structure recursively
   * @param dirPath Directory path to create
   * @throws FileOperationError if directory creation fails
   */
  async createDirectory(dirPath: string): Promise<void> {
    try {
      await mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw new FileOperationError(
        `Failed to create directory "${dirPath}": ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Check if file exists and is readable
   * @param filePath Path to check
   * @returns Promise resolving to true if file exists and is readable
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath, constants.F_OK | constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if path is a directory
   * @param dirPath Path to check
   * @returns Promise resolving to true if path is a directory
   */
  async isDirectory(dirPath: string): Promise<boolean> {
    try {
      const stats = await stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Get next available feature number by scanning existing spec directories
   * @param specsDir Path to specs directory
   * @returns Promise resolving to zero-padded 3-digit feature number (e.g., "004")
   * @throws FileOperationError if unable to scan specs directory
   */
  async getNextFeatureNumber(specsDir: string): Promise<string> {
    try {
      // Create specs directory if it doesn't exist
      if (!await this.fileExists(specsDir)) {
        await this.createDirectory(specsDir);
        return '001';
      }

      if (!await this.isDirectory(specsDir)) {
        throw new FileOperationError(`Specs path "${specsDir}" exists but is not a directory`);
      }

      // Read all entries in specs directory
      const entries = await readdir(specsDir);

      // Filter to directories that match feature pattern (###-*)
      const featureDirs = entries.filter(entry => {
        const match = entry.match(/^(\d{3})-/);
        return match && FEATURE_NUMBER_PATTERN.test(match[1]);
      });

      // Extract feature numbers and find the highest
      let maxNumber = 0;
      for (const dir of featureDirs) {
        const match = dir.match(/^(\d{3})-/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNumber) {
            maxNumber = num;
          }
        }
      }

      // Return next number, zero-padded to 3 digits
      const nextNumber = maxNumber + 1;
      return nextNumber.toString().padStart(3, '0');
    } catch (error) {
      if (error instanceof FileOperationError) {
        throw error;
      }
      throw new FileOperationError(
        `Failed to get next feature number from "${specsDir}": ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Get list of all feature directories in specs directory
   * @param specsDir Path to specs directory
   * @returns Promise resolving to array of feature directory names
   */
  async getFeatureDirectories(specsDir: string): Promise<string[]> {
    try {
      if (!await this.fileExists(specsDir) || !await this.isDirectory(specsDir)) {
        return [];
      }

      const entries = await readdir(specsDir);

      // Filter to directories that match feature pattern and verify they are directories
      const featureDirs: string[] = [];
      for (const entry of entries) {
        const match = entry.match(/^(\d{3})-/);
        if (match && FEATURE_NUMBER_PATTERN.test(match[1])) {
          const entryPath = path.join(specsDir, entry);
          if (await this.isDirectory(entryPath)) {
            featureDirs.push(entry);
          }
        }
      }

      return featureDirs.sort();
    } catch (error) {
      throw new FileOperationError(
        `Failed to get feature directories from "${specsDir}": ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Read file content as string
   * @param filePath Path to file to read
   * @returns Promise resolving to file content as string
   * @throws FileOperationError if file cannot be read
   */
  async readFile(filePath: string): Promise<string> {
    try {
      const file = Bun.file(filePath);
      return await file.text();
    } catch (error) {
      throw new FileOperationError(
        `Failed to read file "${filePath}": ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Write content to file
   * @param filePath Path to file to write
   * @param content Content to write
   * @throws FileOperationError if file cannot be written
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await this.createDirectory(dir);

      // Write file using Bun's optimized file operations
      await Bun.write(filePath, content);
    } catch (error) {
      throw new FileOperationError(
        `Failed to write file "${filePath}": ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }
}

// Export singleton instance for convenience
export const files = new FileOperations();