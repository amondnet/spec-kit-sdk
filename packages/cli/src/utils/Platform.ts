/**
 * Platform detection and OS-specific utilities
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import process from 'node:process'

export type ScriptType = 'sh' | 'ps'
export type Platform = 'windows' | 'mac' | 'linux'

export class PlatformUtils {
  /**
   * Get the current platform
   */
  static getPlatform(): Platform {
    const platform = process.platform
    if (platform === 'win32')
      return 'windows'
    if (platform === 'darwin')
      return 'mac'
    return 'linux'
  }

  /**
   * Get the default script type for the current platform
   */
  static getDefaultScriptType(): ScriptType {
    return this.getPlatform() === 'windows' ? 'ps' : 'sh'
  }

  /**
   * Check if running on Windows
   */
  static isWindows(): boolean {
    return this.getPlatform() === 'windows'
  }

  /**
   * Check if running on macOS
   */
  static isMac(): boolean {
    return this.getPlatform() === 'mac'
  }

  /**
   * Check if running on Linux
   */
  static isLinux(): boolean {
    return this.getPlatform() === 'linux'
  }

  /**
   * Get home directory
   */
  static getHomeDir(): string {
    return os.homedir()
  }

  /**
   * Check if a command exists in PATH
   */
  static commandExists(command: string): boolean {
    try {
      if (this.isWindows()) {
        execSync(`where ${command}`, { stdio: 'ignore' })
      }
      else {
        execSync(`which ${command}`, { stdio: 'ignore' })
      }
      return true
    }
    catch {
      return false
    }
  }

  /**
   * Get the Claude CLI local path after migrate-installer
   */
  static getClaudeLocalPath(): string {
    return `${this.getHomeDir()}/.claude/local/claude`
  }

  /**
   * Check if Claude CLI is available (including local installation)
   */
  static isClaudeAvailable(): boolean {
    // Check local installation first (after migrate-installer)
    const localPath = this.getClaudeLocalPath()
    try {
      if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
        return true
      }
    }
    catch {
      // Ignore errors
    }

    // Fall back to PATH check
    return this.commandExists('claude')
  }

  /**
   * Get system information for debugging
   */
  static getSystemInfo(): Record<string, string> {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      bunVersion: process.versions.bun || 'N/A',
      osType: os.type(),
      osRelease: os.release(),
      homeDir: os.homedir(),
      cwd: process.cwd(),
    }
  }
}
