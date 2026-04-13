import { useEffect, useState, type Dispatch, type ReactElement, type SetStateAction } from 'react'
import type { AppUpdateInfo, AppUpdateProgress } from '../../../shared/ipc'

type UpdateState =
  | { phase: 'idle' }
  | { phase: 'available'; info: AppUpdateInfo }
  | { phase: 'downloading'; info: AppUpdateInfo; progress: AppUpdateProgress }
  | { phase: 'ready'; info: AppUpdateInfo }
  | { phase: 'error'; message: string }

type VisibleUpdateState = Exclude<UpdateState, { phase: 'idle' }>

const COLORS = {
  accent: '#3b82f6',
  success: '#4ade80',
  danger: '#f87171',
} as const

const FALLBACK_VERSION_INFO: AppUpdateInfo = { version: '' }

export function UpdateNotifier(): ReactElement | null {
  const [state, setState] = useState<UpdateState>({ phase: 'idle' })
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => subscribeAppUpdateEvents(setState, setDismissed), [])

  if (dismissed || state.phase === 'idle') return null

  return (
    <div style={styles.banner} role="status" aria-live="polite">
      <UpdateBannerView state={state} onDismiss={() => setDismissed(true)} />
    </div>
  )
}

function subscribeAppUpdateEvents(
  setState: Dispatch<SetStateAction<UpdateState>>,
  setDismissed: Dispatch<SetStateAction<boolean>>,
): () => void {
  const unsubs = [
    window.umbrella.onAppUpdateAvailable((info) => {
      setState({ phase: 'available', info })
      setDismissed(false)
    }),
    window.umbrella.onAppUpdateDownloadProgress((progress) => {
      setState((prev) => withDownloadProgress(prev, progress))
    }),
    window.umbrella.onAppUpdateDownloaded((info) => {
      setState({ phase: 'ready', info })
    }),
    window.umbrella.onAppUpdateError((message) => {
      setState({ phase: 'error', message })
    }),
  ]
  return () => unsubs.forEach((u) => u())
}

function withDownloadProgress(prev: UpdateState, progress: AppUpdateProgress): UpdateState {
  return { phase: 'downloading', info: updateInfoForProgress(prev), progress }
}

function updateInfoForProgress(prev: UpdateState): AppUpdateInfo {
  if (prev.phase === 'available' || prev.phase === 'downloading') return prev.info
  return FALLBACK_VERSION_INFO
}

function UpdateBannerView({
  state,
  onDismiss,
}: {
  state: VisibleUpdateState
  onDismiss: () => void
}): ReactElement {
  switch (state.phase) {
    case 'available':
      return <AvailableBanner info={state.info} onDismiss={onDismiss} />
    case 'downloading':
      return <DownloadingBanner info={state.info} progress={state.progress} />
    case 'ready':
      return <ReadyBanner info={state.info} onDismiss={onDismiss} />
    case 'error':
      return <ErrorBanner message={state.message} onDismiss={onDismiss} />
  }
}

function AvailableBanner({ info, onDismiss }: { info: AppUpdateInfo; onDismiss: () => void }): ReactElement {
  return (
    <>
      <StatusDot color={COLORS.accent} />
      <span style={styles.text}>
        Update is available (<strong>v{info.version}</strong>)
      </span>
      <button type="button" style={styles.btnPrimary} onClick={() => void window.umbrella.downloadAppUpdate()}>
        Update now
      </button>
      <DismissButton onClick={onDismiss} />
    </>
  )
}

function DownloadingBanner({
  info,
  progress,
}: {
  info: AppUpdateInfo
  progress: AppUpdateProgress
}): ReactElement {
  const pct = Math.round(progress.percent)
  return (
    <>
      <StatusDot color={COLORS.accent} />
      <span style={styles.text}>Downloading v{info.version}…</span>
      <div style={styles.progressTrack} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ ...styles.progressFill, width: `${pct}%` }} />
      </div>
      <span style={styles.pct}>{pct}%</span>
    </>
  )
}

function ReadyBanner({ info, onDismiss }: { info: AppUpdateInfo; onDismiss: () => void }): ReactElement {
  return (
    <>
      <StatusDot color={COLORS.success} />
      <span style={styles.text}>
        <strong>v{info.version}</strong> ready — restart to install
      </span>
      <button type="button" style={styles.btnPrimary} onClick={() => void window.umbrella.installUpdate()}>
        Restart now
      </button>
      <DismissButton onClick={onDismiss} />
    </>
  )
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }): ReactElement {
  return (
    <>
      <StatusDot color={COLORS.danger} />
      <span style={{ ...styles.text, color: COLORS.danger }}>Update failed: {message}</span>
      <DismissButton onClick={onDismiss} />
    </>
  )
}

function StatusDot({ color }: { color: string }): ReactElement {
  return <span style={{ ...styles.dot, background: color }} aria-hidden />
}

function DismissButton({ onClick }: { onClick: () => void }): ReactElement {
  return (
    <button type="button" onClick={onClick} style={styles.dismiss} aria-label="Dismiss">
      ×
    </button>
  )
}

const styles = {
  banner: {
    position: 'fixed' as const,
    bottom: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10000,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px',
    borderRadius: 8,
    background: 'var(--color-background-primary, #30302e)',
    border: '1px solid var(--color-border-secondary, #3c3b38)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    fontSize: 13,
    color: 'var(--color-text-primary, #faf9f5)',
    minWidth: 280,
    maxWidth: 520,
    flexWrap: 'wrap' as const,
    whiteSpace: 'normal' as const,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: COLORS.accent,
    flexShrink: 0,
  },
  text: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  progressTrack: {
    width: 80,
    height: 4,
    borderRadius: 2,
    background: 'var(--color-border-secondary, #3c3b38)',
    overflow: 'hidden',
    flexShrink: 0,
  },
  progressFill: {
    height: '100%',
    background: COLORS.accent,
    borderRadius: 2,
    transition: 'width 0.2s ease',
  },
  pct: {
    fontSize: 11,
    color: 'var(--color-text-secondary, #a09f97)',
    width: 32,
    textAlign: 'right' as const,
  },
  btnPrimary: {
    padding: '4px 12px',
    borderRadius: 5,
    border: 'none',
    background: COLORS.accent,
    color: '#fff',
    fontSize: 12,
    cursor: 'pointer',
    fontWeight: 600,
    flexShrink: 0,
  },
  dismiss: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--color-text-secondary, #a09f97)',
    fontSize: 16,
    lineHeight: 1,
    padding: 0,
    flexShrink: 0,
  },
} as const
