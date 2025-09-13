/**
 * Get Feature Paths Command
 *
 * Implements the getFeaturePaths function that returns standardized paths
 * for the current feature branch. Equivalent to get-feature-paths.sh/ps1 script functionality.
 */

import { SpecKitProject } from '../core/SpecKitProject.js';
import type {
  FeaturePathsResult,
  CommonOptions
} from '../contracts/spec-kit-library.js';
import {
  SpecKitError,
  FeatureBranchError,
  GitRepositoryError,
  FileOperationError
} from '../contracts/spec-kit-library.js';

/**
 * Gets standardized paths for current feature branch
 *
 * This function:
 * 1. Validates that we're on a feature branch
 * 2. Gets the current feature instance
 * 3. Returns all standardized file paths for the feature
 * 4. Includes repository root and branch information
 *
 * @param options - Configuration options including JSON output
 * @returns Complete set of feature-related file paths
 * @throws Error if not on feature branch or invalid repository
 */
export async function getFeaturePaths(options: CommonOptions = {}): Promise<FeaturePathsResult> {
  try {
    // Initialize project from current directory
    const project = await SpecKitProject.fromCurrentDirectory();

    // Verify we're on a feature branch
    if (!project.isOnFeatureBranch()) {
      throw new FeatureBranchError(
        `Not on a feature branch. Current branch: ${project.currentBranch}. ` +
        'Feature paths can only be retrieved on feature branches (###-feature-name format).'
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

    // Get feature paths using the feature's method
    const result = feature.getFeaturePaths();

    // Output result based on format preference
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Feature paths for: ${feature.description}`);
      console.log(`Feature: ${feature.number} (${feature.branchName})`);
      console.log('');
      console.log('📁 Repository Structure:');
      console.log(`   Repository Root: ${result.REPO_ROOT}`);
      console.log(`   Current Branch:  ${result.CURRENT_BRANCH}`);
      console.log('');
      console.log('📄 Feature Files:');
      console.log(`   Feature Directory: ${result.FEATURE_DIR}`);
      console.log(`   Specification:     ${result.FEATURE_SPEC}`);
      console.log(`   Implementation Plan: ${result.IMPL_PLAN}`);
      console.log(`   Tasks:             ${result.TASKS}`);
      console.log(`   Research:          ${result.RESEARCH}`);
      console.log(`   Data Model:        ${result.DATA_MODEL}`);
      console.log(`   Quickstart:        ${result.QUICKSTART}`);
      console.log(`   Contracts Directory: ${result.CONTRACTS_DIR}`);
    }

    return result;
  } catch (error) {
    // Handle different error types appropriately
    if (error instanceof SpecKitError) {
      throw error;
    }

    // Wrap unknown errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new FileOperationError(`Failed to get feature paths: ${errorMessage}`);
  }
}

/**
 * Command line interface handler for getFeaturePaths
 * Parses arguments and calls the main function
 * @param args Command line arguments
 */
export async function getFeaturePathsCommand(args: string[]): Promise<void> {
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
    await getFeaturePaths(options);
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
 * Print help information for the getFeaturePaths command
 */
function printHelp(): void {
  console.log(`
Usage: getFeaturePaths [options]

Gets standardized paths for the current feature branch.

Options:
  --json, -j         Output result in JSON format
  --help, -h         Show this help message

Prerequisites:
  - Must be on a feature branch (###-feature-name format)
  - Feature directory must exist

Examples:
  getFeaturePaths
  getFeaturePaths --json

Output includes:
  - Repository root path
  - Current branch name
  - Feature directory path
  - All standard feature file paths:
    * spec.md (specification)
    * plan.md (implementation plan)
    * tasks.md (task list)
    * research.md (research notes)
    * data-model.md (data models)
    * quickstart.md (quick start guide)
    * contracts/ (contracts directory)

This command will:
1. Verify you're on a feature branch
2. Locate the feature directory and files
3. Return all standardized paths in the spec-kit format
4. Display paths in human-readable or JSON format
`);
}