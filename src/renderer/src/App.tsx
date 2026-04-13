import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { Layout } from './components/Layout'
import { UpdateNotifier } from './components/UpdateNotifier'
import { HomePage } from './pages/HomePage'
import { ScriptDetailPage } from './pages/ScriptDetailPage'
import { SettingsPage } from './pages/SettingsPage'
import { LoginPage } from './pages/LoginPage'
import { AuthorPage } from './pages/AuthorPage'
import { AuthorProfilePage } from './pages/AuthorProfilePage'
import { ModeratorPage } from './pages/ModeratorPage'
import { AdminPage } from './pages/AdminPage'
import { PrivacyPolicyPage, TermsOfServicePage } from './pages/LegalDocsPages'

function ModeratorRoute({ children }: { children: ReactNode }): React.ReactElement {
  const { user, role, loading } = useAuth()
  if (loading) {
    return <div className="page-loading">Loading…</div>
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (!['moderator', 'admin'].includes(role)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function AdminRoute({ children }: { children: ReactNode }): React.ReactElement {
  const { user, role, loading } = useAuth()
  if (loading) {
    return <div className="page-loading">Loading…</div>
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (role !== 'admin') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

export default function App(): React.ReactElement {
  return (
    <ToastProvider>
      <UpdateNotifier />
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="script/:slug" element={<ScriptDetailPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="legal/terms" element={<TermsOfServicePage />} />
            <Route path="legal/privacy" element={<PrivacyPolicyPage />} />
            <Route path="author/:authorId" element={<AuthorProfilePage />} />
            <Route path="author" element={<AuthorPage />} />
            <Route
              path="moderator"
              element={
                <ModeratorRoute>
                  <ModeratorPage />
                </ModeratorRoute>
              }
            />
            <Route
              path="admin"
              element={
                <AdminRoute>
                  <AdminPage />
                </AdminRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  )
}
