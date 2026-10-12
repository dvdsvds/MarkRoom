import { EditorView, runScopeHandlers, type Panel, type ViewUpdate } from '@codemirror/view'
import type { EditorState } from '@codemirror/state'
import {
  SearchQuery,
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  replaceAll,
  replaceNext,
  setSearchQuery
} from '@codemirror/search'
import caseIcon from '../icons/tb-find-case.svg?raw'
import regexIcon from '../icons/tb-find-regex.svg?raw'
import wordIcon from '../icons/tb-find-word.svg?raw'
import upIcon from '../icons/tb-arrow-up.svg?raw'
import downIcon from '../icons/tb-arrow-down.svg?raw'
import chevronDownIcon from '../icons/tb-chevron-down.svg?raw'
import rightIcon from '../icons/tb-chevron-right.svg?raw'
import replaceOneIcon from '../icons/tb-replace-one.svg?raw'
import replaceAllIcon from '../icons/tb-replace-all.svg?raw'
import closeIcon from '../icons/tb-close.svg?raw'

const COUNT_LIMIT = 1000

/** 지금 선택된 일치 위치(index)와 전체 개수(total)를 센다. 1000개를 넘으면 거기서 멈춘다. */
function countMatches(state: EditorState, query: SearchQuery): { index: number; total: number } {
  if (!query.valid) return { index: 0, total: 0 }
  const sel = state.selection.main
  const cursor = query.getCursor(state)
  let total = 0
  let exact = 0
  let after = 0
  for (let r = cursor.next(); !r.done && total < COUNT_LIMIT; r = cursor.next()) {
    total++
    if (!exact && r.value.from === sel.from && r.value.to === sel.to) exact = total
    if (!after && r.value.from >= sel.from) after = total
  }
  return { index: exact || after, total }
}

function iconButton(className: string, html: string, title: string): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = className
  b.title = title
  b.innerHTML = html.trim()
  return b
}

