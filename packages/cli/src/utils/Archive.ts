/**
 * Archive utilities for ZIP file handling
 */

import path from 'node:path'
import AdmZip from 'adm-zip'
import { consoleUtils } from '../ui/Console.js'
import { FileSystemUtils } from './FileSystem.js'

export interface ExtractOptions {
  flattenSingleRoot?: boolean
  mergeWithExisting?: boolean
  verbose?: boolean
}

export class ArchiveUtils {
  /**
   * Extract a ZIP file to a destination directory
   */
  static async extract(
    zipPath: string,
    destPath: string,
    options?: ExtractOptions,
  ): Promise<void> {
    const zip = new AdmZip(zipPath)
    const entries = zip.getEntries()

    if (options?.verbose) {
      consoleUtils.info(`ZIP contains ${entries.length} entries`)
    }

    // Check if we need to handle GitHub-style single root directory
    const topLevelDirs = new Set<string>()
    const topLevelFiles = new Set<string>()

    entries.forEach((entry) => {
      const parts = entry.entryName.split('/')
      if (parts.length > 0) {
        if (entry.isDirectory && parts.length === 1) {
          topLevelDirs.add(parts[0])
        }
        else if (!entry.isDirectory && parts.length === 1) {
          topLevelFiles.add(parts[0])
        }
        else if (parts.length > 1) {
          topLevelDirs.add(parts[0])
        }
      }
    })

    const shouldFlatten = options?.flattenSingleRoot
      && topLevelDirs.size === 1
      && topLevelFiles.size === 0

    if (options?.mergeWithExisting) {
      // Extract to temp directory first
      const tempDir = path.join(path.dirname(destPath), `.${path.basename(destPath)}_temp_${Date.now()}`)
      zip.extractAllTo(tempDir, true)

      // Handle flattening if needed
      let sourceDir = tempDir
      if (shouldFlatten) {
        const rootDir = Array.from(topLevelDirs)[0]
        sourceDir = path.join(tempDir, rootDir)
        if (options?.verbose) {
          consoleUtils.info('Flattening nested directory structure')
        }
      }

      // Merge with existing directory
      await this.mergeDirectories(sourceDir, destPath, options?.verbose)

      // Clean up temp directory
      await FileSystemUtils.remove(tempDir)
    }
    else {
      // Direct extraction
      if (shouldFlatten) {
        // Extract to temp, flatten, then move
        const tempDir = path.join(path.dirname(destPath), `.${path.basename(destPath)}_temp_${Date.now()}`)
        zip.extractAllTo(tempDir, true)

        const rootDir = Array.from(topLevelDirs)[0]
        const sourceDir = path.join(tempDir, rootDir)

        // Create destination if it doesn't exist
        await FileSystemUtils.createDirectory(destPath)

        // Move contents
        const items = await FileSystemUtils.listDirectory(sourceDir)
        for (const item of items) {
          const srcPath = path.join(sourceDir, item)
          const dstPath = path.join(destPath, item)

          if (await FileSystemUtils.isDirectory(srcPath)) {
            await FileSystemUtils.copyDirectory(srcPath, dstPath)
          }
          else {
            await FileSystemUtils.copyFile(srcPath, dstPath)
          }
        }

        // Clean up temp directory
        await FileSystemUtils.remove(tempDir)

        if (options?.verbose) {
          consoleUtils.info('Flattened nested directory structure')
        }
      }
      else {
        // Simple extraction
        zip.extractAllTo(destPath, true)
      }
    }
  }

  /**
   * Merge source directory into destination directory
   */
  private static async mergeDirectories(
    srcDir: string,
    destDir: string,
    verbose?: boolean,
  ): Promise<void> {
    const items = await FileSystemUtils.listDirectory(srcDir)

    for (const item of items) {
      const srcPath = path.join(srcDir, item)
      const destPath = path.join(destDir, item)

      if (await FileSystemUtils.isDirectory(srcPath)) {
        if (await FileSystemUtils.exists(destPath)) {
          if (verbose) {
            consoleUtils.warn(`Merging directory: ${item}`)
          }
          // Recursively merge directories
          await this.mergeDirectories(srcPath, destPath, verbose)
        }
        else {
          // Copy entire directory
          await FileSystemUtils.copyDirectory(srcPath, destPath)
        }
      }
      else {
        // File
        if (await FileSystemUtils.exists(destPath) && verbose) {
          consoleUtils.warn(`Overwriting file: ${item}`)
        }
        await FileSystemUtils.copyFile(srcPath, destPath)
      }
    }
  }

  /**
   * List contents of a ZIP file
   */
  static listContents(zipPath: string): string[] {
    const zip = new AdmZip(zipPath)
    return zip.getEntries().map(entry => entry.entryName)
  }

  /**
   * Check if a ZIP file is valid
   */
  static isValidZip(zipPath: string): boolean {
    try {
      const zip = new AdmZip(zipPath)
      zip.getEntries()
      return true
    }
    catch {
      return false
    }
  }
}
