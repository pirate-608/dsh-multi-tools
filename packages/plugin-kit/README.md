# @pirate-608/dsh-plugin-kit

Shared infrastructure for DSH Multi Tools:

- managed Preset installation, drift detection, safe update/removal, and all-or-nothing multi-Preset selection;
- fail-closed MCP read/ask/deny policy;
- the versioned dependency-status vocabulary and bounded installed/live probe runner;
- shell-free executable probes, minimum-version checks, timeout/cancellation, output limits, and secret redaction.

The aggregate bundle compiles this package into its own Host artifact. It remains independently publishable for the legacy leaf packages, but end users install `@pirate-608/dsh-multi-tools` rather than this package directly.
