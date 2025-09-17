import type { SpecFile, SpecFileFrontmatter } from '../types'
import crypto from 'node:crypto'
import matter from 'gray-matter'
import { isValidUuid } from '../adapters/github/uuid-utils.js'
import { validateFrontmatter } from '../schemas'

export function generateSpecId(): string {
  return crypto.randomUUID()
}

export function parseMarkdownWithFrontmatter(content: string, filepath: string): SpecFile {
  const parsed = matter(content)

  // Validate frontmatter with Zod schema
  const frontmatter = validateFrontmatter(parsed.data)

  return {
    path: filepath,
    filename: filepath.split('/').pop() || '',
    content: parsed.content,
    frontmatter,
    markdown: parsed.content,
  }
}

export function stringifyMarkdownWithFrontmatter(file: SpecFile): string {
  return matter.stringify(file.markdown, file.frontmatter)
}

export function calculateContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 12)
}

export function updateFrontmatter(file: SpecFile, updates: Partial<SpecFileFrontmatter>): SpecFile {
  return {
    ...file,
    frontmatter: {
      ...file.frontmatter,
      ...updates,
      last_sync: new Date().toISOString(),
      sync_hash: calculateContentHash(file.markdown),
      // Keep existing spec_id - UUID generation now happens in SpecScanner
      spec_id: file.frontmatter.spec_id,
    },
  }
}

export function hasContentChanged(file: SpecFile): boolean {
  const currentHash = calculateContentHash(file.markdown)
  return currentHash !== file.frontmatter.sync_hash
}

export function mergeFrontmatter(
  local: SpecFileFrontmatter,
  remote: SpecFileFrontmatter,
): SpecFileFrontmatter {
  // Merge platform-specific data
  const merged: SpecFileFrontmatter = {
    ...local,
    issue_type: remote.issue_type || local.issue_type,
    github: {
      ...local.github,
      ...remote.github,
    },
    jira: {
      ...local.jira,
      ...remote.jira,
    },
    asana: {
      ...local.asana,
      ...remote.asana,
    },
  }

  // Determine sync status based on timestamps
  if (local.last_sync && remote.last_sync) {
    const localTime = new Date(local.last_sync).getTime()
    const remoteTime = new Date(remote.last_sync).getTime()

    if (localTime > remoteTime) {
      merged.sync_status = 'conflict'
    }
    else {
      merged.sync_status = 'synced'
    }
  }

  return merged
}

export function createDefaultFrontmatter(
  issueNumber?: number,
  parentIssue?: number,
): SpecFileFrontmatter {
  return {
    spec_id: generateSpecId(),
    issue_type: parentIssue ? 'subtask' : 'parent',
    sync_status: 'draft',
    last_sync: new Date().toISOString(),
    auto_sync: true,
    github: issueNumber
      ? {
          issue_number: issueNumber,
          parent_issue: parentIssue,
        }
      : undefined,
  }
}

/**
 * Validates that a spec_id is a valid UUID format.
 * Used for frontmatter validation and data integrity checks.
 *
 * @param specId - The spec ID to validate
 * @returns The validated spec ID
 * @throws Error if spec_id is not a valid UUID format
 */
export function validateSpecId(specId: unknown): string {
  if (typeof specId !== 'string') {
    throw new TypeError('spec_id must be a string')
  }

  if (!isValidUuid(specId)) {
    throw new Error(`Invalid spec_id format: ${specId}`)
  }

  return specId
}

/**
 * Safely validates a spec_id without throwing errors.
 * Returns null for invalid UUIDs instead of throwing.
 *
 * @param specId - The spec ID to validate
 * @returns The validated spec ID or null if invalid
 */
export function safeValidateSpecId(specId: unknown): string | null {
  try {
    return validateSpecId(specId)
  }
  catch {
    return null
  }
}

/**
 * Ensures a frontmatter object has a valid spec_id.
 * Generates a new one if missing or invalid.
 *
 * @param frontmatter - The frontmatter object to validate
 * @returns Frontmatter with a guaranteed valid spec_id
 */
export function ensureValidSpecId(frontmatter: Partial<SpecFileFrontmatter>): SpecFileFrontmatter {
  const validSpecId = safeValidateSpecId(frontmatter.spec_id) || generateSpecId()

  return {
    ...frontmatter,
    spec_id: validSpecId,
  } as SpecFileFrontmatter
}
