/**
 * Core Entities Export
 *
 * Re-exports all core entity classes for convenient importing
 * throughout the spec-kit library.
 */

export { Feature, FeatureState } from './Feature.js'
export type {
  Feature as FeatureInterface,
} from './Feature.js'

export { SpecKitProject } from './SpecKitProject.js'

// Export types for external use
export type {
  SpecKitProject as SpecKitProjectInterface,
} from './SpecKitProject.js'
