/** Verify the built Host and browser exports are importable JavaScript. */

import { readFile } from 'node:fs/promises'

const host = await import(new URL('../lib/src/index.js', import.meta.url))
if (host.name !== 'dsh-multi-tools' || typeof host.Config !== 'function' || typeof host.apply !== 'function') {
  throw new Error('Built Host export is incomplete')
}
const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
if (!client.includes("id: '@pirate-608/dsh-multi-tools'") || !client.includes("id: 'multi-tools'")) {
  throw new Error('Built client export is incomplete')
}
