# MarkRoom

마크다운(.md) 파일 기반의 데스크톱 편집기입니다.

열자마자 바로 쓰고, 파일은 앱에 갇히지 않고 그대로 `.md`로 남습니다. 간단한 글부터 표가 들어간 영수증 같은 양식, 실행되는 코드까지 한 곳에서 쓸 수 있습니다.

- 지원: **Windows / macOS (Apple Silicon) / Linux**
- 웹에서 바로 열리는 서비스가 아니라, 설치해서 쓰는 프로그램입니다

---

## 목차

- [설치](#설치)
- [시작하기](#시작하기)
- [주요 기능](#주요-기능)
- [서식(양식) 만들기](#서식양식-만들기)
- [코드 실행](#코드-실행)
- [단축키](#단축키)
- [자주 묻는 질문](#자주-묻는-질문)
- [소스에서 빌드](#소스에서-빌드)
- [피드백](#피드백)
- [라이선스](#라이선스)

---

## 설치

[Releases](https://github.com/dvdsvds/markroom/releases)의 최신 버전에서 **운영체제에 맞는 파일 하나만** 받으면 됩니다.

### Windows

1. `markroom-x.y.z-setup.exe`를 받습니다
2. 실행해서 설치합니다
3. "Windows의 PC 보호" 창이 뜨면 **추가 정보 → 실행**을 누릅니다

### macOS (Apple Silicon)

1. `markroom-x.y.z.dmg`를 받습니다
2. 열어서 MarkRoom을 **응용 프로그램** 폴더로 끌어 놓습니다
3. 처음 실행할 때 "확인되지 않은 개발자" 경고가 뜨면, 터미널에서 아래를 실행한 뒤 다시 엽니다

```bash
xattr -cr /Applications/MarkRoom.app
```

### Linux (x86_64)

**AppImage**

```bash
chmod u+x markroom-x.y.z.AppImage
./markroom-x.y.z.AppImage
```

**deb (Ubuntu, Debian)**

```bash
sudo apt install ./markroom_x.y.z_amd64.deb
```

### 그 외 파일

`latest*.yml`, `*.blockmap`, `*.zip`은 자동 업데이트용입니다. 받지 않아도 됩니다.

### 업데이트

| 운영체제 | 업데이트 방법 |
|---|---|
| Windows | 새 버전이 나오면 앱이 알아서 받아서 적용합니다 |
| Linux (AppImage) | 새 버전이 나오면 앱이 알아서 받아서 적용합니다 |
| Linux (deb) | Releases에서 새 버전을 받아 다시 설치합니다 |
| macOS | Releases에서 새 버전을 받아 다시 설치합니다 (서명이 없어서 자동 업데이트가 되지 않습니다) |

---

## 시작하기

1. 처음 실행하면 문서 폴더 아래에 MarkRoom 전용 폴더가 만들어지고, 그 폴더가 작업 폴더가 됩니다. 위치는 설정에서 바꿀 수 있습니다
2. 왼쪽 사이드바에서 **새 파일**(또는 `Ctrl+N`)을 누르고 이름을 입력하면 파일이 생깁니다
3. 왼쪽에 쓰면 오른쪽에 바로 미리보기가 나옵니다
4. 입력을 멈추면 자동으로 저장됩니다. `Ctrl+S`로 바로 저장할 수도 있습니다

작업 폴더는 평범한 폴더라서, 탐색기나 다른 편집기로 파일을 고쳐도 MarkRoom에 바로 반영됩니다.

---

## 주요 기능

### 편집

- 왼쪽 원문, 오른쪽 미리보기, 스크롤 동기화
- 서식 툴바, `/` 메뉴로 블록 넣기
- 괄호·강조 기호 자동 닫기, 목록 번호 자동 정리
- 제목 단위로 접기, 마지막 저장 상태와 달라진 줄 표시
- Vim 키 바인딩 (설정에서 켜기)

### 마크다운

- CommonMark + GFM: 표, 체크리스트, 취소선, 각주
- 수식: `$a^2 + b^2 = c^2$`, `$$ ... $$` (KaTeX)
- 도표: ` ```mermaid ` 코드 블록
- 글자색: `{red|빨간 글자}`, `{#980000|진한 빨강}`

### 파일 관리

- 실제 폴더 구조 그대로, 하위 폴더 제한 없음
- 여러 파일을 탭으로 열기, 앱을 다시 켜면 탭 복원
- 비정상 종료 후 저장 못 한 내용 복구
- 삭제하면 OS 휴지통으로 이동
- 빠른 검색(`Ctrl+P`)과 본문 전체 검색

### 링크

- 위키링크 `[[파일 이름]]`, `[[`를 치면 파일 이름 자동완성
- 파일 이름이나 위치가 바뀌면 링크도 자동으로 바뀝니다
- 백링크 패널: 지금 파일을 가리키는 다른 파일 목록

### 이미지와 첨부 파일

- 이미지를 붙여넣거나 끌어다 놓으면 같은 폴더의 `img/`에 저장되고 링크가 들어갑니다
- PDF, 엑셀 같은 파일은 `files/`에 저장됩니다
- 이미지와 PDF는 앱 안에서 바로 볼 수 있습니다

### 생산성

- **할일 대시보드** (`Ctrl+Shift+T`): 모든 파일의 `- [ ]`를 한곳에서 보고 체크
- **퀵 캡처** (`Ctrl+Alt+N`, 앱 밖에서도 동작): 떠오른 생각을 `Inbox.md`에 한 줄로 바로 추가
- **버전 기록**: 파일의 이전 버전을 비교하고 되돌리기

### 설정

- 라이트 / 다크 / 시스템 테마
- 에디터와 미리보기 글꼴·크기·줄 간격을 따로 설정
- 모든 단축키 변경 가능
- 화면 확대·축소 (`Ctrl + =`, `Ctrl + -`, `Ctrl + 0`)

---

## 서식(양식) 만들기

`template [ ... ]` 블록으로 영수증, 보고서 같은 A4 양식을 만들 수 있습니다. 미리보기에서 **편집**을 누르면 표를 직접 클릭해서 편집할 수 있고, PDF로 내보낼 수 있습니다.

```
value [
  상호: 가나다상회
  날짜: 2026-10-14
]

template [
  page A4
  title : 영수증
  table col=2 row=2 widths=40,- frame=double [
    col=1 row=1 bold [
      text center : 상호
    ]
    col=2 row=1 [
      text : {{상호}}
    ]
    col=1 row=2 bold [
      text center : 날짜
    ]
    col=2 row=2 [
      text : {{날짜}}
    ]
  ]
  text right : 위 금액을 정히 영수합니다.
]
```

| 문법 | 뜻 |
|---|---|
| `value [ 이름: 값 ]` | 서식 안의 `{{이름}}`에 들어갈 값 |
| `page A4` | 종이 크기 |
| `title : 글자` | 제목 (기본: 가운데, 굵게, 16pt) |
| `text 옵션 : 글자` | 글 한 줄. `text :`는 빈 줄 |
| `table col=열 row=행 [ ]` | 표. `widths=`(mm, `-`는 남은 폭), `frame=`(none, solid, thick, double, dashed) |
| `col=1-2 row=3 [ ]` | 표의 칸. 칸 안은 `text` 줄로 쓰고, 줄마다 정렬을 따로 줄 수 있습니다 |
| `line`, `space`, `box [ ]`, `chart [ ]` | 구분선, 빈 공간, 테두리 상자, 차트 |

자주 쓰는 옵션: `left` `center` `right` (가로 정렬), `top` `middle` `bottom` (세로 정렬), `bold` `italic` `underline` `strike`, `fs=12` (글자 크기), `fc=red` (글자색), `bg=yellow` (배경색)

편집 모드에서 할 수 있는 것:

- 칸 클릭으로 글자 편집, 입력하는 즉시 소스에 반영
- 칸 여러 개 선택해서 합치기·나누기, 열·행 추가·삭제
- 열 경계를 끌어서 폭 조절
- 툴바로 글꼴, 크기, 굵게, 색, 정렬, 위·아래 첨자

---

## 코드 실행

JS와 Python 코드 블록 아래에 **▶ 실행** 버튼이 생깁니다. 결과는 블록 아래에 표시되고, **저장**을 누르면 문서에 남습니다.

```js
const rows = readCSV("data.csv")
table(rows)
chart({ type: 'bar', labels: ['사과', '배'], values: [3, 2] })
```

```py
print(sum(range(10)))
```

- `table(rows)`: 표 출력
- `chart({ type, labels, values })`: 막대(`bar`), 선(`line`), 파이(`pie`) 차트 출력
- `readFile`, `readJSON`, `readCSV`: 작업 폴더 안의 파일 읽기 (csv, tsv, json, txt, md / 2MB 이하)

코드는 격리된 환경에서 실행되며, 파일을 쓰거나 인터넷에 접속할 수 없습니다.

---

## 단축키

맥에서는 `Ctrl` 대신 `Cmd`입니다. 설정에서 모두 바꿀 수 있습니다.

| 기능 | 단축키 |
|---|---|
| 새 파일 | `Ctrl+N` |
| 저장 | `Ctrl+S` |
| 빠른 검색 | `Ctrl+P` |
| 설정 | `Ctrl+,` |
| 목차 패널 | `Ctrl+Shift+O` |
| 할일 대시보드 | `Ctrl+Shift+T` |
| 백링크 패널 | `Ctrl+Shift+B` |
| 퀵 캡처 | `Ctrl+Alt+N` |
| 절대 경로 복사 | `Ctrl+Shift+C` |
| 상대 경로 복사 | `Ctrl+Alt+C` |
| 화면 확대 / 축소 / 초기화 | `Ctrl+=` / `Ctrl+-` / `Ctrl+0` |

---

## 자주 묻는 질문

**설치할 때 보안 경고가 떠요**

코드 서명 인증서가 없어서 뜨는 경고입니다. Windows는 **추가 정보 → 실행**, macOS는 위의 `xattr -cr` 명령으로 열 수 있습니다.

**내 파일은 어디에 있나요?**

작업 폴더(처음에는 문서 폴더 아래 MarkRoom 폴더)에 평범한 `.md` 파일로 있습니다. 앱을 지워도 파일은 그대로 남습니다.

**다른 편집기와 같이 써도 되나요?**

됩니다. 밖에서 고친 내용은 자동으로 반영되고, MarkRoom에서 저장 안 한 내용이 있을 때는 차이를 보여 주고 고르게 합니다.

**macOS에서 업데이트 알림이 안 와요**

서명이 없는 macOS 앱은 자동 업데이트가 되지 않습니다. Releases에서 새 버전을 직접 받아 주세요.

---

## 소스에서 빌드

필요한 것: Node.js 20 이상, npm

```bash
git clone https://github.com/dvdsvds/markroom.git
cd markroom
npm install          # 의존성 설치, 패치 적용, Pyodide 복사
npm run dev          # 개발 모드 실행
```

설치 파일 만들기:

```bash
npm run build:win    # Windows
npm run build:mac    # macOS (macOS에서만)
npm run build:linux  # Linux
```

결과물은 `dist/`에 생깁니다.

기술 스택: Electron, TypeScript, React, CodeMirror 6, markdown-it, Zustand, Tailwind CSS, electron-vite, electron-builder

---

## 피드백

혼자 쓰려고 만들다가 공개한 프로그램이라, 디자인이나 사용성에 대한 의견이 큰 도움이 됩니다. 버그나 의견은 [Issues](https://github.com/dvdsvds/markroom/issues)에 남겨 주세요.

---

## 라이선스

[MIT](LICENSE)