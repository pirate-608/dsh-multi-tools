/** Locate the aggregate package root in source and built executions. */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Find the nearest package.json belonging to the aggregate bundle. */
export function findPackageRoot(moduleUrl: string): string {
  let current = dirname(fileURLToPath(moduleUrl))
  while (true) {
    const manifest = join(current, 'package.json')
    if (existsSync(manifest)) {
      try {
        const value = JSON.parse(readFileSync(manifest, 'utf8')) as { name?: unknown }
        if (value.name === '@pirate-608/dsh-multi-tools') return current
      } catch {
        // A parent package.json belonging to another tool is not our root.
      }
    }
    const parent = resolve(current, '..')
    if (parent === current) throw new Error('Cannot locate @pirate-608/dsh-multi-tools package root')
    current = parent
  }
}
