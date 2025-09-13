/**
 * Setup Plan Command
 *
 * Implements the setupPlan function that sets up implementation planning phase
 * for the current feature branch. Equivalent to setup-plan.sh/ps1 script functionality.
 */

import { SpecKitProject } from '../core/SpecKitProject.js';
import type {
  SetupPlanResult,
  CommonOptions
} from '../contracts/spec-kit-library.js';
import {
  SpecKitError,
  FeatureBranchError,
  GitRepositoryError,
  FileOperationError
} from '../contracts/spec-kit-library.js';

/**
 * Sets up implementation planning phase for current feature
 *
 * This function:
 * 1. Validates that we're on a feature branch
 * 2. Gets the current feature instance
 * 3. Initializes the plan.md file from template
 * 4. Returns paths to all relevant files
 *
 * @param options - Configuration options including JSON output
 * @returns Planning setup result with file paths
 * @throws Error if not on feature branch or templates missing
 */
export async function setupPlan(options: CommonOptions = {}): Promise<SetupPlanResult> {
  try {
    // Initialize project from current directory
    const project = await SpecKitProject.fromCurrentDirectory();

    // Verify we're on a feature branch
    if (!project.isOnFeatureBranch()) {
      throw new FeatureBranchError(
        `Not on a feature branch. Current branch: ${project.currentBranch}. ` +
        'Feature branches must follow the pattern: ###-feature-name (e.g., 001-add-auth)'
      );
    }

    // Get the current feature
    const feature = await project.getCurrentFeature();
    if (!feature) {
      throw new FeatureBranchError(
        `Could not find feature directory for branch: ${project.currentBranch}. ` +
        'Make sure the feature was created with createNewFeature command.'
      );
    }

    // Verify spec file exists (prerequisite for planning)
    if (!await require('../utils/file.js').files.fileExists(feature.specFile)) {
      throw new FileOperationError(
        `Specification file not found: ${feature.specFile}. ` +
        'Please ensure the feature specification exists before setting up the plan.'
      );
    }

    // Initialize the plan file
    await feature.initializePlanFile();

    // Prepare the result
    const result: SetupPlanResult = {
      FEATURE_SPEC: feature.specFile,
      IMPL_PLAN: feature.planFile,
      SPECS_DIR: project.specsDir,
      BRANCH: project.currentBranch
    };

    // Output result based on format preference
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Setup planning phase for feature: ${feature.description}`);
      console.log(`Branch: ${result.BRANCH}`);
      console.log(`Specification: ${result.FEATURE_SPEC}`);
      console.log(`Implementation Plan: ${result.IMPL_PLAN}`);
      console.log(`Specs Directory: ${result.SPECS_DIR}`);
    }

    return result;
  } catch (error) {
    // Handle different error types appropriately
    if (error instanceof SpecKitError) {
      throw error;
    }

    // Wrap unknown errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new FileOperationError(`Failed to setup plan: ${errorMessage}`);
  }
}

/**
 * Command line interface handler for setupPlan
 * Parses arguments and calls the main function
 * @param args Command line arguments
 */
export async function setupPlanCommand(args: string[]): Promise<void> {
  try {
    // Parse command line arguments
    const options: CommonOptions = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--json' || arg === '-j') {
        options.json = true;
      } else if (arg === '--help' || arg === '-h') {
        printHelp();
        return;
      }
    }

    // Execute the command
    await setupPlan(options);
  } catch (error) {
    if (error instanceof SpecKitError) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }

    console.error(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

/**
 * Print help information for the setupPlan command
 */
function printHelp(): void {
  console.log(`
Usage: setupPlan [options]

Sets up implementation planning phase for the current feature branch.

Options:
  --json, -j         Output result in JSON format
  --help, -h         Show this help message

Prerequisites:
  - Must be on a feature branch (###-feature-name format)
  - Feature specification (spec.md) must exist

Examples:
  setupPlan
  setupPlan --json

This command will:
1. Verify you're on a feature branch
2. Check that the feature specification exists
3. Create/initialize the implementation plan (plan.md) from template
4. Return paths to all planning-related files
`);
}