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

export class ImportError extends Error {}

export type ImportTransactionRequest = {
  account: string
  transactionHash: string
  blockHash: string
}

export type ImportTransactionResponse = {
  imported: boolean
}

export const ImportTransactionRequestSchema: yup.ObjectSchema<ImportTransactionRequest> = yup
  .object({
    account: yup.string().defined(),
    transactionHash: yup.string().defined(),
    blockHash: yup.string().defined(),
  })
  .defined()

export const ImportTransactionResponseSchema: yup.ObjectSchema<ImportTransactionResponse> = yup
  .object({
    imported: yup.boolean().defined(),
  })
  .defined()

routes.register<typeof ImportTransactionRequestSchema, ImportTransactionResponse>(
  `${ApiNamespace.chain}/importTransaction`,
  ImportTransactionRequestSchema,
  async (request, context): Promise<void> => {
    Assert.isInstanceOf(context, FullNode)

    if (!request.data.transactionHash) {
      throw new RpcValidationError(`Missing transaction hash`)
    }

    if (!request.data.blockHash) {
      throw new RpcValidationError(`Missing block hash`)
    }

    const account = getAccount(context.wallet, request.data.account)
    if (!account) {
      throw new RpcValidationError(`Account not found`)
    }

    const transactionHashBuffer = Buffer.from(request.data.transactionHash, 'hex')

    const blockHashBuffer = BlockHashSerdeInstance.deserialize(request.data.blockHash)

    const blockHeader = await context.chain.getHeader(blockHashBuffer)
    if (!blockHeader) {
      throw new RpcNotFoundError(
        `No block found for block hash ${blockHashBuffer.toString('hex')}`,
      )
    }

    const transactions = await context.chain.getBlockTransactions(blockHeader)

    const foundTransaction = transactions.find(({ transaction }) =>
      transaction.hash().equals(transactionHashBuffer),
    )

    if (foundTransaction) {
      const walletblockHeader = {
        hash: foundTransaction.blockHash,
        previousBlockHash: foundTransaction.previousBlockHash,
        sequence: foundTransaction.sequence,
        timestamp: foundTransaction.timestamp,
      }
      const walletTransaction = {
        transaction: foundTransaction.transaction,
        initialNoteIndex: foundTransaction.initialNoteIndex,
      }
      const result = await context.wallet.importBlockTransaction(account, walletblockHeader, [
        walletTransaction,
      ])
      request.end({ imported: result })
    } else {
      throw new RpcNotFoundError(`Transaction not found`)
    }
  },
)
