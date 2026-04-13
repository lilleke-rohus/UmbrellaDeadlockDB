import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'info'
type Toast = { id: string; message: string; type: ToastType }

const ToastContext = createContext<{ addToast: (message: string, type?: ToastType) => void }>(
  null as never
)

export function ToastProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, message, type }])
    const delay = type === 'error' ? 5000 : 3000
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), delay)
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastList toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </ToastContext.Provider>
  )
}

export function useToast(): { addToast: (message: string, type?: ToastType) => void } {
  return useContext(ToastContext)
}

function ToastList({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }): React.ReactElement {
  if (!toasts.length) return <></>
  return (
    <div
      style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', borderRadius: 6, minWidth: 240, maxWidth: 380,
            background: t.type === 'error' ? 'var(--color-danger, #c0392b)' :
                        t.type === 'success' ? 'var(--color-success-bg, #1a3a1a)' :
                        'var(--color-surface-2, #2a2a2a)',
            border: '1px solid var(--color-border, #3a3a3a)',
            color: 'var(--color-text, #e0e0e0)',
            fontSize: 13,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          <span style={{ flex: 1 }}>{t.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 16, lineHeight: 1, padding: 0 }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
