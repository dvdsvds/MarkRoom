export const KO_FONTS: Record<string, string[]> = {
  '맑은 고딕': ['Malgun Gothic'],
  '바탕': ['Batang', 'BatangChe'],
  '돋움': ['Dotum', 'DotumChe'],
  '굴림': ['Gulim', 'GulimChe'],
  '궁서': ['Gungsuh', 'GungsuhChe'],
  '함초롬바탕': ['HCR Batang', 'HCR Batang LVT'],
  '함초롬돋움': ['HCR Dotum', 'HCR Dotum LVT'],
  '나눔고딕': ['NanumGothic', 'Nanum Gothic'],
  '나눔명조': ['NanumMyeongjo', 'Nanum Myeongjo']
}

const FALLBACK = [
  ...Object.keys(KO_FONTS),
  '휴먼명조',
  'Pretendard',
  'Arial',
  'Times New Roman',
  'Consolas'
]

type LocalFont = { family: string }

let cache: string[] | null = null
let pending: Promise<string[]> | null = null

const isHangul = (s: string): boolean => /^[\u3131-\u318e\uac00-\ud7a3]/.test(s)

const ENG_TO_KO = new Map<string, string>()
for (const [ko, engs] of Object.entries(KO_FONTS)) {
  for (const e of engs) ENG_TO_KO.set(e.toLowerCase(), ko)
}

/** 한글 이름이 먼저(가나다), 그다음 영문(ABC). */
function sortFonts(list: string[]): string[] {
  return [...list].sort((a, b) => {
    const ha = isHangul(a)
    const hb = isHangul(b)
    if (ha !== hb) return ha ? -1 : 1
    return a.localeCompare(b, ha ? 'ko' : 'en')
  })
}

/** 시스템 영문 이름은 한글 이름으로 바꿔서 보여 준다. 한글 이름이 이미 있으면 중복은 하나만 남긴다. */
function toDisplay(list: string[]): string[] {
  const set = new Set<string>()
  for (const name of list) set.add(ENG_TO_KO.get(name.toLowerCase()) ?? name)
  return sortFonts([...set])
}

/** 그릴 때 쓸 CSS font-family 후보. 한글 이름과 영문 이름을 모두 넘긴다. */
export function fontCandidates(name: string): string[] {
  const clean = name.replace(/["\\]/g, '').trim()
  if (clean === '') return []
  const out: string[] = [clean]
  const ko = KO_FONTS[clean] ?? (ENG_TO_KO.has(clean.toLowerCase()) ? KO_FONTS[ENG_TO_KO.get(clean.toLowerCase()) as string] : undefined)
  if (KO_FONTS[clean]) out.push(...KO_FONTS[clean])
  else if (ko) out.push(...ko)
  return [...new Set(out)]
}

export function loadSystemFonts(): Promise<string[]> {
  if (cache) return Promise.resolve(cache)
  if (pending) return pending
  const query = (window as unknown as { queryLocalFonts?: () => Promise<LocalFont[]> }).queryLocalFonts
  if (typeof query !== 'function') return Promise.resolve(toDisplay(FALLBACK))
  pending = query
    .call(window)
    .then((list) => {
      const set = new Set<string>()
      for (const f of list) if (f.family) set.add(f.family)
      const arr = toDisplay([...set])
      pending = null
      if (arr.length === 0) return toDisplay(FALLBACK)
      cache = arr
      return arr
    })
    .catch(() => {
      pending = null
      return toDisplay(FALLBACK)
    })
  return pending
}