/** Installable DSH Multi Tools Host bundle. */

import type { Context } from '@deepseek-ai/cordis'
import { apply as applyModLens } from '../plugins/modlens/src/index.js'
import { Config as ConfigSchema, validateConfig, type Config as MultiToolsConfig } from './config.js'
import { MultiToolsController } from './controller.js'
import { findPackageRoot } from './package-root.js'
import { MultiToolsService } from './service.js'

export const name = 'dsh-multi-tools'
export const inject = ['settings', 'tools', 'fs', 'attachments']
export const Config = ConfigSchema
export type Config = MultiToolsConfig
export type * from '../packages/plugin-kit/src/types.js'

/** Register ModLens, settings, dependency status, and preset management. */
export async function apply(ctx: Context, entryConfig: MultiToolsConfig): Promise<void> {
  validateConfig(entryConfig)
  const scope = ctx.settings.register('dsh-multi-tools', ConfigSchema, { base: entryConfig, validate: validateConfig })
  const modlensConfig = structuredClone(scope.get().modlens)
  const existingModLens = (ctx as unknown as { tools: { get?(name: string): unknown } }).tools.get?.('modlens_read_image')
  if (existingModLens !== undefined) {
    throw new Error('dsh-multi-tools: modlens_read_image is already registered; remove the standalone dsh-modlens bundle before enabling this aggregate')
  }
  applyModLens(ctx as never, modlensConfig)
  scope.watch(next => {
    for (const key of Object.keys(modlensConfig)) delete (modlensConfig as Record<string, unknown>)[key]
    Object.assign(modlensConfig, structuredClone(next.modlens))
  })
  const controller = new MultiToolsController(
    findPackageRoot(import.meta.url),
    scope,
    async reference => {
      const provider = (ctx as unknown as { get?(name: string): unknown }).get?.('credentials') as { resolve(reference: string): Promise<unknown> } | undefined
      return provider === undefined ? false : await provider.resolve(reference) !== undefined
    },
  )
  new MultiToolsService(ctx, controller)
  await controller.initialize()
}

export default apply
