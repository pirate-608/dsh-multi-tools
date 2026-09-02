# Notices

DSH Multi Tools is a private aggregate build of the integration sources recorded in `SYNC_SOURCES.json` and the generated `dist/integrations/manifest.json`.

The aggregate includes or invokes third-party components under their own terms. Each integration payload retains its `LICENSE`, `NOTICE.md`, `THIRD_PARTY_NOTICES.md`, and `UPSTREAM.json` files when present. In particular:

- ModLens is derived from liustack/modlens under MIT.
- MCP for Unity is invoked as `mcpforunityserver==10.1.2` under MIT.
- RenPy MCP payloads retain AGPL-3.0-or-later material and notices.
- Comfy CLI and comfy-mcp are installed separately by the user and are not vendored.
- After Effects, Photoshop, Premiere, and AutoCAD integrations remain personal-build-only while their first-party redistribution status is unresolved.

No external executable, model, account credential, or desktop application is installed by npm lifecycle hooks.
