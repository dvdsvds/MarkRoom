import { fileKindOf } from '@renderer/utils/fileKind'
import { splitName } from '@renderer/utils/path'
import FolderSvg from '../icons/folder.svg?react'
import FolderOpenSvg from '../icons/folder-open.svg?react'
import MdSvg from '../icons/file-md.svg?react'
import CsvSvg from '../icons/file-csv.svg?react'
import PdfSvg from '../icons/file-pdf.svg?react'
import ImgSvg from '../icons/file-img.svg?react'
import DocSvg from '../icons/file.svg?react'

type IconType = 'folder' | 'sys' | 'md' | 'csv' | 'pdf' | 'img' | 'doc'

const SYSTEM_FOLDERS = new Set(['img', 'files'])

function typeOf(name: string, kind: 'file' | 'folder'): IconType {
  if (kind === 'folder') return SYSTEM_FOLDERS.has(name) ? 'sys' : 'folder'
  const fileKind = fileKindOf(name)
  if (fileKind === 'image') return 'img'
  if (fileKind === 'pdf') return 'pdf'
  const ext = splitName(name).ext.slice(1).toLowerCase()
  switch (ext) {
    case '':
    case 'md':
    case 'markdown':
      return 'md'
    case 'csv':
    case 'tsv':
    case 'xlsx':
      return 'csv'
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

export function FileTypeIcon({
  name,
  kind,
  size = 18,
  open = false
}: {
  name: string
  kind: 'file' | 'folder'
  size?: number
  open?: boolean
}): React.JSX.Element {
  const type = typeOf(name, kind)
  const Svg = kind === 'folder' && open ? FolderOpenSvg : SVGS[type]
  return (
    <span className="flex shrink-0" style={{ color: `var(--icon-${type})` }} aria-hidden="true">
      <Svg width={size} height={size} style={{ display: 'block' }} />
    </span>
  )
}

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
