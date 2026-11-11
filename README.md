# 연지의 영어 다이어리

조종중학교 이연지 선생님과 학생들이 영어 수업에서 함께 쓰는 반응형 웹앱입니다.
PC·교실 대형 화면·스마트폰에서 같은 주소로 접속하고, 스마트폰 홈 화면에 추가하면 앱처럼 열립니다.

## 1. 내 PC에서 바로 실행하기

1. (처음 한 번) [Node.js LTS](https://nodejs.org)를 설치합니다. 이 PC에는 이미 설치되어 있어요.
2. 이 폴더의 **`start-windows.bat`** 을 더블클릭합니다.
3. 브라우저에서 `http://localhost:3000` 이 열립니다. 검은 창을 닫으면 앱이 꺼져요.

| 구분 | 처음 접속 정보 |
|---|---|
| 선생님 | ‘선생님’ 탭 → 기본 비밀번호 `teacher1234` → **설정에서 꼭 바꾸기** |
| 학생 | 참여 코드 `JOJONG` + 학년·반·번호·이름 + 직접 정하는 PIN 4자리 |

모든 자료는 이 폴더의 `data` 폴더에 저장돼요. (`data/db.json` = 단원·질문·학생, `data/uploads` = 학습지 파일)
`data` 폴더를 지우고 다시 실행하면 샘플 단원만 있는 처음 상태로 돌아갑니다.

## 2. 학생 접속 방식 (이메일 없음)

- 학생은 **참여 코드 + 학년·반·번호·이름 + PIN 4자리**로 들어옵니다. 처음 접속할 때 자동으로 등록돼요.
- PIN은 암호화해서 저장하고, 같은 학생이 5번 틀리면 10분 동안 잠깁니다.
- PIN을 잊은 학생은 선생님이 **학생** 화면에서 ‘PIN 초기화’ → 다음 접속 때 새 PIN을 정합니다.
- 서버가 모든 요청에서 권한을 확인합니다: 학생은 자기 질문만 볼 수 있고, 자료 수정·업로드는 선생님만 할 수 있어요.
- 학습지는 6시간 동안만 유효한 서명된 주소로 내려받습니다.

## 3. 실제 학생에게 배포하기 (인터넷 주소 만들기)

학생이 집이나 다른 스마트폰에서도 접속하려면 앱을 인터넷 서버에 올려야 해요.
아래는 **GitHub**(코드 보관, 무료) + **Railway**(서버, 유료 · 월 약 5달러 수준 · 가입 시 요금 확인)를 쓰는 방법입니다. Render, Fly.io 같은 다른 Node.js 호스팅도 같은 방식으로 쓸 수 있어요. 어느 곳이든 **파일이 지워지지 않는 저장 공간(Volume/Disk)** 을 꼭 붙여야 합니다.

### 3-1. GitHub에 코드 올리기 (명령어 없이)

1. [github.com](https://github.com)에 가입합니다.
2. [GitHub Desktop](https://desktop.github.com)을 설치하고 같은 계정으로 로그인합니다.
3. GitHub Desktop에서 **File → Add local repository** → 이 폴더(`★클로드 영어공부 앱★`)를 고릅니다.
   - “저장소가 아니에요(not a Git repository)”라고 나오면 그 안의 **create a repository** 를 눌러 그대로 만들기를 누르세요.
4. 위쪽의 **Publish repository** 를 누르고, **Keep this code private(비공개)** 에 체크한 채 Publish 합니다.
5. github.com에서 올라간 파일 목록에 **`data` 폴더가 없는지** 확인합니다. (학생 정보가 들어가는 폴더라 자동으로 빠지게 해 두었어요)

### 3-2. Railway에 서버 만들기

1. [railway.com](https://railway.com)에 **GitHub 계정으로** 가입하고 결제 수단을 등록합니다.
2. **New Project → Deploy from GitHub repo** → 3-1에서 올린 저장소를 고릅니다.
3. 서비스의 **Variables**에 두 가지를 추가합니다.
   - `TEACHER_PASSWORD` = 선생님만 아는 긴 비밀번호 (처음 실행할 때만 쓰여요. 나중엔 앱의 설정 화면에서 바꿔요)
   - `DATA_DIR` = `/data`
4. 서비스에 **Volume**을 추가하고 Mount path를 `/data`로 정합니다. (이게 없으면 다시 배포할 때 자료가 사라져요)
5. **Settings → Networking → Generate Domain** 을 누르면 `https://…` 주소가 생깁니다.
6. (선택) **Settings → Deploy → Healthcheck Path** 에 `/api/health` 를 넣으면 서버가 살아 있는지 Railway가 확인해 줘요.
7. 그 주소로 들어가 선생님으로 로그인 → **설정**에서 참여 코드를 확인하고, ‘안내 문구 복사’로 학생들에게 알려 줍니다.

> 인터넷 주소는 꼭 `https://`로 시작해야 스마트폰 ‘홈 화면에 추가’가 앱처럼 동작해요. Railway는 자동으로 https를 붙여 주고, 앱은 http로 들어온 접속을 https로 바꿔 줘요.

### 3-3. 나중에 앱을 고쳤을 때

GitHub Desktop에서 바뀐 파일을 확인 → **Commit to main** → **Push origin** 을 누르면 Railway가 자동으로 새 버전을 배포해요. 단원·질문·학습지 자료는 Volume(`/data`)에 그대로 남아요.

### 문제가 생기면

- Railway 로그에 `EACCES` 나 `permission denied` 가 보이면: Variables에 `RAILWAY_RUN_UID` = `0` 을 추가하고 다시 배포하세요. (저장 공간 쓰기 권한 문제)
- 선생님 비밀번호를 잊었다면: Variables에서 `TEACHER_PASSWORD` 를 새 비밀번호로 바꾸고 `RESET_TEACHER_PASSWORD` = `1` 을 추가해 다시 배포하세요. 새 비밀번호로 로그인되면 **`RESET_TEACHER_PASSWORD` 는 꼭 지워** 주세요. (단원·질문 자료는 그대로 남아요)

### 배포 전에 확인할 것

- 학교 개인정보 담당 선생님께 **수집 항목(학년·반·번호·이름, 질문 내용)** 을 알리고 필요한 안내(가정통신문 등)를 확인하세요.
- 서버의 `data` 저장 공간을 학기 중 주기적으로 **백업**하세요. (Railway Volume은 화면에서 백업을 만들 수 있어요)

## 4. 샘플 단원 바꾸기

선생님 로그인 → **단원 관리** → 샘플 단원 ‘편집’에서 단어·본문·문법을 새 내용으로 바꾸거나, 샘플 단원을 삭제하고 새 단원을 만드세요.
본문은 **한꺼번에 붙여넣기**로 영어 본문과 해석을 통째로 넣고, 문장 짝을 미리 보며 고친 뒤 저장할 수 있어요.

## 5. 파일 구성

```
server.js            서버 (Node.js 기본 기능만 사용, 추가 설치 없음)
seed.js              처음 실행할 때 들어가는 샘플 단원
public/index.html    화면 틀
public/app.js        학생·선생님 화면 동작
public/styles.css    다이어리 디자인
public/sw.js         홈 화면 앱(PWA)용 서비스 워커
public/manifest.webmanifest, public/icons/   앱 이름·아이콘
start-windows.bat    내 PC에서 실행
data/                (실행하면 생김) 데이터베이스와 업로드 파일 — 저장소에 올리지 않음
```

| 환경 변수 | 뜻 | 기본값 |
|---|---|---|
| `PORT` | 서버 포트 | `3000` |
| `DATA_DIR` | 데이터·파일 저장 위치 | `./data` |
| `TEACHER_PASSWORD` | 처음 실행 때 선생님 비밀번호 | `teacher1234` (반드시 변경) |
| `RESET_TEACHER_PASSWORD` | `1`이면 시작할 때 선생님 비밀번호를 `TEACHER_PASSWORD`로 초기화 (쓴 뒤 지우기) | 없음 |
