import type { SpecDocument, SpecFile } from '../types/index.js'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { parseMarkdownWithFrontmatter } from './frontmatter.js'

export class SpecScanner {
  private specsRoot: string

  constructor(specsRoot: string = './specs') {
    this.specsRoot = specsRoot
  }

  async scanAll(): Promise<SpecDocument[]> {
    const directories: SpecDocument[] = []

    try {
      const entries = await fs.readdir(this.specsRoot, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const specDir = await this.scanDirectory(path.join(this.specsRoot, entry.name))
          if (specDir) {
            directories.push(specDir)
          }
        }
      }
    }
    catch (error: any) {
      if (error.code === 'ENOENT') {
        console.warn(`Specs directory not found: ${this.specsRoot}`)
        return []
      }
      throw error
    }

    return directories
  }

  async scanDirectory(dirPath: string): Promise<SpecDocument | null> {
    const files = new Map<string, SpecFile>()
    const dirName = path.basename(dirPath)

    // Extract issue number from directory name if it exists (e.g., "001-feature-name" -> 1)
    const issueMatch = dirName.match(/^(\d+)-/)
    const issueNumber = issueMatch ? Number.parseInt(issueMatch[1] as string, 10) : undefined

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const filePath = path.join(dirPath, entry.name)
          const content = await fs.readFile(filePath, 'utf-8')
          const specFile = parseMarkdownWithFrontmatter(content, filePath)
          files.set(entry.name, specFile)
        }
        else if (entry.isDirectory() && entry.name === 'contracts') {
          // Handle contracts directory
          const contractsPath = path.join(dirPath, 'contracts')
          const contractFiles = await this.scanContractsDirectory(contractsPath)
          contractFiles.forEach((file, name) => {
            files.set(`contracts/${name}`, file)
          })
        }
      }

      if (files.size === 0) {
        return null
      }

      return {
        path: dirPath,
        name: dirName,
        issueNumber,
        files,
      }
    }
    catch (error) {
      console.error(`Error scanning directory ${dirPath}:`, error)
      return null
    }
  }

  private async scanContractsDirectory(contractsPath: string): Promise<Map<string, SpecFile>> {
    const files = new Map<string, SpecFile>()

    try {
      const entries = await fs.readdir(contractsPath, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = path.join(contractsPath, entry.name)
          const content = await fs.readFile(filePath, 'utf-8')

          // Contracts might not have frontmatter, so we'll create a basic spec file
          files.set(entry.name, {
            path: filePath,
            filename: entry.name,
            content,
            frontmatter: {},
            markdown: content,
          })
        }
      }
    }
    catch {
      // Contracts directory might not exist, which is fine
    }

    return files
  }

  async findSpecByIssueNumber(issueNumber: number): Promise<SpecDocument | null> {
    const allSpecs = await this.scanAll()

    // First, try to find by directory name
    const byDirName = allSpecs.find(spec => spec.issueNumber === issueNumber)
    if (byDirName) {
      return byDirName
    }

    // Then, try to find by frontmatter
    for (const spec of allSpecs) {
      const specFile = spec.files.get('spec.md')
      if (specFile?.frontmatter.github?.issue_number === issueNumber) {
        return spec
      }
    }

    return null
  }

  async getSpecFile(specPath: string, filename: string): Promise<SpecFile | null> {
    try {
      const filePath = path.join(specPath, filename)
      const content = await fs.readFile(filePath, 'utf-8')
      return parseMarkdownWithFrontmatter(content, filePath)
    }
    catch {
      return null
    }
  }

  async writeSpecFile(specFile: SpecFile, content: string): Promise<void> {
    await fs.writeFile(specFile.path, content, 'utf-8')
  }

  async createSpecDirectory(dirName: string): Promise<string> {
    const dirPath = path.join(this.specsRoot, dirName)
    await fs.mkdir(dirPath, { recursive: true })
    return dirPath
  }

  getFeatureName(spec: SpecDocument): string {
    // Remove issue number prefix if present
    const name = spec.name.replace(/^\d+-/, '')
    // Convert kebab-case to Title Case
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }
}
