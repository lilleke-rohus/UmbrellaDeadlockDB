import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { supabaseConfigured } from '../lib/supabase'
import { runAutoUpdate } from '../lib/autoUpdate'

function WinControls(): React.ReactElement {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void window.umbrella.windowIsMaximized().then(setMaximized)
  }, [])

  return (
    <div className="win-controls">
      <button
        type="button"
        className="win-btn"
        aria-label="Minimize"
        onClick={() => void window.umbrella.windowMinimize()}
      >
        <svg viewBox="0 0 10 1" aria-hidden><rect width="10" height="1" /></svg>
      </button>
      <button
        type="button"
        className="win-btn"
        aria-label={maximized ? 'Restore' : 'Maximize'}
        onClick={() => void window.umbrella.windowMaximize().then(() => setMaximized((m) => !m))}
      >
        {maximized ? (
          <svg viewBox="0 0 10 10" aria-hidden>
            <path d="M2 0H10V8H8V2H0V10H8V8M2 0V2H0" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 10 10" aria-hidden>
            <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" />
          </svg>
        )}
      </button>
      <button
        type="button"
        className="win-btn win-btn-close"
        aria-label="Close"
        onClick={() => void window.umbrella.windowClose()}
      >
        <svg viewBox="0 0 10 10" aria-hidden>
          <path d="M0 0L10 10M10 0L0 10" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
    </div>
  )
}
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

export type VaultOutletContext = {
  storeSearch: string
  setStoreSearch: (v: string) => void
  storeView: 'grid' | 'list'
  setStoreView: (v: 'grid' | 'list') => void
  librarySearch: string
  setLibrarySearch: (v: string) => void
  libraryView: 'grid' | 'list'
  setLibraryView: (v: 'grid' | 'list') => void
  libraryNewDraft: boolean
  setLibraryNewDraft: (v: boolean) => void
}

