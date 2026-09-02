/** Public API for managed pirate-608 DSH plugins. */

export { packageRootFrom, resolvePresetContext, runPluginCli } from './cli.js'
export {
  commandProbe,
  executableProbe,
  integrationOverall,
  runDependencyProbes,
  statusRevision,
  statusSnapshot,
  versionedCommandProbe,
} from './dependency-status.js'
export { applyPresetSelection, installPreset, presetStatus, removePreset, renderRows, updatePreset } from './preset.js'
export type {
  DoctorProbe,
  DependencyKind,
  DependencyProbe,
  DependencyStatus,
  IntegrationId,
  IntegrationStatus,
  IntegrationTargetId,
  McpPolicySpec,
  McpServerSpec,
  PresetContext,
  PresetSelectionItem,
  PresetSelectionResult,
  PresetSpec,
  PresetStatus,
  PresetWriteResult,
  RuntimeCommand,
  MultiToolsStatusSnapshot,
  ProbeMode,
} from './types.js'
