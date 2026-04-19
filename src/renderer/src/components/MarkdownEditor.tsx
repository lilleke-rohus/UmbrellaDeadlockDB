import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  ListsToggle,
  CreateLink,
} from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'
import React from 'react'

type Props = {
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
  minHeight?: number
  className?: string
}

export function MarkdownEditor({ value, onChange, placeholder, minHeight, className }: Props): React.ReactElement {
  return (
    <div className={className} style={{ minHeight: minHeight ?? 120 }}>
      <MDXEditor
        markdown={value}
        onChange={onChange}
        placeholder={placeholder}
        contentEditableClassName="md-editor-content"
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          linkPlugin(),
          linkDialogPlugin(),
          markdownShortcutPlugin(),
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <UndoRedo />
                <BoldItalicUnderlineToggles />
                <BlockTypeSelect />
                <ListsToggle />
                <CreateLink />
              </>
            ),
          }),
        ]}
      />
    </div>
  )
}
