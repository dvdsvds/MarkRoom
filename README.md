# MarkRoom

마크다운(.md) 파일 기반의 데스크톱 편집기입니다. 글, 보고서, 서식(양식) 문서를 쓰고 코드를 실행할 수 있으며, 파일은 앱에 갇히지 않고 그대로 `.md`로 남습니다.

Windows, macOS, Linux를 지원합니다.

## 다운로드

[Releases](https://github.com/dvdsvds/markroom/releases)에서 운영체제에 맞는 파일 하나만 받으면 됩니다.

| 운영체제 | 파일 |
|---|---|
| Windows | `markroom-x.y.z-setup.exe` |
| macOS (Apple Silicon) | `markroom-x.y.z.dmg` |
| Linux | `markroom-x.y.z.AppImage` 또는 `markroom_x.y.z_amd64.deb` |

`.yml`, `.blockmap`, `.zip` 파일은 자동 업데이트용이라 받지 않아도 됩니다. 설치 후에는 새 버전이 나오면 앱이 알아서 업데이트합니다.

## 주요 기능

- **분할 편집**: 왼쪽 원문, 오른쪽 미리보기, 동기 스크롤
- **마크다운**: CommonMark + GFM(표, 체크리스트, 각주), 수식(KaTeX), Mermaid 도표, 글자색 `{red|글자}`
- **파일 그대로 관리**: 실제 폴더 구조, 자동 저장, 앱 밖에서 바뀐 파일 자동 반영, 비정상 종료 후 복구
- **링크**: 위키링크 `[[파일 이름]]`, 이름·위치가 바뀌면 링크 자동 갱신, 백링크 패널
- **이미지·첨부**: 붙여넣기·끌어다 놓기로 `img/`, `files/`에 저장, 이미지·PDF는 앱 안에서 미리보기
- **실행되는 문서**: JS·Python 코드 블록 실행, `table()`·`chart()`로 표와 차트 출력, CSV·JSON 읽기
- **서식(양식)**: `template [ ... ]`로 A4 영수증·보고서 같은 양식을 만들고, 미리보기에서 표를 직접 편집, PDF로 내보내기
- **할일 대시보드**: 모든 파일의 `- [ ]`를 한곳에서 확인·체크
- **퀵 캡처**: 어디서든 단축키로 `Inbox.md`에 한 줄 메모
- **편집 편의**: Vim 키 바인딩(선택), 서식 툴바, 자동 닫기, 접기, 변경 표시, 단축키 변경

## 서식 예시

```
value [
  상호: 가나다상회
]

template [
  page A4
  title : 영수증
  table col=2 row=1 frame=double [
    col=1 row=1 bold [
      text center : 상호
    ]
    col=2 row=1 [
      text : {{상호}}
    ]
  ]
]
```

## 소스에서 빌드

필요한 것: Node.js 20 이상, npm

```bash
npm install          # 의존성 설치, 패치 적용, Pyodide 복사
npm run dev          # 개발 모드 실행
npm run build:win    # Windows 설치 파일
npm run build:mac    # macOS (macOS에서만)
npm run build:linux  # Linux
```

결과물은 `dist/`에 생깁니다.

## 기술 스택

Electron, TypeScript, React, CodeMirror 6, markdown-it, Zustand, Tailwind CSS, electron-vite, electron-builder