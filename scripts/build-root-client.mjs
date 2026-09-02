/** Copy the authored lazy-CJS browser bundle to the package export. */

import { copyFile, mkdir } from 'node:fs/promises'

await mkdir(new URL('../lib/', import.meta.url), { recursive: true })
await copyFile(new URL('../src/client.js', import.meta.url), new URL('../lib/client.js', import.meta.url))
