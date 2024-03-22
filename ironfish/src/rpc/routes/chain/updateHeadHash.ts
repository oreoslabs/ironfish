/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import * as yup from 'yup'
import { RpcNotFoundError, RpcValidationError } from '../../adapters'
import { ApiNamespace } from '../namespaces'
import { routes } from '../router'
import { BlockHashSerdeInstance } from '../../../serde'
import { Assert } from '../../../assert'
import { FullNode } from '../../../node'
import { getAccount } from '../wallet/utils'

export type UpdateHeadHashRequest = {
  account: string
  blockHash: string
}

export type UpdateHeadHashResponse = {
  updated: boolean
}

export const UpdateHeadHashRequestSchema: yup.ObjectSchema<UpdateHeadHashRequest> = yup
  .object({
    account: yup.string().defined(),
    blockHash: yup.string().defined(),
  })
  .defined()

export const UpdateHeadHashResponseSchema: yup.ObjectSchema<UpdateHeadHashResponse> = yup
  .object({
    updated: yup.boolean().defined(),
  })
  .defined()

routes.register<typeof UpdateHeadHashRequestSchema, UpdateHeadHashResponse>(
  `${ApiNamespace.chain}/updateHeadHash`,
  UpdateHeadHashRequestSchema,
  async (request, context): Promise<void> => {
    Assert.isInstanceOf(context, FullNode)

    if (!request.data.blockHash) {
      throw new RpcValidationError(`Missing block hash`)
    }

    const account = getAccount(context.wallet, request.data.account)
    if (!account) {
      throw new RpcValidationError(`Account not found`)
    }

    const blockHashBuffer = BlockHashSerdeInstance.deserialize(request.data.blockHash)

    const blockHeader = await context.chain.getHeader(blockHashBuffer)
    if (!blockHeader) {
      throw new RpcNotFoundError(
        `No block found for block hash ${blockHashBuffer.toString('hex')}`,
      )
    }

    const walletblockHeader = {
      hash: blockHeader.hash,
      previousBlockHash: blockHeader.previousBlockHash,
      sequence: blockHeader.sequence,
      timestamp: blockHeader.timestamp,
    }
    const result = await context.wallet.importBlockTransaction(account, walletblockHeader, [])
    request.end({ updated: result })
  },
)
