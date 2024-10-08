/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import {
  BufferEncoding,
  IDatabase,
  IDatabaseStore,
  IDatabaseTransaction,
  PrefixEncoding,
  U64_ENCODING,
} from '../../storage'
import { createDB } from '../../storage/utils'
import { Database, Migration, MigrationContext } from '../migration'

export class Migration026 extends Migration {
  path = __filename
  database = Database.WALLET

  prepare(context: MigrationContext): IDatabase {
    return createDB({ location: context.config.walletDatabasePath })
  }

  /*
   * This migration pre-dated the network reset in f483d9aeb87eda3101ae2c602e19d3ebb88897b6
   *
   * All assets, transactions, and notes from before the reset are no longer valid.
   *
   * These data need to be deleted before the node can run, so there is no need
   * to run this migration.
   */

  async forward(
    context: MigrationContext,
    db: IDatabase,
    _tx: IDatabaseTransaction | undefined,
  ): Promise<void> {
    const timestampToTransactionHash: IDatabaseStore<{ key: [Buffer, number]; value: Buffer }> =
      db.addStore({
        name: 'T',
        keyEncoding: new PrefixEncoding(new BufferEncoding(), U64_ENCODING, 4),
        valueEncoding: new BufferEncoding(),
      })

    await timestampToTransactionHash.clear()
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async backward(): Promise<void> {}
}
