import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState, type MouseEvent, type ReactElement, type ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { APP_DISPLAY_NAME } from '../lib/appDisplayName'
import { supabaseConfigured } from '../lib/supabase'
import { runAutoUpdate } from '../lib/autoUpdate'
import {
  IconAdmin,
  IconGrid,
  IconLibrary,
  IconList,
  IconLogo,
  IconReview,
  IconSearch,
  IconSettings,
  IconStore,
} from './NavIcons'

const STORAGE = {
  storeView: 'umbrella_store_view',
  libraryView: 'umbrella_library_view',
} as const

type GridListView = 'grid' | 'list'

export type VaultOutletContext = {
  storeSearch: string
  setStoreSearch: (v: string) => void
  storeView: GridListView
  setStoreView: (v: GridListView) => void
  librarySearch: string
  setLibrarySearch: (v: string) => void
  libraryView: GridListView
  setLibraryView: (v: GridListView) => void
  libraryNewDraft: boolean
  setLibraryNewDraft: (v: boolean) => void
}

type RouteFlags = {
  isStoreRoot: boolean
  isScriptDetail: boolean
  isLibrary: boolean
  isSettings: boolean
  isReview: boolean
  isAdmin: boolean
}

export function Layout(): ReactElement {
  const { user, role, signOut, canOpenAuthorStudio, profile } = useAuth()
  const { addToast } = useToast()
  const location = useLocation()

  const [storeSearch, setStoreSearch] = useState('')
  const [storeView, setStoreView] = usePersistedGridListView(STORAGE.storeView)
  const [librarySearch, setLibrarySearch] = useState('')
  const [libraryView, setLibraryView] = usePersistedGridListView(STORAGE.libraryView)
  const [libraryNewDraft, setLibraryNewDraft] = useState(false)

  useScriptAutoUpdateOnMount(addToast)

  const route = useMemo(() => routeFlagsFromPath(location.pathname), [location.pathname])
  const pageTitle = useMemo(() => pageTitleFromRoute(route), [route])
  useEffect(() => {
    document.title = `${pageTitle} · ${APP_DISPLAY_NAME}`
  }, [pageTitle])
  const initials = useMemo(() => initialsFromUser(profile?.display_name, user?.email), [profile?.display_name, user?.email])
  const roleLabel = useMemo(() => roleLabelFromAuth(user, profile?.author_blocked, role), [profile?.author_blocked, role, user])

  const outletCtx: VaultOutletContext = {
    storeSearch,
    setStoreSearch,
    storeView,
    setStoreView,
    librarySearch,
    setLibrarySearch,
    libraryView,
    setLibraryView,
    libraryNewDraft,
    setLibraryNewDraft,
  }

  return (
    <div className="layout app-shell">
      <SkipToMainLink />

      <TitleBar />

      <div className="app-body">
        <aside className="sidebar" aria-label="App">
          <SidebarMainNav user={user} role={role} />
          <SidebarAccountPanel
            user={user}
            profile={profile}
            initials={initials}
            roleLabel={roleLabel}
            onSignOut={() => void signOut()}
          />
        </aside>

        <div className="main">
          <header className="topbar">
            <span className="page-title">{pageTitle}</span>

            {(route.isStoreRoot || route.isScriptDetail) && (
              <VaultSearchTopbar
                searchInputId="vault-store-search"
                placeholder="Search scripts…"
                searchAriaLabel="Search scripts"
                search={storeSearch}
                onSearchChange={setStoreSearch}
                view={storeView}
                onViewChange={setStoreView}
              />
            )}

            {route.isLibrary && (
              <VaultSearchTopbar
                searchInputId="vault-library-search"
                placeholder="Search your library…"
                searchAriaLabel="Search library"
                search={librarySearch}
                onSearchChange={setLibrarySearch}
                view={libraryView}
                onViewChange={setLibraryView}
                trailing={
                  user && canOpenAuthorStudio ? (
                    <button type="button" className="btn btn-primary" onClick={() => setLibraryNewDraft(true)}>
                      New draft
                    </button>
                  ) : null
                }
              />
            )}

            {route.isAdmin && <div className="topbar-actions" />}
          </header>

          <div id="main-content" className="content" tabIndex={-1}>
            <Outlet context={outletCtx satisfies VaultOutletContext} />
          </div>
        </div>
      </div>
    </div>
  )
}

