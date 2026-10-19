import { useRef, useState } from 'react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useToastStore } from '../../stores/toastStore'
import { SNIPPET_HINT, useSnippetPreview, type CssSnippet } from '../../utils/cssSnippets'
import {
  CancelButton,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  MainButton
} from '../../components/DialogParts'
import { Toggle } from './SettingsParts'
import RenameIcon from '../../icons/ctx-rename.svg?react'

const FIELD =
  'w-full rounded-lg bg-text/[0.07] px-2.5 text-[13px] text-text outline-none transition-shadow focus:ring-1 focus:ring-accent/60'

const LINK_BTN = 'text-[12.5px] text-text-tertiary outline-none transition-colors hover:text-accent'

function SnippetEditDialog({
  snippet,
  isNew,
  onSave,
  onCancel
}: {
  snippet: CssSnippet
  isNew: boolean
  onSave: (snippet: CssSnippet) => void
  onCancel: () => void
}): React.JSX.Element {
  const [name, setName] = useState(snippet.name)
  const [css, setCss] = useState(snippet.css)
  const setPreview = useSnippetPreview((s) => s.setPreview)

  const close = (): void => {
    setPreview(null)
    onCancel()
  }

  return (
    <Dialog width={600} onClose={close}>
      <DialogHeader
        icon={<RenameIcon width={18} height={18} />}
        title={isNew ? '새 CSS 스니펫' : 'CSS 스니펫 편집'}
        subtitle="입력하는 동안 화면에 바로 반영돼요. 취소하면 원래대로 돌아가요"
      />
      <DialogBody>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="스니펫 이름"
          autoFocus={isNew}
          className={`${FIELD} h-8`}
        />
        <textarea
          value={css}
          onChange={(e) => {
            setCss(e.target.value)
            setPreview({ id: snippet.id, css: e.target.value })
          }}
          onKeyDown={(e) => e.stopPropagation()}
          spellCheck={false}
          placeholder=".prose-preview { font-size: 1.1em; }"
          className={`${FIELD} mt-2.5 h-72 resize-none py-2 font-[family-name:var(--font-editor)] leading-relaxed`}
        />
        <p className="mt-2 text-[11.5px] leading-relaxed text-text-tertiary">{SNIPPET_HINT}</p>
      </DialogBody>
      <DialogFooter>
        <CancelButton onClick={close} />
        <MainButton
          disabled={!name.trim()}
          onClick={() => {
            setPreview(null)
            onSave({ ...snippet, name: name.trim(), css })
          }}
        >
          저장
        </MainButton>
      </DialogFooter>
    </Dialog>
  )
}

export function SnippetSetting(): React.JSX.Element {
  const snippets = useSettingsStore((s) => s.snippets)
  const saveSnippet = useSettingsStore((s) => s.saveSnippet)
  const deleteSnippet = useSettingsStore((s) => s.deleteSnippet)
  const toggleSnippet = useSettingsStore((s) => s.toggleSnippet)
  const pushToast = useToastStore((s) => s.push)
  const [editing, setEditing] = useState<{ snippet: CssSnippet; isNew: boolean } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const importFile = async (file: File): Promise<void> => {
    const css = await file.text()
    saveSnippet({
      id: crypto.randomUUID(),
      name: file.name.replace(/\.css$/i, ''),
      css,
      enabled: true
    })
    pushToast({ kind: 'info', message: `'${file.name}'을(를) 스니펫으로 가져왔어요.` })
  }

  return (
    <div className="divide-y divide-border">
      {snippets.map((s) => (
        <div key={s.id} className="flex min-h-11 items-center gap-3 px-3.5 py-1.5 text-[13.5px]">
          <Toggle checked={s.enabled} onChange={() => toggleSnippet(s.id)} />
          <span
            className={`min-w-0 flex-1 truncate ${s.enabled ? 'text-text' : 'text-text-tertiary'}`}
          >
            {s.name}
          </span>
          {confirmDelete === s.id ? (
            <>
              <button
                type="button"
                onClick={() => {
                  deleteSnippet(s.id)
                  setConfirmDelete(null)
                }}
                className="text-[12.5px] text-danger outline-none"
              >
                삭제
              </button>
              <button type="button" onClick={() => setConfirmDelete(null)} className={LINK_BTN}>
                취소
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing({ snippet: s, isNew: false })}
                className={LINK_BTN}
              >
                편집
              </button>
              <button type="button" onClick={() => setConfirmDelete(s.id)} className={LINK_BTN}>
                삭제
              </button>
            </>
          )}
        </div>
      ))}
      <div className="flex items-center gap-4 px-3.5 py-2.5">
        <button
          type="button"
          onClick={() =>
            setEditing({
              snippet: { id: crypto.randomUUID(), name: '', css: '', enabled: true },
              isNew: true
            })
          }
          className={LINK_BTN}
        >
          + 스니펫 추가
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className={LINK_BTN}>
          파일에서 가져오기
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".css,text/css"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void importFile(file)
          }}
        />
      </div>
      {editing && (
        <SnippetEditDialog
          snippet={editing.snippet}
          isNew={editing.isNew}
          onSave={(s) => {
            saveSnippet(s)
            setEditing(null)
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  )
}
