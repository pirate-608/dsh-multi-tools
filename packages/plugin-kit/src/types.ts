/** One stdio MCP service mounted inside a generated agent preset. */
export interface McpServerSpec {
  id: string
  serverName: string
  command: string
  args?: readonly string[]
  env?: Readonly<Record<string, string>>
  cwd?: string
  toolCallTimeoutMs?: number
  failOnStartupError?: boolean
}

/** Fail-closed policy for MCP tools in one preset. */
export interface McpPolicySpec {
  serverNames: readonly string[]
  readOnly?: readonly string[]
  ask?: readonly string[]
  deny?: readonly string[]
}

/** One executable prerequisite inspected by the package doctor command. */
export interface DoctorProbe {
  label: string
  command: string
  args?: readonly string[]
  optional?: boolean
}

/** Explicit package-local runtime management command; never run during installation. */
export interface RuntimeCommand {
  command: string
  args?: readonly string[]
  cwd?: string
}

/** Declarative definition of one managed, standard-derived agent preset. */
export interface PresetSpec {
  packageName: string
  packageVersion: string
  commandName?: string
  id: string
  name: string
  description: string
  providerName: string
  skillsDir?: string
  mcpServers?: readonly McpServerSpec[]
  policy?: McpPolicySpec
  platform?: NodeJS.Platform
  doctor?: readonly DoctorProbe[]
  runtime?: Partial<Record<'install' | 'status' | 'remove', RuntimeCommand>>
}

/** Resolved host and package paths used by lifecycle operations. */
export interface PresetContext {
  dshHome: string
  profileName: string
  profileDir: string
  standardPresetDir: string
  packageRoot: string
  mcpClientPlugin: string
  skillFilesystemPlugin: string
  policyPlugin: string
  dshVersion: string
}

/** Managed preset state exposed by status. */
export interface PresetStatus {
  kind: 'absent' | 'clean' | 'outdated' | 'modified' | 'invalid'
  presetDir: string
  message: string
}

/** Result of an install or update operation. */
export interface PresetWriteResult {
  presetDir: string
  backupDir?: string
}

/** Stable ids managed by the aggregate multi-tools bundle. */
export type IntegrationId =
  | 'after-effects'
  | 'photoshop'
  | 'premiere'
  | 'autocad'
  | 'comfy-local'
  | 'renpy'
  | 'solidworks'
  | 'unity'

/** ModLens is an always-on core target; the remaining ids are optional presets. */
export type IntegrationTargetId = 'modlens' | IntegrationId

/** Installed probes are passive; live probes may contact local services. */
export type ProbeMode = 'installed' | 'live'

/** One dependency category shown by the CLI and Web UI. */
export type DependencyKind =
  | 'command'
  | 'package'
  | 'desktop-app'
  | 'service'
  | 'bridge'
  | 'project'
  | 'sdk'
  | 'credential'
  | 'model'

/** Normalized dependency result shared by every integration. */
export interface DependencyStatus {
  id: string
  label: string
  kind: DependencyKind
  required: boolean
  state:
    | 'ready'
    | 'missing'
    | 'unconfigured'
    | 'stopped'
    | 'unreachable'
    | 'version-mismatch'
    | 'unsupported'
    | 'not-checked'
    | 'error'
  detectedVersion?: string
  requiredVersion?: string
  summary: string
  remediation?: { kind: 'command' | 'manual', text: string }
}

/** One integration's preset, runtime, and live-service state. */
export interface IntegrationStatus {
  id: IntegrationTargetId
  configuredEnabled: boolean
  effectiveEnabled: boolean
  availability: 'available' | 'unsupported-platform'
  preset: 'not-applicable' | PresetStatus['kind']
  runtime: DependencyStatus[]
  live: DependencyStatus[]
  overall: 'ready' | 'needs-setup' | 'blocked' | 'not-checked'
  redistribution: 'publishable' | 'personal-only'
}

/** Versioned, JSON-safe snapshot returned by the root CLI and Remote. */
export interface MultiToolsStatusSnapshot {
  formatVersion: 1
  revision: string
  mode: ProbeMode
  checkedAt: string
  integrations: IntegrationStatus[]
}

/** One bounded, side-effect-classified dependency probe. */
export interface DependencyProbe {
  id: string
  label: string
  kind: DependencyKind
  required: boolean
  mode: ProbeMode
  timeoutMs?: number
  requiredVersion?: string
  remediation?: DependencyStatus['remediation']
  run(signal: AbortSignal): Promise<Omit<DependencyStatus, 'id' | 'label' | 'kind' | 'required' | 'requiredVersion' | 'remediation'>>
}

/** Input for one atomic managed-preset selection transaction. */
export interface PresetSelectionItem {
  spec: PresetSpec
  context: PresetContext
}

/** Result of one committed managed-preset selection transaction. */
export interface PresetSelectionResult {
  enabled: string[]
  installed: string[]
  removed: string[]
}