function usePersistedGridListView(storageKey: string): [GridListView, (v: GridListView) => void] {
  const [view, setView] = useState<GridListView>(() => readGridListPreference(storageKey))
  useEffect(() => {
    localStorage.setItem(storageKey, view)
  }, [storageKey, view])
  return [view, setView]
}

function readGridListPreference(key: string): GridListView {
  return localStorage.getItem(key) === 'list' ? 'list' : 'grid'
}

function useScriptAutoUpdateOnMount(addToast: ReturnType<typeof useToast>['addToast']): void {
  useEffect(() => {
    void window.umbrella.getSettings().then(async (s) => {
      if (!s.autoUpdateScripts) return
      const result = await runAutoUpdate()
      if (result.updated > 0) {
        addToast(`Auto-updated ${result.updated} script${result.updated !== 1 ? 's' : ''}.`, 'success')
      }
      if (result.errors.length > 0) {
        addToast(`Update errors: ${result.errors.join('; ')}`, 'error')
      }
    })
  }, [addToast])
}

function routeFlagsFromPath(pathname: string): RouteFlags {
  return {
    isStoreRoot: pathname === '/',
    isScriptDetail: pathname.startsWith('/script/'),
    isLibrary: pathname === '/author',
    isSettings: pathname.startsWith('/settings'),
    isReview: pathname.startsWith('/moderator'),
    isAdmin: pathname.startsWith('/admin'),
  }
}

function pageTitleFromRoute(r: RouteFlags): string {
  if (r.isStoreRoot || r.isScriptDetail) return 'Store'
  if (r.isLibrary) return 'Library'
  if (r.isSettings) return 'Settings'
  if (r.isReview) return 'Review'
  if (r.isAdmin) return 'Admin'
  return APP_DISPLAY_NAME
}

function initialsFromUser(displayName: string | undefined | null, email: string | undefined | null): string {
  const name = displayName?.trim() || email?.split('@')[0] || '?'
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function roleLabelFromAuth(
  user: ReturnType<typeof useAuth>['user'],
  authorBlocked: boolean | undefined,
  role: ReturnType<typeof useAuth>['role'],
): string {
  if (!user) return 'Guest'
  if (authorBlocked) return 'Author blocked'
  return role
}

function navItemClassName(isActive: boolean): string {
  return `nav-item${isActive ? ' active' : ''}`
}

function SkipToMainLink(): ReactElement {
  const focusMain = (e: MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById('main-content')
    if (!el) return
    e.preventDefault()
    el.focus()
    el.scrollIntoView({ block: 'start' })
  }
  return (
    <a href="#main-content" className="skip-link" onClick={focusMain}>
      Skip to main content
    </a>
  )
}

function TitleBar(): ReactElement {
  return (
    <div className="titlebar">
      <div className="titlebar-drag">
        <div className="titlebar-logo-mark" aria-hidden>
          <IconLogo />
        </div>
        <span className="titlebar-app-name">{APP_DISPLAY_NAME}</span>
      </div>
      <WinControls />
    </div>
  )
}

function WinControls(): ReactElement {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void window.umbrella.windowIsMaximized().then(setMaximized)
  }, [])

  return (
    <div className="win-controls">
      <button type="button" className="win-btn" aria-label="Minimize" onClick={() => void window.umbrella.windowMinimize()}>
        <svg viewBox="0 0 10 1" aria-hidden>
          <rect width="10" height="1" />
        </svg>
      </button>
      <button
        type="button"
        className="win-btn"
        aria-label={maximized ? 'Restore' : 'Maximize'}
        onClick={() => void window.umbrella.windowMaximize().then(() => setMaximized((m) => !m))}
      >
        {maximized ? <RestoreWindowIcon /> : <MaximizeWindowIcon />}
      </button>
      <button type="button" className="win-btn win-btn-close" aria-label="Close" onClick={() => void window.umbrella.windowClose()}>
        <svg viewBox="0 0 10 10" aria-hidden>
          <path d="M0 0L10 10M10 0L0 10" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
    </div>
  )
}

function MaximizeWindowIcon(): ReactElement {
  return (
    <svg viewBox="0 0 10 10" aria-hidden>
      <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" />
    </svg>
  )
}

function RestoreWindowIcon(): ReactElement {
  return (
    <svg viewBox="0 0 10 10" aria-hidden>
      <path d="M2 0H10V8H8V2H0V10H8V8M2 0V2H0" fill="currentColor" />
    </svg>
  )
}

