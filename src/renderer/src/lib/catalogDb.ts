import Dexie, { type Table } from 'dexie'
import type { ActiveGame } from '../../../shared/ipc'

export type CachedScriptMeta = {
  id: string
  slug: string
  title: string
  description: string | null
  category: string | null
  tags: string[] | null
  filename: string
  status: string
  content_version: number
  content_hash: string | null
  updated_at: string
  published_at: string | null
  author_id: string
  author_display_name: string | null
  install_count: number
  author_display_name_override?: string | null
}

type MetaRow = { id: string; lastSyncedAt: string }

class CatalogDB extends Dexie {
  scripts!: Table<CachedScriptMeta, string>
  syncMeta!: Table<MetaRow, string>

  constructor(dbName: string) {
    super(dbName)
    this.version(1).stores({
      scripts: 'id, slug, title, category, updated_at',
      syncMeta: 'id',
    })
    this.version(2).stores({
      scripts: 'id, slug, title, category, updated_at, *tags',
      syncMeta: 'id',
    })
  }
}

const deadlockDb = new CatalogDB('umbrella-deadlock-db')
const dota2Db = new CatalogDB('umbrella-dota2-db')

function dbFor(game: ActiveGame): CatalogDB {
  return game === 'dota2' ? dota2Db : deadlockDb
}

export async function loadCachedCatalog(game: ActiveGame = 'deadlock'): Promise<CachedScriptMeta[]> {
  return dbFor(game).scripts.orderBy('updated_at').reverse().toArray()
}

export async function mergeCatalogFromRemote(rows: CachedScriptMeta[], game: ActiveGame = 'deadlock'): Promise<void> {
  const db = dbFor(game)
  const incomingIds = new Set(rows.map((r) => r.id))
  await db.transaction('rw', db.scripts, db.syncMeta, async () => {
    const existingIds = await db.scripts.toCollection().primaryKeys()
    const toDelete = (existingIds as string[]).filter((id) => !incomingIds.has(id))
    if (toDelete.length) {
      await db.scripts.bulkDelete(toDelete)
    }
    await db.scripts.bulkPut(rows)
    await db.syncMeta.put({ id: 'catalog', lastSyncedAt: new Date().toISOString() })
  })
}

export async function getLastSyncedAt(game: ActiveGame = 'deadlock'): Promise<string | null> {
  const row = await dbFor(game).syncMeta.get('catalog')
  return row?.lastSyncedAt ?? null
}
