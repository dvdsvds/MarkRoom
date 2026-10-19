import { fileKindOf } from '@renderer/utils/fileKind'
import { splitName } from '@renderer/utils/path'
import FolderSvg from '../icons/folder.svg?react'
import FolderOpenSvg from '../icons/folder-open.svg?react'
import MdSvg from '../icons/file-md.svg?react'
import CsvSvg from '../icons/file-csv.svg?react'
import XlsxSvg from '../icons/file-xlsx.svg?react'
import DocxSvg from '../icons/file-docx.svg?react'
import PptxSvg from '../icons/file-pptx.svg?react'
import PdfSvg from '../icons/file-pdf.svg?react'
import ImgSvg from '../icons/file-img.svg?react'
import CodeSvg from '../icons/file-code.svg?react'
import HtmlSvg from '../icons/file-html.svg?react'
import CssSvg from '../icons/file-css.svg?react'
import ConfigSvg from '../icons/file-config.svg?react'
import YamlSvg from '../icons/file-yaml.svg?react'
import TextSvg from '../icons/file-text.svg?react'
import ArchiveSvg from '../icons/file-archive.svg?react'
import AudioSvg from '../icons/file-audio.svg?react'
import VideoSvg from '../icons/file-video.svg?react'
import DocSvg from '../icons/file.svg?react'

type IconType =
  | 'folder'
  | 'sys'
  | 'md'
  | 'csv'
  | 'xlsx'
  | 'docx'
  | 'pptx'
  | 'pdf'
  | 'img'
  | 'code'
  | 'html'
  | 'css'
  | 'config'
  | 'yaml'
  | 'text'
  | 'archive'
  | 'audio'
  | 'video'
  | 'doc'

const SYSTEM_FOLDERS = new Set(['img', 'files'])

/** 확장자 → 아이콘 종류. 여기 없는 확장자는 회색 문서(doc) */
const EXT_TYPES: Record<string, IconType> = {}
const group = (type: IconType, exts: string): void => {
  for (const ext of exts.split(' ')) EXT_TYPES[ext] = type
}
group('md', 'md markdown')
group('csv', 'csv tsv')
group('xlsx', 'xlsx xls xlsm ods')
group('docx', 'docx doc odt rtf hwp hwpx')
group('pptx', 'pptx ppt odp key')
group('img', 'bmp ico tif tiff psd heic avif')
group(
  'code',
  'js jsx ts tsx mjs cjs py java c cc cpp h hpp cs go rs rb php swift kt kts scala dart lua r pl ' +
    'sh bash zsh ps1 bat cmd sql vue svelte'
)
group('html', 'html htm xhtml')
group('css', 'css scss sass less')
group('config', 'json jsonc json5 toml ini xml env conf cfg properties lock')
group('yaml', 'yaml yml')
group('text', 'txt log text')
group('archive', 'zip 7z rar gz tar tgz bz2 xz')
group('audio', 'mp3 wav flac ogg m4a aac')
group('video', 'mp4 mov avi mkv webm')

function typeOf(name: string, kind: 'file' | 'folder'): IconType {
  if (kind === 'folder') return SYSTEM_FOLDERS.has(name) ? 'sys' : 'folder'
  const fileKind = fileKindOf(name)
  if (fileKind === 'image') return 'img'
  if (fileKind === 'pdf') return 'pdf'
  const ext = splitName(name).ext.slice(1).toLowerCase()
  return EXT_TYPES[ext] ?? 'doc'
}

const SVGS = {
  folder: FolderSvg,
  sys: FolderSvg,
  md: MdSvg,
  csv: CsvSvg,
  xlsx: XlsxSvg,
  docx: DocxSvg,
  pptx: PptxSvg,
  pdf: PdfSvg,
  img: ImgSvg,
  code: CodeSvg,
  html: HtmlSvg,
  css: CssSvg,
  config: ConfigSvg,
  yaml: YamlSvg,
  text: TextSvg,
  archive: ArchiveSvg,
  audio: AudioSvg,
  video: VideoSvg,
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
