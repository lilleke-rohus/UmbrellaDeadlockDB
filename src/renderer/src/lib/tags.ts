/** Preset labels for script discovery (authors can also add custom tags). */
export const SCRIPT_TAG_PRESETS = ['Hero', 'Helper', 'Movement', 'Utility', 'ESP', 'Combat'] as const

export function dedupeTags(tags: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const t of tags) {
    const s = t.trim()
    if (!s) {
      continue
    }
    const k = s.toLowerCase()
    if (seen.has(k)) {
      continue
    }
    seen.add(k)
    out.push(s)
  }
  return out
}

export function slugifyFilename(name: string): string {
  const base = name.replace(/\.lua$/i, '').trim()
  const s = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return s || 'script'
}
