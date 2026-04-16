import Dexie, { type Table } from 'dexie'

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

export class CatalogDB extends Dexie {
  scripts!: Table<CachedScriptMeta, string>
  syncMeta!: Table<MetaRow, string>

  constructor() {
    super('umbrella-deadlock-db')
    this.version(1).stores({
      scripts: 'id, slug, title, category, updated_at',
      syncMeta: 'id'
    })
    // Version 2: adds multi-entry tags index
    this.version(2).stores({
      scripts: 'id, slug, title, category, updated_at, *tags',
      syncMeta: 'id'
    })
  }
}

export const catalogDb = new CatalogDB()

export async function loadCachedCatalog(): Promise<CachedScriptMeta[]> {
  return catalogDb.scripts.orderBy('updated_at').reverse().toArray()
}

export async function mergeCatalogFromRemote(rows: CachedScriptMeta[]): Promise<void> {
  const incomingIds = new Set(rows.map((r) => r.id))
  await catalogDb.transaction('rw', catalogDb.scripts, catalogDb.syncMeta, async () => {
    const existingIds = await catalogDb.scripts.toCollection().primaryKeys()
    const toDelete = (existingIds as string[]).filter((id) => !incomingIds.has(id))
    if (toDelete.length) {
      await catalogDb.scripts.bulkDelete(toDelete)
    }
    await catalogDb.scripts.bulkPut(rows)
    await catalogDb.syncMeta.put({ id: 'catalog', lastSyncedAt: new Date().toISOString() })
  })
}

export async function getLastSyncedAt(): Promise<string | null> {
  const row = await catalogDb.syncMeta.get('catalog')
  return row?.lastSyncedAt ?? null
}
