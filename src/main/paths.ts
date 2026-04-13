import path from 'node:path'

/** Returns null if resolved path escapes root (directory traversal). */
export function resolveUnderRoot(root: string, relativeFilename: string): string | null {
  const rootAbs = path.resolve(root)
  const joined = path.resolve(rootAbs, relativeFilename)
  const rel = path.relative(rootAbs, joined)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return null
  }
  return joined
}
