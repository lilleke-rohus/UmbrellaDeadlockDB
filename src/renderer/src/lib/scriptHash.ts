import type { ActiveGame } from '../../../shared/ipc'
import { parseUmbrellaHeader, stripFirstLine } from './firstLine'

type HashProgress = {
  done: number
  total: number
}

export type LocalLuaScript = {
  filename: string
  normalizedFilename: string
  content: string
  hash: string
  header: { version: number; iso: string } | null
}

export type LocalLuaScanResult = {
  scripts: LocalLuaScript[]
  error: string | null
}

export type HashCheckCatalogRow = {
  filename: string
  content_hash: string | null
}

export type HashCheckSummary = {
  scanned: number
  matched: number
  current: number
  outdated: number
  missingHash: number
  unknown: number
}

const localHashCache = new Map<string, { content: string; hash: string }>()

export function normalizeFilename(filename: string): string {
  return filename.trim().toLowerCase()
}

export function normalizeLuaForHash(luaSource: string): string {
  const body = parseUmbrellaHeader(luaSource) ? stripFirstLine(luaSource) : luaSource
  return body.replace(/\r\n?/g, '\n')
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(digest)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function computeLuaContentHash(luaSource: string): Promise<string> {
  return sha256Hex(normalizeLuaForHash(luaSource))
}

async function readLocalScriptWithHash(filename: string, game: ActiveGame): Promise<LocalLuaScript | null> {
  const readResult = await window.umbrella.readLocalScript(filename, game)
  if (!readResult.content) {
    return null
  }
  const normalized = normalizeLuaForHash(readResult.content)
  const cached = localHashCache.get(filename)
  const hash = cached?.content === normalized ? cached.hash : await sha256Hex(normalized)
  localHashCache.set(filename, { content: normalized, hash })
  return {
    filename,
    normalizedFilename: normalizeFilename(filename),
    content: readResult.content,
    hash,
    header: parseUmbrellaHeader(readResult.content),
  }
}

export async function scanLocalLuaScriptsWithHashes(
  onProgress?: (progress: HashProgress) => void,
  game: ActiveGame = 'deadlock',
): Promise<LocalLuaScanResult> {
  const listed = await window.umbrella.listLocalScripts(game)
  if (listed.error) {
    return { scripts: [], error: listed.error }
  }
  const names = listed.names
    .filter((name) => name.toLowerCase().endsWith('.lua'))
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
  const scripts: LocalLuaScript[] = []
  let done = 0
  const total = names.length
  onProgress?.({ done, total })
  for (const name of names) {
    const script = await readLocalScriptWithHash(name, game)
    if (script) {
      scripts.push(script)
    }
    done += 1
    onProgress?.({ done, total })
  }
  return { scripts, error: null }
}

export function summarizeHashCheckAgainstCatalog(
  localScripts: LocalLuaScript[],
  catalogRows: HashCheckCatalogRow[],
): HashCheckSummary {
  const byFilename = new Map<string, HashCheckCatalogRow>()
  for (const row of catalogRows) {
    byFilename.set(normalizeFilename(row.filename), row)
  }

  const summary: HashCheckSummary = {
    scanned: localScripts.length,
    matched: 0,
    current: 0,
    outdated: 0,
    missingHash: 0,
    unknown: 0,
  }

  for (const local of localScripts) {
    const match = byFilename.get(local.normalizedFilename)
    if (!match) {
      summary.unknown += 1
      continue
    }
    summary.matched += 1
    if (!match.content_hash) {
      summary.missingHash += 1
      continue
    }
    if (local.hash === match.content_hash) {
      summary.current += 1
      continue
    }
    summary.outdated += 1
  }

  return summary
}
