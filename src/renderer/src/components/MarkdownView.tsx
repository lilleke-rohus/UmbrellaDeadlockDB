import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Props = {
  source: string | null | undefined
  className?: string
  empty?: string
}

export function MarkdownView({ source, className, empty }: Props): React.ReactElement {
  const text = source?.trim() ?? ''
  if (!text) {
    return <div className={className}>{empty ?? 'No content.'}</div>
  }
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  )
}
