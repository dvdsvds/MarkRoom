import { create } from 'zustand'

export interface CssSnippet {
  id: string
  name: string
  css: string
  enabled: boolean
}

/** 처음부터 들어 있는 예시. 꺼진 상태로 두고, 켜 보면서 쓰는 법을 알게 한다 */
export const DEFAULT_SNIPPETS: CssSnippet[] = [
  {
    id: 'example-preview-size',
    name: '예시: 미리보기 글자 크게',
    enabled: false,
    css: '/* 미리보기 본문만 글자를 키운다 */\n.prose-preview {\n  font-size: 1.12em;\n}\n'
  },
  {
    id: 'example-accent',
    name: '예시: 강조색 바꾸기',
    enabled: false,
    css: '/* 링크, 버튼, 선택 표시 색이 함께 바뀐다 */\n:root {\n  --color-accent: #8b5cf6;\n}\n'
  },
  {
    id: 'example-narrow',
    name: '예시: 본문 폭 좁게',
    enabled: false,
    css: '/* 미리보기 본문을 가운데 좁은 폭으로 둔다 */\n.prose-preview > * {\n  max-width: 720px;\n  margin-left: auto;\n  margin-right: auto;\n}\n'
  }
]

export const SNIPPET_HINT =
  '자주 쓰는 변수: --color-accent --color-text --color-bg --color-bg-soft --color-border · 미리보기는 .prose-preview, 에디터는 .cm-editor · 외부 CSS·웹 글꼴(@import, url)은 보안 설정 때문에 불러오지 않아요. 글꼴은 설정의 글꼴 항목이 먼저 적용돼서, 스니펫으로 바꾸려면 !important를 붙여요'

/** 편집 중인 스니펫을 저장 전에 화면에 미리 반영하기 위한 값 */
interface SnippetPreviewState {
  preview: { id: string; css: string } | null
  setPreview: (preview: { id: string; css: string } | null) => void
}

export const useSnippetPreview = create<SnippetPreviewState>((set) => ({
  preview: null,
  setPreview: (preview) => set({ preview })
}))