/** 에디터 오른쪽 위에 뜨는 찾기/바꾸기 카드. 모양은 main.css의 .md-find가 정한다. */
export function createFindPanel(view: EditorView): Panel {
  let query = getSearchQuery(view.state)

  const dom = document.createElement('div')
  dom.className = 'md-find'

  const expand = iconButton('md-find-btn md-find-expand', rightIcon, '바꾸기 펼치기')
  const searchField = document.createElement('input')
  searchField.type = 'text'
  searchField.placeholder = '찾기'
  searchField.setAttribute('main-field', 'true')
  searchField.setAttribute('aria-label', '찾기')
  searchField.spellcheck = false

  const caseBtn = iconButton('md-find-toggle', caseIcon, '대소문자 구분')
  const regexBtn = iconButton('md-find-toggle', regexIcon, '정규식')
  const wordBtn = iconButton('md-find-toggle', wordIcon, '단어 단위')
  const count = document.createElement('span')
  count.className = 'md-find-count'
  const prevBtn = iconButton('md-find-btn', upIcon, '이전 결과 (Shift+Enter)')
  const nextBtn = iconButton('md-find-btn', downIcon, '다음 결과 (Enter)')
  const closeBtn = iconButton('md-find-btn', closeIcon, '닫기 (Esc)')

  const searchBox = document.createElement('div')
  searchBox.className = 'md-find-field'
  searchBox.append(searchField, caseBtn, regexBtn, wordBtn)

  const aside1 = document.createElement('div')
  aside1.className = 'md-find-aside'
  aside1.append(count, prevBtn, nextBtn, closeBtn)

  const row1 = document.createElement('div')
  row1.className = 'md-find-row'
  row1.append(searchBox, aside1)

  const replaceField = document.createElement('input')
  replaceField.type = 'text'
  replaceField.placeholder = '바꿀 내용'
  replaceField.setAttribute('aria-label', '바꿀 내용')
  replaceField.spellcheck = false
  const replaceBox = document.createElement('div')
  replaceBox.className = 'md-find-field'
  replaceBox.append(replaceField)
  const replaceOneBtn = iconButton('md-find-btn', replaceOneIcon, '바꾸기 (Enter)')
  const replaceAllBtn = iconButton('md-find-btn', replaceAllIcon, '모두 바꾸기 (Ctrl+Alt+Enter)')
  const aside2 = document.createElement('div')
  aside2.className = 'md-find-aside'
  aside2.append(replaceOneBtn, replaceAllBtn)

  const row2 = document.createElement('div')
  row2.className = 'md-find-row md-find-replace-row'
  row2.append(replaceBox, aside2)

  const col = document.createElement('div')
  col.className = 'md-find-col'
  col.append(row1, row2)

  dom.append(expand, col)

  const setOpen = (open: boolean): void => {
    dom.classList.toggle('open', open)
    expand.innerHTML = (open ? chevronDownIcon : rightIcon).trim()
    expand.title = open ? '바꾸기 접기' : '바꾸기 펼치기'
  }

  const refreshCount = (): void => {
    const { index, total } = countMatches(view.state, query)
    const empty = query.search !== '' && total === 0
    count.classList.toggle('empty', empty)
    if (query.search === '') count.textContent = ''
    else if (empty) count.textContent = '결과 없음'
    else count.textContent = `${index}/${total >= COUNT_LIMIT ? `${COUNT_LIMIT}+` : total}`
    replaceOneBtn.classList.toggle('off', total === 0)
    replaceAllBtn.classList.toggle('off', total === 0)
  }

  const syncFields = (q: SearchQuery): void => {
    if (searchField.value !== q.search) searchField.value = q.search
    if (replaceField.value !== q.replace) replaceField.value = q.replace
    caseBtn.classList.toggle('on', q.caseSensitive)
    regexBtn.classList.toggle('on', q.regexp)
    wordBtn.classList.toggle('on', q.wholeWord)
  }

  /** 입력한 글자 쪽으로 가장 가까운 일치로 바로 이동한다. 못 찾으면 문서 처음부터 다시 찾는다. */
  const jumpToNearest = (): void => {
    if (!query.valid) return
    const from = view.state.selection.main.from
    let r = query.getCursor(view.state, from).next()
    if (r.done) r = query.getCursor(view.state).next()
    if (r.done) return
    view.dispatch({
      selection: { anchor: r.value.from, head: r.value.to },
      effects: EditorView.scrollIntoView(r.value.from, { y: 'nearest', yMargin: 60 }),
      userEvent: 'select.search'
    })
  }

  const commit = (jump: boolean): void => {
    const next = new SearchQuery({
      search: searchField.value,
      caseSensitive: caseBtn.classList.contains('on'),
      regexp: regexBtn.classList.contains('on'),
      wholeWord: wordBtn.classList.contains('on'),
      replace: replaceField.value
    })
    if (!next.eq(query)) {
      query = next
      view.dispatch({ effects: setSearchQuery.of(query) })
    }
    if (jump) jumpToNearest()
    refreshCount()
  }

  searchField.addEventListener('input', () => commit(true))
  replaceField.addEventListener('input', () => commit(false))
  for (const t of [caseBtn, regexBtn, wordBtn]) {
    t.addEventListener('click', () => {
      t.classList.toggle('on')
      commit(true)
    })
  }
  nextBtn.addEventListener('click', () => findNext(view))
  prevBtn.addEventListener('click', () => findPrevious(view))
  replaceOneBtn.addEventListener('click', () => {
    if (!replaceOneBtn.classList.contains('off')) replaceNext(view)
  })
  replaceAllBtn.addEventListener('click', () => {
    if (!replaceAllBtn.classList.contains('off')) replaceAll(view)
  })
  expand.addEventListener('click', () => setOpen(!dom.classList.contains('open')))
  /** 사라지는 애니메이션이 끝난 뒤에 패널을 닫는다. */
  let closing = false
  const closePanel = (): void => {
    if (closing) return
    closing = true
    dom.classList.add('closing')
    window.setTimeout(() => {
      closeSearchPanel(view)
      view.focus()
    }, 120)
  }
  closeBtn.addEventListener('click', closePanel)

  dom.addEventListener('mousedown', (e) => {
    if (!(e.target instanceof HTMLInputElement)) e.preventDefault()
  })
  dom.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      closePanel()
      return
    }
    if (runScopeHandlers(view, e, 'search-panel')) {
      e.preventDefault()
      return
    }
    if (e.key !== 'Enter' || e.isComposing) return
    e.preventDefault()
    if (e.target === replaceField) {
      if (e.altKey && (e.ctrlKey || e.metaKey)) replaceAll(view)
      else replaceNext(view)
    } else if (e.shiftKey) findPrevious(view)
    else findNext(view)
  })

  syncFields(query)
  setOpen(query.replace !== '')
  refreshCount()

  return {
    dom,
    top: true,
    mount() {
      searchField.focus()
      searchField.select()
    },
    update(u: ViewUpdate) {
      for (const tr of u.transactions) {
        for (const e of tr.effects) {
          if (e.is(setSearchQuery) && !e.value.eq(query)) {
            query = e.value
            syncFields(query)
          }
        }
      }
      if (u.docChanged || u.selectionSet || u.transactions.some((tr) => tr.effects.length > 0)) {
        refreshCount()
      }
    }
  }
}