import { z } from 'zod'
import { isValidUuid } from '../adapters/github/uuid-utils.js'

// Platform-specific schemas
const GitHubSchema = z.object({
  issue_number: z.number().positive().optional(),
  parent_issue: z.number().positive().nullable().optional(),
  updated_at: z.string().datetime().optional(),
  labels: z.array(z.string()).optional(),
  assignees: z.array(z.string()).optional(),
  milestone: z.number().optional(),
})

const JiraSchema = z.object({
  issue_key: z.string().optional(),
  epic_key: z.string().optional(),
  issue_type: z.string().optional(),
  updated: z.string().datetime().optional(),
})

const AsanaSchema = z.object({
  task_gid: z.string().optional(),
  project_gid: z.string().optional(),
  parent_task: z.string().optional(),
  modified_at: z.string().datetime().optional(),
})

// Custom UUID schema with enhanced validation
const UuidSchema = z.string()
  .uuid('Invalid UUID format')
  .refine(isValidUuid, {
    message: 'UUID must be a valid v4 UUID format',
  })

// Main frontmatter schema
export const SpecFileFrontmatterSchema = z.object({
  // Core fields (platform-agnostic)
  spec_id: UuidSchema.optional(),
  sync_hash: z.string().regex(/^[a-f0-9]{12}$/).optional(),
  last_sync: z.iso.datetime().optional(),
  sync_status: z.enum(['draft', 'synced', 'conflict']).optional(),
  issue_type: z.enum(['parent', 'subtask']).optional(),
  auto_sync: z.boolean().optional(),

  // Platform-specific fields
  github: GitHubSchema.optional(),
  jira: JiraSchema.optional(),
  asana: AsanaSchema.optional(),
})

// Export type inference
export type SpecFileFrontmatter = z.infer<typeof SpecFileFrontmatterSchema>

// Validation helper
export function validateFrontmatter(data: unknown): SpecFileFrontmatter {
  return SpecFileFrontmatterSchema.parse(data)
}

// Safe validation helper (returns result object)
export function safeParseFrontmatter(data: unknown) {
  return SpecFileFrontmatterSchema.safeParse(data)
}

// UUID-specific validation helpers
export function validateSpecIdOnly(specId: unknown): string {
  return UuidSchema.parse(specId)
}

export function safeParseSpecId(specId: unknown) {
  return UuidSchema.safeParse(specId)
}

/**
 * Validates frontmatter with special handling for spec_id.
 * If spec_id is missing or invalid, this function will throw an error
 * with detailed information about what's wrong.
 *
 * @param data - The frontmatter data to validate
 * @returns Validated frontmatter with guaranteed valid spec_id
 * @throws ZodError with detailed validation errors
 */
export function validateFrontmatterWithSpecId(data: unknown): SpecFileFrontmatter & { spec_id: string } {
  const result = SpecFileFrontmatterSchema.parse(data)

  if (!result.spec_id) {
    throw new Error('spec_id is required but was not provided')
  }

  return result as SpecFileFrontmatter & { spec_id: string }
}

/**
 * Schema for frontmatter that requires a spec_id.
 * Use this when spec_id must be present and valid.
 */
export const RequiredSpecIdFrontmatterSchema = SpecFileFrontmatterSchema.extend({
  spec_id: UuidSchema,
})

export type RequiredSpecIdFrontmatter = z.infer<typeof RequiredSpecIdFrontmatterSchema>
