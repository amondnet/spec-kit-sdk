/**
 * Create New Feature Command
 *
 * Implements the createNewFeature function that creates a new feature specification
 * with auto-incrementing number, branch creation, and template initialization.
 * Equivalent to create-new-feature.sh/ps1 script functionality.
 */

import type {
  CreateFeatureOptions,
  CreateFeatureResult,
} from '../contracts/spec-kit-library.js'
import process from 'node:process'
import {
  FeatureBranchError,
  FileOperationError,
  SpecKitError,
} from '../contracts/spec-kit-library.js'
import { SpecKitProject } from '../core/SpecKitProject.js'

/**
 * Creates a new feature specification with auto-incrementing number
 *
 * This function:
 * 1. Validates the description
 * 2. Gets the next feature number
 * 3. Creates and checks out a new feature branch
 * 4. Creates the feature directory structure
 * 5. Initializes the spec file from template
 *
 * @param description - Feature description for branch name and spec
 * @param options - Configuration options including JSON output
 * @returns Feature creation result with paths and metadata
 * @throws Error if git repository invalid or description empty
 */
export async function createNewFeature(
  description: string,
  options: Pick<CreateFeatureOptions, 'json'> = {},
): Promise<CreateFeatureResult> {
  try {
    // Validate input
    if (!description || typeof description !== 'string') {
      throw new FeatureBranchError('Feature description is required')
    }

    const trimmedDescription = description.trim()
    if (!trimmedDescription) {
      throw new FeatureBranchError('Feature description cannot be empty')
    }

    // Initialize project from current directory
    const project = await SpecKitProject.fromCurrentDirectory()

    // Create the feature
    const feature = await project.createFeature(trimmedDescription)

    // Get the result in contract format
    const result = feature.getCreateResult()

    // Output result based on format preference
    if (options.json) {
      console.log(JSON.stringify(result, null, 2))
    }
    else {
      console.log(`Created feature ${result.FEATURE_NUM}: ${trimmedDescription}`)
      console.log(`Branch: ${result.BRANCH_NAME}`)
      console.log(`Spec file: ${result.SPEC_FILE}`)
    }

    return result
  }
  catch (error) {
    // Handle different error types appropriately
    if (error instanceof SpecKitError) {
      throw error
    }

    // Wrap unknown errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    throw new FileOperationError(`Failed to create new feature: ${errorMessage}`)
  }
}

/**
 * Command line interface handler for createNewFeature
 * Parses arguments and calls the main function
 * @param args Command line arguments
 */
export async function createNewFeatureCommand(args: string[]): Promise<void> {
  try {
    // Parse command line arguments
    const options: Pick<CreateFeatureOptions, 'json'> = {}
    let description = ''

    for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      if (!arg)
        continue

      if (arg === '--json' || arg === '-j') {
        options.json = true
      }
      else if (arg === '--help' || arg === '-h') {
        printHelp()
        return
      }
      else if (!description && !arg.startsWith('-')) {
        // First non-flag argument is the description
        description = arg
      }
    }

    // Validate that description was provided
    if (!description) {
      console.error('Error: Feature description is required')
      console.error('Usage: createNewFeature <description> [--json]')
      process.exit(1)
    }

    // Execute the command
    await createNewFeature(description, options)
  }
  catch (error) {
    if (error instanceof SpecKitError) {
      console.error(`Error: ${error.message}`)
      process.exit(1)
    }

    console.error(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    process.exit(1)
  }
}

/**
 * Print help information for the createNewFeature command
 */
function printHelp(): void {
  console.log(`
Usage: createNewFeature <description> [options]

Creates a new feature specification with auto-incrementing number.

Arguments:
  description         Feature description for branch name and specification

Options:
  --json, -j         Output result in JSON format
  --help, -h         Show this help message

Examples:
  createNewFeature "add user authentication"
  createNewFeature "implement dark mode" --json

This command will:
1. Generate the next feature number (e.g., 001, 002, 003...)
2. Create and checkout a new feature branch (e.g., 001-add-user-authentication)
3. Create the feature directory structure under specs/
4. Initialize spec.md from template with feature information
`)
}
