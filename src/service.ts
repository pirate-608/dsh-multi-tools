/** Typert Remote service exposed to the Multi Tools browser half. */

import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { IntegrationId, IntegrationTargetId, MultiToolsStatusSnapshot, ProbeMode } from '../packages/plugin-kit/src/types.js'
import { MultiToolsController } from './controller.js'

/** Browser-facing aggregate status and selection service. */
export class MultiToolsService extends TypertRemoteService {
  constructor(ctx: Context, private readonly controller: MultiToolsController) {
    super(ctx, 'multiTools')
  }

  /** Read an installed or explicitly live dependency snapshot. */
  @Remote('status')
  async status(request?: { mode?: ProbeMode, integrations?: IntegrationTargetId[] }): Promise<MultiToolsStatusSnapshot> {
    return await this.controller.status(request ?? {})
  }

  /** Apply one revision-fenced all-or-nothing preset selection. */
  @Remote('applySelection')
  async applySelection(request: { enabled: IntegrationId[], expectedRevision: string }): Promise<MultiToolsStatusSnapshot> {
    return await this.controller.applySelection(request)
  }
}
