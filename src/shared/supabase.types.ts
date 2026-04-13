export type ProfileRole = 'reader' | 'author' | 'moderator' | 'admin'

export type ScriptStatus = 'draft' | 'pending_review' | 'published' | 'rejected'

export type ScriptRow = {
  id: string
  slug: string
  title: string
  description: string | null
  category: string | null
  tags: string[] | null
  filename: string
  lua_source: string
  status: ScriptStatus
  published_at: string | null
  rejected_reason: string | null
  content_version: number
  updated_at: string
  created_at: string
  author_id: string
  changelog: string | null
  install_count: number
  author_display_name_override?: string | null
}

export type ProfileRow = {
  id: string
  display_name: string | null
  role: ProfileRole
  /** Present after migration `20260415100000_admin_and_coauthors`; treat missing as false. */
  verified_developer?: boolean
  author_blocked?: boolean
  author_blocked_reason?: string | null
  created_at: string
  updated_at: string
}

export type AdminSettingRow = {
  key: string
  value: Record<string, unknown>
  updated_at: string
  updated_by: string | null
}

export type ScriptChangelogRow = {
  id: string
  script_id: string
  version: number
  body: string
  created_at: string
}

export type ScriptListItem = Pick<
  ScriptRow,
  | 'id'
  | 'slug'
  | 'title'
  | 'description'
  | 'category'
  | 'tags'
  | 'filename'
  | 'status'
  | 'content_version'
  | 'updated_at'
  | 'published_at'
  | 'author_id'
> & {
  author_display_name?: string | null
}
