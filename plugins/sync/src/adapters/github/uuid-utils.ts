/**
 * UUID metadata utilities for GitHub issue body embedding
 */

const UUID_COMMENT_REGEX = /<!--\s*spec_id:\s*([a-f0-9-]{36})\s*-->/i
const UUID_COMMENT_REMOVE_REGEX = /<!--\s*spec_id:\s*[a-f0-9-]{36}\s*-->\s*/gi
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Embeds a UUID in an issue body as hidden HTML comment metadata.
 * The UUID is embedded at the beginning of the body in the format:
 * <!-- spec_id: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx -->
 *
 * @param body - The issue body content
 * @param uuid - The UUID to embed
 * @returns The body with embedded UUID metadata
 * @throws Error if UUID format is invalid
 */
export function embedUuidInIssueBody(body: string, uuid: string): string {
  if (!isValidUuid(uuid)) {
    throw new Error(`Invalid UUID format: ${uuid}`)
  }

  // Remove existing UUID comment if present
  const cleanBody = body.replace(UUID_COMMENT_REMOVE_REGEX, '').trim()

  // Add UUID comment at the beginning
  return `<!-- spec_id: ${uuid} -->\n\n${cleanBody}`
}

/**
 * Extracts a UUID from an issue body that was previously embedded as metadata.
 *
 * @param body - The issue body content to search
 * @returns The extracted UUID string, or null if not found
 */
export function extractUuidFromIssueBody(body: string): string | null {
  const match = body.match(UUID_COMMENT_REGEX)
  return match ? match[1] || null : null
}

/**
 * Validates if a string is a valid UUID format.
 * Checks for UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 *
 * @param uuid - The string to validate
 * @returns True if valid UUID format, false otherwise
 */
export function isValidUuid(uuid: string): boolean {
  return UUID_REGEX.test(uuid)
}

/**
 * Checks if an issue body contains UUID metadata.
 *
 * @param body - The issue body content to check
 * @returns True if UUID metadata is found, false otherwise
 */
export function hasUuidMetadata(body: string): boolean {
  return UUID_COMMENT_REGEX.test(body)
}

/**
 * Removes UUID metadata from an issue body.
 *
 * @param body - The issue body content
 * @returns The body with UUID metadata removed
 */
export function removeUuidFromIssueBody(body: string): string {
  return body.replace(UUID_COMMENT_REMOVE_REGEX, '').replace(/\n\s*\n\s*\n/g, '\n\n').trim()
}
