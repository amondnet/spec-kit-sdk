/**
 * Commands Export
 *
 * Re-exports all command functions for convenient importing
 * throughout the spec-kit library and CLI applications.
 */

// Export main command functions
export { createNewFeature, createNewFeatureCommand } from './createNewFeature.js';
export { setupPlan, setupPlanCommand } from './setupPlan.js';
export { updateAgentContext, updateAgentContextCommand } from './updateAgentContext.js';
export { checkTaskPrerequisites, checkTaskPrerequisitesCommand } from './checkTaskPrerequisites.js';
export { getFeaturePaths, getFeaturePathsCommand } from './getFeaturePaths.js';

// Export all command-related types from contracts
export type {
  CreateFeatureResult,
  SetupPlanResult,
  UpdateAgentContextResult,
  CheckTaskPrerequisitesResult,
  FeaturePathsResult,
  CreateFeatureOptions,
  UpdateAgentContextOptions,
  CommonOptions
} from '../contracts/spec-kit-library.js';