/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import * as yup from 'yup'
import { DecodeInvalidName } from '../../../wallet'
import { DuplicateAccountNameError } from '../../../wallet/errors'
import { RPC_ERROR_CODES, RpcValidationError } from '../../adapters'
import { ApiNamespace } from '../namespaces'
import { routes } from '../router'
import { AssertHasRpcContext } from '../rpcContext'
import { RpcMultisigKeys } from './types'
import { AccountImport } from '../../../wallet/exporter'
import { deserializeRpcAccountMultisigKeys } from './serializers'

export class ImportError extends Error {}

type RpcAccountImport = {
  version: number
  name: string
  viewKey: string
  incomingViewKey: string
  outgoingViewKey: string
  publicAddress: string
  spendingKey: string | null
  createdAt: { hash: string; sequence: number } | null
  multisigKeys?: RpcMultisigKeys
  proofAuthorizingKey: string | null
}

function deserializeRpcAccountImport(accountImport: RpcAccountImport): AccountImport {
  return {
    ...accountImport,
    createdAt: accountImport.createdAt
      ? {
          hash: Buffer.from(accountImport.createdAt.hash, 'hex'),
          sequence: accountImport.createdAt.sequence,
        }
      : null,
    multisigKeys: accountImport.multisigKeys
      ? deserializeRpcAccountMultisigKeys(accountImport.multisigKeys)
      : undefined,
  }
}

export type ImportAccountRequest = {
  account: RpcAccountImport | string
  name?: string
  rescan?: boolean
}

export type ImportResponse = {
  name: string
  isDefaultAccount: boolean
}

export const ImportAccountRequestSchema: yup.ObjectSchema<ImportAccountRequest> = yup
  .object({
    rescan: yup.boolean().optional().default(true),
    name: yup.string().optional(),
    account: yup.mixed<RpcAccountImport | string>().defined(),
  })
  .defined()

export const ImportAccountResponseSchema: yup.ObjectSchema<ImportResponse> = yup
  .object({
    name: yup.string().defined(),
    isDefaultAccount: yup.boolean().defined(),
  })
  .defined()

routes.register<typeof ImportAccountRequestSchema, ImportResponse>(
  `${ApiNamespace.wallet}/importAccount`,
  ImportAccountRequestSchema,
  async (request, context): Promise<void> => {
    try {
      let accountImport = null
      AssertHasRpcContext(request, context, 'wallet')
      if (typeof request.data.account === 'string') {
        // should never happen
        throw new RpcValidationError('unimplemented', 400, RPC_ERROR_CODES.VALIDATION)
      } else {
        accountImport = deserializeRpcAccountImport(request.data.account)
        const account = await context.wallet.importAccount(accountImport, {
          createdAt: request.data.account.createdAt?.sequence,
        })
        const isDefaultAccount = context.wallet.getDefaultAccount()?.id === account.id

        request.end({
          name: account.name,
          isDefaultAccount,
        })
      }
    } catch (e) {
      if (e instanceof DuplicateAccountNameError) {
        throw new RpcValidationError(e.message, 400, RPC_ERROR_CODES.DUPLICATE_ACCOUNT_NAME)
      } else if (e instanceof DecodeInvalidName) {
        throw new RpcValidationError(
          e.message,
          400,
          RPC_ERROR_CODES.IMPORT_ACCOUNT_NAME_REQUIRED,
        )
      }
      throw e
    }
  },
)
