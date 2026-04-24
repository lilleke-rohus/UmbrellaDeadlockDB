import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { Layout } from './components/Layout'
import { UpdateNotifier } from './components/UpdateNotifier'
import { HomePage } from './pages/HomePage.tsx'
import { ScriptDetailPage } from './pages/ScriptDetailPage.tsx'
import { SettingsPage } from './pages/SettingsPage.tsx'
import { AuthRecoveryWatcher } from './components/AuthRecoveryWatcher'
import { LoginPage } from './pages/LoginPage.tsx'
import { ResetPasswordPage } from './pages/ResetPasswordPage.tsx'
import { AuthorPage } from './pages/AuthorPage.tsx'
import { AuthorProfilePage } from './pages/AuthorProfilePage.tsx'
import { AdminPage } from './pages/AdminPage.tsx'
import { PrivacyPolicyPage, TermsOfServicePage } from './pages/LegalDocsPages.tsx'
import { hasCompletedOnboarding, OnboardingPage } from './pages/OnboardingPage'

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

function OnboardingProtectedRoute({ children }: { children: ReactNode }): React.ReactElement {
  if (!hasCompletedOnboarding()) {
    return <Navigate to="/onboarding" replace />
  }
  return <>{children}</>
}

function OnboardingRoute(): React.ReactElement {
  if (hasCompletedOnboarding()) {
    return <Navigate to="/" replace />
  }
  return <OnboardingPage />
}

export default function App(): React.ReactElement {
  return (
    <ToastProvider>
      <UpdateNotifier />
      <AuthProvider>
        <AuthRecoveryWatcher />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/onboarding" element={<OnboardingRoute />} />
          <Route element={<Layout />}>
            <Route
              index
              element={
                <OnboardingProtectedRoute>
                  <HomePage />
                </OnboardingProtectedRoute>
              }
            />
            <Route
              path="script/:slug"
              element={
                <OnboardingProtectedRoute>
                  <ScriptDetailPage />
                </OnboardingProtectedRoute>
              }
            />
            <Route
              path="settings"
              element={
                <OnboardingProtectedRoute>
                  <SettingsPage />
                </OnboardingProtectedRoute>
              }
            />
            <Route
              path="legal/terms"
              element={
                <OnboardingProtectedRoute>
                  <TermsOfServicePage />
                </OnboardingProtectedRoute>
              }
            />
            <Route
              path="legal/privacy"
              element={
                <OnboardingProtectedRoute>
                  <PrivacyPolicyPage />
                </OnboardingProtectedRoute>
              }
            />
            <Route
              path="author/:authorId"
              element={
                <OnboardingProtectedRoute>
                  <AuthorProfilePage />
                </OnboardingProtectedRoute>
              }
            />
            <Route
              path="author"
              element={
                <OnboardingProtectedRoute>
                  <AuthorPage />
                </OnboardingProtectedRoute>
              }
            />
            <Route
              path="admin"
              element={
                <OnboardingProtectedRoute>
                  <AdminRoute>
                    <AdminPage />
                  </AdminRoute>
                </OnboardingProtectedRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  )
}
