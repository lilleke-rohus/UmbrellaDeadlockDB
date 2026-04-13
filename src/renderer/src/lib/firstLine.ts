/** Canonical header prefix; DB trigger overwrites full line on save. */
export const UMBRELLA_DB_HEADER_PREFIX = '-- umbrella-db:'

const HEADER_RE = /^-- umbrella-db:\s*v=(\d+(?:\.\d+)?)\s+t=(\S+)/

export function parseUmbrellaHeader(
  luaSource: string
): { version: number; iso: string } | null {
  const first = luaSource.split(/\r?\n/, 1)[0] ?? ''
  const m = first.match(HEADER_RE)
  if (!m) {
    return null
  }
  return { version: Number(m[1]), iso: m[2] }
}

export function stripFirstLine(luaSource: string): string {
  return luaSource.replace(/^[^\r\n]*\r?\n?/, '')
}

export function withHeader(luaSourceBody: string, contentVersion: number, iso: string): string {
  const body = stripFirstLine(luaSourceBody).replace(/^\s+/, '')
  return `${UMBRELLA_DB_HEADER_PREFIX} v=${contentVersion} t=${iso}\n${body}`
}