type AuthUser = NonNullable<ReturnType<typeof useAuth>['user']>
type AuthRole = ReturnType<typeof useAuth>['role']

function SidebarMainNav({ user, role }: { user: AuthUser | null; role: AuthRole }): ReactElement {
  const showReview = user && ['moderator', 'admin'].includes(role)
  const showAdmin = user && role === 'admin'

  return (
    <div className="nav-section">
      <div className="nav-label">Browse</div>
      <NavLink to="/" end className={({ isActive }) => navItemClassName(isActive)}>
        <IconStore />
        Store
      </NavLink>
      <NavLink to="/author" className={({ isActive }) => navItemClassName(isActive)}>
        <IconLibrary />
        Library
      </NavLink>

      <div className="nav-label" style={{ marginTop: 8 }}>
        Account
      </div>
      <NavLink to="/settings" className={({ isActive }) => navItemClassName(isActive)}>
        <IconSettings />
        Settings
        {!supabaseConfigured && <span className="nav-badge">!</span>}
      </NavLink>
      {showReview && (
        <NavLink to="/moderator" className={({ isActive }) => navItemClassName(isActive)}>
          <IconReview />
          Review
        </NavLink>
      )}
      {showAdmin && (
        <NavLink to="/admin" className={({ isActive }) => navItemClassName(isActive)}>
          <IconAdmin />
          Admin
        </NavLink>
      )}
    </div>
  )
}

function SidebarAccountPanel({
  user,
  profile,
  initials,
  roleLabel,
  onSignOut,
}: {
  user: AuthUser | null
  profile: ReturnType<typeof useAuth>['profile']
  initials: string
  roleLabel: string
  onSignOut: () => void
}): ReactElement {
  return (
    <div className="sidebar-bottom">
      {user ? (
        <div className="user-row user-row-stack">
          <div className="user-row-top">
            <div className="avatar" aria-hidden>
              {initials}
            </div>
            <div className="user-text">
              <div className="user-name">{profile?.display_name?.trim() || user.email?.split('@')[0] || 'User'}</div>
              <div className="user-role">{roleLabel}</div>
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-block" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      ) : (
        <div className="user-row">
          <NavLink to="/login" className="btn btn-primary btn-block">
            Sign in
          </NavLink>
        </div>
      )}
    </div>
  )
}

function VaultSearchTopbar({
  searchInputId,
  placeholder,
  searchAriaLabel,
  search,
  onSearchChange,
  view,
  onViewChange,
  trailing,
}: {
  searchInputId: string
  placeholder: string
  searchAriaLabel: string
  search: string
  onSearchChange: (v: string) => void
  view: GridListView
  onViewChange: (v: GridListView) => void
  trailing?: ReactNode
}): ReactElement {
  const focusSearch = () => document.getElementById(searchInputId)?.focus()

  return (
    <>
      <div className="search-wrap">
        <span className="search-icon" aria-hidden>
          <IconSearch />
        </span>
        <input
          id={searchInputId}
          className="search-input"
          placeholder={placeholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label={searchAriaLabel}
        />
      </div>
      <div className="topbar-actions">
        <button type="button" className="btn btn-ghost btn-compact" onClick={focusSearch}>
          Filter
        </button>
        {trailing}
        <ViewToggle view={view} onViewChange={onViewChange} />
      </div>
    </>
  )
}

function ViewToggle({
  view,
  onViewChange,
}: {
  view: GridListView
  onViewChange: (v: GridListView) => void
}): ReactElement {
  return (
    <div className="view-toggle" role="group" aria-label="View layout">
      <ViewModeButton mode="grid" label="Grid" current={view} onSelect={onViewChange} />
      <ViewModeButton mode="list" label="List" current={view} onSelect={onViewChange} />
    </div>
  )
}

function ViewModeButton({
  mode,
  label,
  current,
  onSelect,
}: {
  mode: GridListView
  label: string
  current: GridListView
  onSelect: (v: GridListView) => void
}): ReactElement {
  const active = current === mode
  return (
    <button
      type="button"
      className={`view-btn${active ? ' active' : ''}`}
      aria-pressed={active}
      onClick={() => onSelect(mode)}
      title={label}
    >
      {mode === 'grid' ? <IconGrid /> : <IconList />}
    </button>
  )
}
