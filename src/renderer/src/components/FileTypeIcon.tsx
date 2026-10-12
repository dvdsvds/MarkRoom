import FolderSvg from '../icons/folder.svg?react'
import MdSvg from '../icons/file-md.svg?react'
import CsvSvg from '../icons/file-csv.svg?react'
import PdfSvg from '../icons/file-pdf.svg?react'
import ImgSvg from '../icons/file-img.svg?react'
import DocSvg from '../icons/file.svg?react'

type IconType = 'folder' | 'sys' | 'md' | 'csv' | 'pdf' | 'img' | 'doc'

const SYSTEM_FOLDERS = new Set(['img', 'files'])

function typeOf(name: string, kind: 'file' | 'folder'): IconType {
  if (kind === 'folder') return SYSTEM_FOLDERS.has(name) ? 'sys' : 'folder'
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
  switch (ext) {
    case '':
    case 'md':
    case 'markdown':
      return 'md'
    case 'csv':
    case 'tsv':
    case 'xlsx':
      return 'csv'
    case 'pdf':
      return 'pdf'
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'svg':
      return 'img'
    default:
      return 'doc'
  }
}

const SVGS = {
  folder: FolderSvg,
  sys: FolderSvg,
  md: MdSvg,
  csv: CsvSvg,
  pdf: PdfSvg,
  img: ImgSvg,
  doc: DocSvg
}

/** 사이드바 트리용 파일 종류 아이콘. 색은 theme.css의 --icon-* 변수를 따른다. */
export function FileTypeIcon({
  name,
  kind,
  size = 18
}: {
  name: string
  kind: 'file' | 'folder'
  size?: number
}): React.JSX.Element {
  const type = typeOf(name, kind)
  const Svg = SVGS[type]
  return (
    <span className="flex shrink-0" style={{ color: `var(--icon-${type})` }} aria-hidden="true">
      <Svg width={size} height={size} style={{ display: 'block' }} />
    </span>
  )
}

/** 사이드바 파일 이름 뒤에 붙는 확장자. 점은 흐리게, 글자는 종류별 색으로 보여준다. */
export function FileExt({ name, ext }: { name: string; ext: string }): React.JSX.Element {
  const type = typeOf(name, 'file')
  return (
    <>
      <span className="text-text-tertiary">.</span>
      <span className="font-medium" style={{ color: `var(--icon-${type})` }}>
        {ext.slice(1)}
      </span>
    </>
  )
}