export function Layout(): React.ReactElement {
  const { user, role, signOut, canOpenAuthorStudio, profile } = useAuth()
  const { addToast } = useToast()
  const location = useLocation()

  const [storeSearch, setStoreSearch] = useState('')
  const [storeView, setStoreView] = useState<'grid' | 'list'>(() => {
    const v = localStorage.getItem('umbrella_store_view')
    return v === 'list' ? 'list' : 'grid'
  })
  const [librarySearch, setLibrarySearch] = useState('')
  const [libraryView, setLibraryView] = useState<'grid' | 'list'>(() => {
    const v = localStorage.getItem('umbrella_library_view')
    return v === 'list' ? 'list' : 'grid'
  })
  const [libraryNewDraft, setLibraryNewDraft] = useState(false)

  useEffect(() => {
    void window.umbrella.getSettings().then(async (s) => {
      if (s.autoUpdateScripts) {
        const result = await runAutoUpdate()
        if (result.updated > 0) {
          addToast(`Auto-updated ${result.updated} script${result.updated !== 1 ? 's' : ''}.`, 'success')
        }
        if (result.errors.length > 0) {
          addToast(`Update errors: ${result.errors.join('; ')}`, 'error')
        }
      }
    })
  }, [addToast])

  useEffect(() => {
    localStorage.setItem('umbrella_store_view', storeView)
  }, [storeView])

  useEffect(() => {
    localStorage.setItem('umbrella_library_view', libraryView)
  }, [libraryView])

  const isStoreRoot = location.pathname === '/'
  const isScriptDetail = location.pathname.startsWith('/script/')
  const isLibrary = location.pathname === '/author'
  const isSettings = location.pathname.startsWith('/settings')
  const isReview = location.pathname.startsWith('/moderator')
  const isAdmin = location.pathname.startsWith('/admin')

  const pageTitle = useMemo(() => {
    if (isStoreRoot || isScriptDetail) return 'Store'
    if (isLibrary) return 'Library'
    if (isSettings) return 'Settings'
    if (isReview) return 'Review'
    if (isAdmin) return 'Admin'
    return 'Umbrella Deadlock DB'
  }, [isAdmin, isLibrary, isReview, isScriptDetail, isSettings, isStoreRoot])

  const initials = useMemo(() => {
    const name = profile?.display_name?.trim() || user?.email?.split('@')[0] || '?'
    const parts = name.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }, [profile?.display_name, user?.email])

  const roleLabel = useMemo(() => {
    if (!user) return 'Guest'
    if (profile?.author_blocked) return 'Author blocked'
    return role
  }, [profile?.author_blocked, role, user])

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
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          const el = document.getElementById('main-content')
          if (el) {
            e.preventDefault()
            el.focus()
            el.scrollIntoView({ block: 'start' })
          }
        }}
      >
        Skip to main content
      </a>

      {/* ── Custom title bar ── */}
      <div className="titlebar">
        <div className="titlebar-drag">
          <div className="titlebar-logo-mark" aria-hidden>
            <IconLogo />
          </div>
          <span className="titlebar-app-name">Umbrella Deadlock DB</span>
        </div>
        <WinControls />
      </div>

      {/* ── Body (sidebar + main) ── */}
      <div className="app-body">

      {/* ── Sidebar ── */}
      <aside className="sidebar" aria-label="App">
        <div className="nav-section">
          <div className="nav-label">Browse</div>
          <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <IconStore />
            Store
          </NavLink>
          <NavLink to="/author" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <IconLibrary />
            Library
          </NavLink>

          <div className="nav-label" style={{ marginTop: 8 }}>Account</div>
          <NavLink to="/settings" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <IconSettings />
            Settings
            {!supabaseConfigured && <span className="nav-badge">!</span>}
          </NavLink>
          {user && ['moderator', 'admin'].includes(role) && (
            <NavLink to="/moderator" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <IconReview />
              Review
            </NavLink>
          )}
          {user && role === 'admin' && (
            <NavLink to="/admin" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <IconAdmin />
              Admin
            </NavLink>
          )}
        </div>

        <div className="sidebar-bottom">
          {user ? (
            <div className="user-row user-row-stack">
              <div className="user-row-top">
                <div className="avatar" aria-hidden>{initials}</div>
                <div className="user-text">
                  <div className="user-name">{profile?.display_name?.trim() || user.email?.split('@')[0] || 'User'}</div>
                  <div className="user-role">{roleLabel}</div>
                </div>
              </div>
              <button type="button" className="btn btn-ghost btn-block" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
          ) : (
            <div className="user-row">
              <NavLink to="/login" className="btn btn-primary btn-block">Sign in</NavLink>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main">
        <header className="topbar">
          <span className="page-title">{pageTitle}</span>

          {/* Store topbar */}
          {isStoreRoot && (
            <>
              <div className="search-wrap">
                <span className="search-icon" aria-hidden><IconSearch /></span>
                <input
                  id="vault-store-search"
                  className="search-input"
                  placeholder="Search scripts…"
                  value={storeSearch}
                  onChange={(e) => setStoreSearch(e.target.value)}
                  aria-label="Search scripts"
                />
              </div>
              <div className="topbar-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-compact"
                  onClick={() => document.getElementById('vault-store-search')?.focus()}
                >
                  Filter
                </button>
                <div className="view-toggle" role="group" aria-label="View layout">
                  <button
                    type="button"
                    className={`view-btn${storeView === 'grid' ? ' active' : ''}`}
                    aria-pressed={storeView === 'grid'}
                    onClick={() => setStoreView('grid')}
                    title="Grid"
                  >
                    <IconGrid />
                  </button>
                  <button
                    type="button"
                    className={`view-btn${storeView === 'list' ? ' active' : ''}`}
                    aria-pressed={storeView === 'list'}
                    onClick={() => setStoreView('list')}
                    title="List"
                  >
                    <IconList />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Library topbar */}
          {isLibrary && (
            <>
              <div className="search-wrap">
                <span className="search-icon" aria-hidden><IconSearch /></span>
                <input
                  id="vault-library-search"
                  className="search-input"
                  placeholder="Search your library…"
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  aria-label="Search library"
                />
              </div>
              <div className="topbar-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-compact"
                  onClick={() => document.getElementById('vault-library-search')?.focus()}
                >
                  Filter
                </button>
                {user && canOpenAuthorStudio && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setLibraryNewDraft(true)}
                  >
                    New draft
                  </button>
                )}
                <div className="view-toggle" role="group" aria-label="View layout">
                  <button
                    type="button"
                    className={`view-btn${libraryView === 'grid' ? ' active' : ''}`}
                    aria-pressed={libraryView === 'grid'}
                    onClick={() => setLibraryView('grid')}
                    title="Grid"
                  >
                    <IconGrid />
                  </button>
                  <button
                    type="button"
                    className={`view-btn${libraryView === 'list' ? ' active' : ''}`}
                    aria-pressed={libraryView === 'list'}
                    onClick={() => setLibraryView('list')}
                    title="List"
                  >
                    <IconList />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Admin topbar action */}
          {isAdmin && (
            <div className="topbar-actions">
              {/* populated via page if needed */}
            </div>
          )}
        </header>

        <div id="main-content" className="content" tabIndex={-1}>
          <Outlet context={outletCtx satisfies VaultOutletContext} />
        </div>
      </div>

      </div>{/* end app-body */}
    </div>
  )
}
