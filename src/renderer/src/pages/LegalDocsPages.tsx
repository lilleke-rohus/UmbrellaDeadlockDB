import { Link } from 'react-router-dom'

function LegalBackLink(): React.ReactElement {
  return (
    <p className="muted small" style={{ marginBottom: 20 }}>
      <Link to="/settings">← Back to settings</Link>
    </p>
  )
}

function Prose({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div
      className="setting-desc"
      style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560, lineHeight: 1.55 }}
    >
      {children}
    </div>
  )
}

export function TermsOfServicePage(): React.ReactElement {
  return (
    <div className="page settings-page">
      <LegalBackLink />
      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 14, color: 'var(--color-text-primary)' }}>
        Terms of Service
      </h2>
      <Prose>
        <p>
          By using this application, you agree to use it only for lawful purposes and in line with any applicable
          platform rules. The software and catalog content are provided &quot;as is&quot; without warranties of any
          kind.
        </p>
        <p>
          Authors are responsible for what they publish. We may remove or restrict access to content or accounts that
          violate these terms or create risk for users or the service.
        </p>
        <p>
          We may update these terms from time to time. Continued use after changes means you accept the updated terms.
        </p>
      </Prose>
    </div>
  )
}

export function PrivacyPolicyPage(): React.ReactElement {
  return (
    <div className="page settings-page">
      <LegalBackLink />
      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 14, color: 'var(--color-text-primary)' }}>
        Privacy Policy
      </h2>
      <Prose>
        <p>
          This app may process account information (such as email and display name) only when you sign in, as well as technical data
          needed to run the app (for example errors, update checks, and local cache metadata). We use this information
          to operate the store, sync the catalog, and improve reliability. None of this information is shared with third parties or used for advertising.
          The types of information collected and used include activity data such as script installs, general usage metrics (for example, how many users there are, how many users are currently online), and other analytics to help improve the project.
     
        </p>
        <p>
          Email addresses are only used for account creation, verification, and password resetting.
        </p>
        <p>
          Script files you install are stored locally on your device in the folder you choose in Settings. We do not
          claim ownership of your scripts.
        </p>
        <p>
          If you have questions about data handling, contact the operator of the service. 
        </p>
      </Prose>
    </div>
  )
}
