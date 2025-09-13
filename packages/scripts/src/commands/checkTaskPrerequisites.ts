/**
 * Check Task Prerequisites Command
 *
 * Implements the checkTaskPrerequisites function that checks if all prerequisite
 * files exist for task execution. Equivalent to check-task-prerequisites.sh/ps1 script functionality.
 */

import type { CheckTaskPrerequisitesOptions, CheckTaskPrerequisitesResult, CommonOptions } from '../contracts/spec-kit-library.js'
import process from 'node:process'
import { FeatureBranchError, FileOperationError, SpecKitError } from '../contracts/spec-kit-library.js'
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
export async function checkTaskPrerequisites(options: CheckTaskPrerequisitesOptions = {}): Promise<CheckTaskPrerequisitesResult> {
  try {
    // Initialize project from current directory
    const project = await SpecKitProject.fromCurrentDirectory()

    // Check feature branch requirement if specified
    if (options.requireFeatureBranch !== false && !project.isOnFeatureBranch()) {
      throw new FeatureBranchError(
        `Not on a feature branch. Current branch: ${project.currentBranch}. `
        + 'Task prerequisites can only be checked on feature branches (###-feature-name format).',
      )
    }

    let missingFiles: string[] = []

    // If custom required files are specified, check those
    if (options.requiredFiles) {
      for (const filePath of options.requiredFiles) {
        if (!await files.fileExists(filePath)) {
          missingFiles.push(filePath)
        }
      }
    }
    else {
      // Default behavior: check for feature prerequisites
      if (project.isOnFeatureBranch()) {
        const feature = await project.getCurrentFeature()
        if (!feature) {
          throw new FeatureBranchError(
            `Could not find feature directory for branch: ${project.currentBranch}. `
            + 'Make sure the feature was created with createNewFeature command.',
          )
        }

        // Check prerequisites using the feature's method
        missingFiles = await feature.checkPrerequisites()

        // Check for planning prerequisites if requested
        if (options.checkPlanning && !await files.fileExists(feature.planFile)) {
          missingFiles.push(feature.planFile)
        }
      }
    }

    // Determine overall status
    let status: string
    if (missingFiles.length === 0) {
      status = 'READY'
    }
    else {
      status = 'NOT_READY'
    }

    // Prepare the result
    const result: CheckTaskPrerequisitesResult = {
      STATUS: status,
      MISSING_FILES: missingFiles,
      READY: missingFiles.length === 0,
    }

    // Output result based on format preference (but don't console.log in tests)
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
      if (options.json) {
        // For compatibility with bash script - we need to include FEATURE_DIR and AVAILABLE_DOCS
        const currentFeature = project.isOnFeatureBranch() ? await project.getCurrentFeature() : null
        const availableDocs: string[] = []

        if (currentFeature) {
          if (await files.fileExists(currentFeature.researchFile))
            availableDocs.push('research.md')
          if (await files.fileExists(currentFeature.dataModelFile))
            availableDocs.push('data-model.md')
          if (await files.fileExists(currentFeature.contractsDir) && await files.isDirectory(currentFeature.contractsDir)) {
            availableDocs.push('contracts/')
          }
          if (await files.fileExists(currentFeature.quickstartFile))
            availableDocs.push('quickstart.md')
        }

        const bashCompatResult = {
          FEATURE_DIR: currentFeature?.featureDir || '',
          AVAILABLE_DOCS: availableDocs,
        }
        console.log(JSON.stringify(bashCompatResult))
      }
      else {
        const currentFeature = project.isOnFeatureBranch() ? await project.getCurrentFeature() : null
        if (currentFeature) {
          console.log(`FEATURE_DIR:${currentFeature.featureDir}`)
          console.log('AVAILABLE_DOCS:')
          // Check available documentation files
          console.log(await files.fileExists(currentFeature.researchFile) ? '  ✓ research.md' : '  ✗ research.md')
          console.log(await files.fileExists(currentFeature.dataModelFile) ? '  ✓ data-model.md' : '  ✗ data-model.md')
          // Check if contracts directory exists and is non-empty
          const contractsExist = await files.fileExists(currentFeature.contractsDir)
            && await files.isDirectory(currentFeature.contractsDir)
          console.log(contractsExist ? '  ✓ contracts/' : '  ✗ contracts/')
          console.log(await files.fileExists(currentFeature.quickstartFile) ? '  ✓ quickstart.md' : '  ✗ quickstart.md')
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
