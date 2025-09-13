/**
 * Check Task Prerequisites Command
 *
 * Implements the checkTaskPrerequisites function that checks if all prerequisite
 * files exist for task execution. Equivalent to check-task-prerequisites.sh/ps1 script functionality.
 */

import type {
  CheckTaskPrerequisitesResult,
  CommonOptions,
} from '../contracts/spec-kit-library.js'
import process from 'node:process'
import {
  FeatureBranchError,
  FileOperationError,
  SpecKitError,
} from '../contracts/spec-kit-library.js'
import { SpecKitProject } from '../core/SpecKitProject.js'
import { files } from '../utils/index.js'

/**
 * Checks if all prerequisites exist for task execution
 *
 * This function:
 * 1. Validates that we're on a feature branch
 * 2. Gets the current feature instance
 * 3. Checks for required files (spec.md, plan.md)
 * 4. Returns detailed status about missing files
 *
 * @param options - Configuration options including JSON output
 * @returns Prerequisites check result with missing files
 * @throws Error if git repository invalid or not on feature branch
 */
export async function checkTaskPrerequisites(options: CommonOptions = {}): Promise<CheckTaskPrerequisitesResult> {
  try {
    // Initialize project from current directory
    const project = await SpecKitProject.fromCurrentDirectory()

    // Verify we're on a feature branch
    if (!project.isOnFeatureBranch()) {
      throw new FeatureBranchError(
        `Not on a feature branch. Current branch: ${project.currentBranch}. `
        + 'Task prerequisites can only be checked on feature branches (###-feature-name format).',
      )
    }

    // Get the current feature
    const feature = await project.getCurrentFeature()
    if (!feature) {
      throw new FeatureBranchError(
        `Could not find feature directory for branch: ${project.currentBranch}. `
        + 'Make sure the feature was created with createNewFeature command.',
      )
    }

    // Check prerequisites using the feature's method
    const missingFiles = await feature.checkPrerequisites()

    // Additional checks for optional but recommended files
    const optionalFiles = [
      feature.researchFile,
      feature.dataModelFile,
      feature.quickstartFile,
    ]

    const missingOptionalFiles: string[] = []
    for (const filePath of optionalFiles) {
      if (!await files.fileExists(filePath)) {
        missingOptionalFiles.push(filePath)
      }
    }

    // Determine overall status
    let status: string
    if (missingFiles.length === 0) {
      status = 'READY'
    }
    else {
      status = 'MISSING_FILES'
    }

    // Prepare the result
    const result: CheckTaskPrerequisitesResult = {
      STATUS: status,
      MISSING_FILES: missingFiles,
      READY: missingFiles.length === 0,
    }

    // Output result based on format preference
    if (options.json) {
      console.log(JSON.stringify(result, null, 2))
    }
    else {
      console.log(`Task prerequisites check for feature: ${feature.description}`)
      console.log(`Branch: ${project.currentBranch}`)
      console.log(`Status: ${result.STATUS}`)

      if (result.READY) {
        console.log(`✅ All required prerequisites are met!`)
      }
      else {
        console.log(`❌ Missing required files:`)
        result.MISSING_FILES.forEach((file) => {
          console.log(`   - ${file}`)
        })
      }

      if (missingOptionalFiles.length > 0) {
        console.log(`\n📝 Optional files not yet created:`)
        missingOptionalFiles.forEach((file) => {
          console.log(`   - ${file}`)
        })
      }

      // Provide helpful next steps
      if (!result.READY) {
        console.log(`\n💡 Next steps:`)
        if (missingFiles.includes(feature.specFile)) {
          console.log(`   1. Create the feature specification: edit ${feature.specFile}`)
        }
        if (missingFiles.includes(feature.planFile)) {
          console.log(`   2. Set up the implementation plan: run 'setupPlan' command`)
        }
      }
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
    throw new FileOperationError(`Failed to check task prerequisites: ${errorMessage}`)
  }
}

/**
 * Command line interface handler for checkTaskPrerequisites
 * Parses arguments and calls the main function
 * @param args Command line arguments
 */
export async function checkTaskPrerequisitesCommand(args: string[]): Promise<void> {
  try {
    // Parse command line arguments
    const options: CommonOptions = {}

    for (let i = 0; i < args.length; i++) {
      const arg = args[i]

      if (arg === '--json' || arg === '-j') {
        options.json = true
      }
      else if (arg === '--help' || arg === '-h') {
        printHelp()
        return
      }
    }

    // Execute the command
    const result = await checkTaskPrerequisites(options)

    // Exit with appropriate code for shell scripts
    if (!options.json) {
      process.exit(result.READY ? 0 : 1)
    }
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
 * Print help information for the checkTaskPrerequisites command
 */
function printHelp(): void {
  console.log(`
Usage: checkTaskPrerequisites [options]

Checks if all prerequisite files exist for task execution on the current feature branch.

Options:
  --json, -j         Output result in JSON format
  --help, -h         Show this help message

Prerequisites:
  - Must be on a feature branch (###-feature-name format)
  - Feature directory must exist

Required Files Checked:
  - spec.md          Feature specification (required before planning)
  - plan.md          Implementation plan (required before tasks)

Optional Files Reported:
  - research.md      Research notes and findings
  - data-model.md    Data model and schema definitions
  - quickstart.md    Quick start guide for the feature

Examples:
  checkTaskPrerequisites
  checkTaskPrerequisites --json

Exit Codes:
  0  All prerequisites met (READY)
  1  Missing required files or error occurred

This command will:
1. Verify you're on a feature branch
2. Check that required feature files exist
3. Report status and missing files
4. Provide guidance on next steps if files are missing
`)
}
