/**
 * Commands Export
 *
 * Re-exports all command functions for convenient importing
 * throughout the spec-kit library and CLI applications.
 */

// Export all command-related types from contracts
export type {
  CheckTaskPrerequisitesResult,
  CommonOptions,
  CreateFeatureOptions,
  CreateFeatureResult,
  FeaturePathsResult,
  SetupPlanResult,
  UpdateAgentContextOptions,
  UpdateAgentContextResult,
} from '../contracts/spec-kit-library.js'
export { checkTaskPrerequisites, checkTaskPrerequisitesCommand } from './checkTaskPrerequisites.js'
export { checkTaskPrerequisitesCommand as checkTaskPrerequisitesCLI } from './checkTaskPrerequisites.js'
// Export main command functions
export { createNewFeature, createNewFeatureCommand } from './createNewFeature.js'
// Export CLI command handlers (aliases for backward compatibility)
export { createNewFeatureCommand as createNewFeatureCLI } from './createNewFeature.js'

export { getFeaturePaths, getFeaturePathsCommand } from './getFeaturePaths.js'
export { getFeaturePathsCommand as getFeaturePathsCLI } from './getFeaturePaths.js'
export { setupPlan, setupPlanCommand } from './setupPlan.js'
export { setupPlanCommand as setupPlanCLI } from './setupPlan.js'
export { updateAgentContext, updateAgentContextCommand } from './updateAgentContext.js'

export { updateAgentContextCommand as updateAgentContextCLI } from './updateAgentContext.js'
