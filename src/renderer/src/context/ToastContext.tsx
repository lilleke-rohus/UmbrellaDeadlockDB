import { createContext, useCallback, useContext, useMemo, useState, type CSSProperties, type ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'info'
type Toast = { id: string; message: string; type: ToastType }
type AddToast = (message: string, type?: ToastType) => void
type ToastContextValue = { addToast: AddToast }

const ToastContext = createContext<ToastContextValue | null>(null)
const ERROR_TOAST_DURATION_MS = 5_000
const DEFAULT_TOAST_DURATION_MS = 3_000

const listStyle: CSSProperties = {
  position: 'fixed',
  bottom: 20,
  right: 20,
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const toastStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 14px',
  borderRadius: 6,
  minWidth: 240,
  maxWidth: 380,
  border: '1px solid var(--color-border, #3a3a3a)',
  color: 'var(--color-text, #e0e0e0)',
  fontSize: 13,
  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
}

const dismissButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'inherit',
  fontSize: 16,
  lineHeight: 1,
  padding: 0,
}

function createToastId(): string {
  return Math.random().toString(36).slice(2)
}

function getToastDurationMs(type: ToastType): number {
  return type === 'error' ? ERROR_TOAST_DURATION_MS : DEFAULT_TOAST_DURATION_MS
}

function getToastBackground(type: ToastType): string {
  if (type === 'error') return 'var(--color-danger, #c0392b)'
  if (type === 'success') return 'var(--color-success-bg, #1a3a1a)'
  return 'var(--color-surface-2, #2a2a2a)'
}

export function ToastProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = createToastId()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => dismissToast(id), getToastDurationMs(type))
  }, [dismissToast])

  const value = useMemo<ToastContextValue>(() => ({ addToast }), [addToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastList toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (context === null) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

function ToastList({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }): React.ReactElement {
  if (!toasts.length) return <></>
  return (
    <div style={listStyle} role="status" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            ...toastStyle,
            background: getToastBackground(t.type),
          }}
        >
          <span style={{ flex: 1 }}>{t.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss"
            style={dismissButtonStyle}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
