import { useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { APP_DISPLAY_NAME } from '../lib/appDisplayName'
import storeLibraryPreviewImageSrc from '../../../public/onboarding/store-library.png'

const ONBOARDING_DONE_KEY = 'umbrella_onboarding_v1_done'

type OnboardingStep = {
  title: string
  description: string
  extra?: string
}

const ONBOARDING_STEPS: ReadonlyArray<OnboardingStep> = [
  {
    title: `Welcome to ${APP_DISPLAY_NAME}`,
    description:
      'This app helps you browse scripts, install them quickly, and keep everything updated in one place.',
    extra: 'You can browse immediately, then sign in later only if you want to publish scripts.',
  },
  {
    title: 'Store and Library',
    description:
      'Use Store to discover and install scripts. Use Library to view installed scripts, manage versions, and maintain your local setup.',
    extra: 'You can switch between Deadlock and Dota 2 from the top bar at any time.',
  },
  {
    title: 'Set up Umbrella folder',
    description:
      'Choose your Umbrella folder so the app can find your scripts and launch the loader from the correct location.',
    extra: 'You can set this up now or skip and do it later in Settings.',
  },
]

export function hasCompletedOnboarding(): boolean {
  return localStorage.getItem(ONBOARDING_DONE_KEY) === '1'
}

export function markOnboardingCompleted(): void {
  localStorage.setItem(ONBOARDING_DONE_KEY, '1')
}

export function OnboardingPage(): ReactElement {
  const [stepIndex, setStepIndex] = useState(0)
  const [umbrellaRoot, setUmbrellaRoot] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedFolder, setSavedFolder] = useState<string | null>(null)
  const navigate = useNavigate()

  const step = ONBOARDING_STEPS[stepIndex]!
  const isFirstStep = stepIndex === 0
  const isLastStep = stepIndex === ONBOARDING_STEPS.length - 1
  async function pickFolder(): Promise<void> {
    setError(null)
    const picked = await window.umbrella.pickScriptsDirectory()
    if (picked) {
      setUmbrellaRoot(picked)
    }
  }

  async function saveFolder(): Promise<void> {
    const trimmed = umbrellaRoot.trim()
    if (!trimmed) {
      setError('Pick or enter an Umbrella folder path first.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await window.umbrella.setUmbrellaRoot(trimmed)
      if (!result.ok) {
        setError(result.error ?? 'Failed to save Umbrella folder.')
        return
      }
      setSavedFolder(trimmed)
      setError(null)
    } finally {
      setBusy(false)
    }
  }

  function finishOnboarding(): void {
    markOnboardingCompleted()
    navigate('/', { replace: true })
  }

  return (
    <div className="auth-shell-page">
      <div className="auth-shell-card">
        <div className="auth-shell-panel">
          <div className="auth-shell-inner">
            <header className="auth-shell-head">
              <h1 className="auth-shell-title">{step.title}</h1>
              <p className="auth-shell-hint">{step.description}</p>
              {stepIndex === 1 ? (
                <div className="onboarding-preview-frame">
                  <img
                    src={storeLibraryPreviewImageSrc}
                    alt="Store and Library sidebar preview"
                    className="onboarding-preview-image"
                  />
                </div>
              ) : null}
            </header>

            {isLastStep ? (
              <div className="auth-shell-form" aria-busy={busy}>
                <input
                  className="auth-lux-input"
                  value={umbrellaRoot}
                  onChange={(event) => setUmbrellaRoot(event.target.value)}
                  placeholder="C:\\Umbrella"
                  autoComplete="off"
                  spellCheck={false}
                />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn" onClick={() => void pickFolder()} disabled={busy}>
                    Browse…
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void saveFolder()}
                    disabled={busy}
                    style={{ marginLeft: 'auto' }}
                  >
                    {busy ? 'Saving…' : 'Save folder'}
                  </button>
                </div>
                {step.extra ? <p className="auth-shell-hint">{step.extra}</p> : null}
                <div
                  className="onboarding-progress-dots"
                  role="img"
                  aria-label={`Onboarding step ${stepIndex + 1} of ${ONBOARDING_STEPS.length}`}
                >
                  {ONBOARDING_STEPS.map((_, index) => (
                    <span
                      key={index}
                      className={`onboarding-progress-dot${index <= stepIndex ? ' is-active' : ''}`}
                      aria-hidden="true"
                    />
                  ))}
                </div>
                {savedFolder ? (
                  <p className="success feedback auth-shell-feedback" role="status">
                    Umbrella folder saved.
                  </p>
                ) : null}
                {error ? (
                  <p className="error feedback auth-shell-feedback" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            ) : null}

            {!isLastStep ? (
              <>
                {step.extra ? <p className="auth-shell-hint">{step.extra}</p> : null}
                <div
                  className="onboarding-progress-dots"
                  role="img"
                  aria-label={`Onboarding step ${stepIndex + 1} of ${ONBOARDING_STEPS.length}`}
                >
                  {ONBOARDING_STEPS.map((_, index) => (
                    <span
                      key={index}
                      className={`onboarding-progress-dot${index <= stepIndex ? ' is-active' : ''}`}
                      aria-hidden="true"
                    />
                  ))}
                </div>
              </>
            ) : null}

            <div className="onboarding-actions">
              <button
                type="button"
                className="btn"
                onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
                disabled={isFirstStep}
              >
                Back
              </button>
              {isLastStep ? (
                <>
                  <button type="button" className="btn" onClick={finishOnboarding}>
                    Set up later
                  </button>
                  <button type="button" className="btn btn-primary" onClick={finishOnboarding}>
                    Finish
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setStepIndex((current) => Math.min(ONBOARDING_STEPS.length - 1, current + 1))}
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
