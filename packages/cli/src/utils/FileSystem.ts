/**
 * File system utilities
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { PlatformUtils } from './Platform.js'

export class FileSystemUtils {
  /**
   * Check if a file or directory exists
   */
  static async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    }
    catch {
      return false
    }
  }

  /**
   * Check if a path is a directory
   */
  static async isDirectory(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath)
      return stats.isDirectory()
    }
    catch {
      return false
    }
  }

  /**
   * Create a directory recursively
   */
  static async createDirectory(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true })
  }

  /**
   * Copy a file
   */
  static async copyFile(src: string, dest: string): Promise<void> {
    const destDir = path.dirname(dest)
    await this.createDirectory(destDir)
    await fs.copyFile(src, dest)
  }

  /**
   * Copy a directory recursively
   */
  static async copyDirectory(src: string, dest: string): Promise<void> {
    await this.createDirectory(dest)

    const entries = await fs.readdir(src, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath)
      }
      else {
        await this.copyFile(srcPath, destPath)
      }
    }
  }

  /**
   * Remove a file or directory
   */
  static async remove(filePath: string): Promise<void> {
    try {
      const stats = await fs.stat(filePath)
      if (stats.isDirectory()) {
        await fs.rm(filePath, { recursive: true, force: true })
      }
      else {
        await fs.unlink(filePath)
      }
    }
    catch {
      // Ignore if doesn't exist
    }
  }

  /**
   * Read a text file
   */
  static async readFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf-8')
  }

  /**
   * Write a text file
   */
  static async writeFile(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath)
    await this.createDirectory(dir)
    await fs.writeFile(filePath, content, 'utf-8')
  }

  /**
   * List directory contents
   */
  static async listDirectory(dirPath: string): Promise<string[]> {
    try {
      return await fs.readdir(dirPath)
    }
    catch {
      return []
    }
  }

  /**
   * Make a file executable (POSIX only)
   */
  static async makeExecutable(filePath: string): Promise<void> {
    if (PlatformUtils.isWindows()) {
      return // No-op on Windows
    }

    try {
      await fs.chmod(filePath, 0o755)
    }
    catch {
      // Ignore errors
    }
  }

  /**
   * Ensure shell scripts are executable recursively
   */
  static async ensureExecutableScripts(rootPath: string): Promise<{ updated: number, failures: string[] }> {
    if (PlatformUtils.isWindows()) {
      return { updated: 0, failures: [] }
    }

    const scriptsRoot = path.join(rootPath, '.specify', 'scripts')
    const updated: string[] = []
    const failures: string[] = []

    async function processDirectory(dir: string): Promise<void> {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true })

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)

          if (entry.isDirectory()) {
            await processDirectory(fullPath)
          }
          else if (entry.name.endsWith('.sh')) {
            try {
              // Check if it starts with shebang
              const content = await fs.readFile(fullPath, 'utf-8')
              if (content.startsWith('#!')) {
                // Check current permissions
                const stats = await fs.stat(fullPath)
                const mode = stats.mode

                if (!(mode & 0o111)) {
                  // Not executable, make it so
                  let newMode = mode
                  if (mode & 0o400)
                    newMode |= 0o100 // User read -> user exec
                  if (mode & 0o040)
                    newMode |= 0o010 // Group read -> group exec
                  if (mode & 0o004)
                    newMode |= 0o001 // Other read -> other exec

                  await fs.chmod(fullPath, newMode)
                  updated.push(fullPath)
                }
              }
            }
            catch (error) {
              failures.push(`${fullPath}: ${error}`)
            }
          }
        }
      }
      catch (error) {
        failures.push(`${dir}: ${error}`)
      }
    }

    if (await this.exists(scriptsRoot)) {
      await processDirectory(scriptsRoot)
    }

    return { updated: updated.length, failures }
  }

  /**
   * Check if a directory is a git repository
   */
  static async isGitRepo(dirPath?: string): Promise<boolean> {
    const targetPath = dirPath || process.cwd()

    try {
      execSync('git rev-parse --is-inside-work-tree', {
        cwd: targetPath,
        stdio: 'ignore',
      })
      return true
    }
    catch {
      return false
    }
  }

  /**
   * Initialize a git repository
   */
  static async initGitRepo(dirPath: string): Promise<boolean> {
    try {
      execSync('git init', { cwd: dirPath, stdio: 'ignore' })
      execSync('git add .', { cwd: dirPath, stdio: 'ignore' })
      execSync('git commit -m "Initial commit from Specify template"', {
        cwd: dirPath,
        stdio: 'ignore',
      })
      return true
    }
    catch {
      return false
    }
  }
}
