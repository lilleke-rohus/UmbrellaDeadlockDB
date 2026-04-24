import React, { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { APP_AUTH_PROTOCOL_SCHEME } from '../../../shared/authDeepLink'

type Props = {
  source: string | null | undefined
  className?: string
  empty?: string
}

function isSafeMarkdownHref(href: string): boolean {
  const trimmed = href.trim()
  const lower = trimmed.toLowerCase()
  if (lower.startsWith('javascript:') || lower.startsWith('data:')) return false
  try {
    const u = new URL(trimmed)
    const p = u.protocol.toLowerCase()
    return (
      p === 'http:' ||
      p === 'https:' ||
      p === 'mailto:' ||
      p === `${APP_AUTH_PROTOCOL_SCHEME}:`
    )
  } catch {
    return false
  }
}

export function MarkdownView({ source, className, empty }: Props): React.ReactElement {
  const text = source?.trim() ?? ''

  const components = useMemo<Partial<Components>>(
    () => ({
      a: ({ href, children, className: linkClass }) => {
        if (!href?.trim()) {
          return <span className={linkClass}>{children}</span>
        }
        const normalized = href.trim()
        if (!isSafeMarkdownHref(normalized)) {
          return <span className={linkClass}>{children}</span>
        }
        return (
          <a
            href={normalized}
            className={linkClass}
            rel="noopener noreferrer"
            onClick={(e) => {
              e.preventDefault()
              void window.umbrella.openExternalUrl(normalized).then((res) => {
                if (!res.ok && res.error) {
                  console.warn('[MarkdownView] openExternalUrl:', res.error)
                }
              })
            }}
          >
            {children}
          </a>
        )
      },
    }),
    [],
  )

  if (!text) {
    return <div className={className}>{empty ?? 'No content.'}</div>
  }
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  )
}
