const RECOVERY_REQUIRED_KEY = 'auth:password-recovery-required'
const RECOVERY_ENFORCED_KEY = 'auth:password-recovery-enforced'

export function markPasswordRecoveryRequired(): void {
  window.sessionStorage.setItem(RECOVERY_REQUIRED_KEY, '1')
  window.sessionStorage.removeItem(RECOVERY_ENFORCED_KEY)
}

export function clearPasswordRecoveryRequired(): void {
  window.sessionStorage.removeItem(RECOVERY_REQUIRED_KEY)
  window.sessionStorage.removeItem(RECOVERY_ENFORCED_KEY)
}

export function isPasswordRecoveryRequired(): boolean {
  return window.sessionStorage.getItem(RECOVERY_REQUIRED_KEY) === '1'
}

export function markPasswordRecoveryEnforced(): void {
  window.sessionStorage.setItem(RECOVERY_ENFORCED_KEY, '1')
}

export function isPasswordRecoveryEnforced(): boolean {
  return window.sessionStorage.getItem(RECOVERY_ENFORCED_KEY) === '1'
}
