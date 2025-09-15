import { z } from 'zod'

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

// Main frontmatter schema
export const SpecFileFrontmatterSchema = z.object({
  // Core fields (platform-agnostic)
  spec_id: z.string().uuid().optional(),
  sync_hash: z.string().regex(/^[a-f0-9]{12}$/).optional(),
  last_sync: z.string().datetime().optional(),
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
