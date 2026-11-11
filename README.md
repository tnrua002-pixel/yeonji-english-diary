# 연지쌤 영어 다이어리

조종중학교 이연지 선생님과 학생들이 영어 수업에서 함께 쓰는 반응형 웹앱입니다.
PC·교실 대형 화면·스마트폰에서 같은 주소로 접속하고, 스마트폰 홈 화면에 추가하면 앱처럼 열립니다.

서버는 **Python 기본 기능만** 사용해서 따로 설치할 것이 없고, **PythonAnywhere 무료 계정**에서 돈 들지 않게 운영할 수 있어요.

**지금 운영 중인 주소: https://yeonjidiary.pythonanywhere.com**

## 1. 학생 접속 방식 (이메일 없음)

- 학생은 **참여 코드 + 학년·반·번호·이름 + PIN 4자리**로 들어옵니다. 처음 접속할 때 자동으로 등록돼요.
- PIN은 암호화해서 저장하고, 같은 학생이 5번 틀리면 10분 동안 잠깁니다.
- PIN을 잊은 학생은 선생님이 **학생** 화면에서 ‘PIN 초기화’ → 다음 접속 때 새 PIN을 정합니다.
- 서버가 모든 요청에서 권한을 확인합니다: 학생은 자기 질문만 볼 수 있고, 자료 수정·업로드는 선생님만 할 수 있어요.
- 학습지는 6시간 동안만 유효한 서명된 주소로 내려받습니다.
- 기본 참여 코드는 `JOJONG` 이고, 선생님 **설정** 화면에서 바꿀 수 있어요.

## 과제 (사진 제출 · 피드백)

- 선생님이 **관리 화면 → 과제**에서 과제(제목·설명·마감일·관련 단원)를 만들고 ‘학생에게 공개’하면 학생 화면의 **과제** 탭에 나타나요.
- 학생은 과제를 열어 **사진 찍기 / 앨범에서 고르기**로 최대 4장을 올려요. 사진은 휴대폰에서 자동으로 작게 줄이고(긴 쪽 1280px), 위치 정보도 지워져요.
- 학번·이름은 로그인한 정보로 자동으로 들어가고, 올릴 때 **개인 비밀번호(PIN)** 를 한 번 더 확인해요. 다른 친구 이름으로는 낼 수 없어요.
- 낸 과제는 **그 학생과 선생님만** 볼 수 있어요. 선생님은 **아주 잘했어요 / 잘했어요 / 다시 해 봐요** 중 하나와 피드백을 남겨요. ‘다시 해 봐요’를 받으면 학생이 고쳐서 다시 낼 수 있어요.
- 무료 계정 저장 공간은 512MB예요. 과제 화면 위쪽에서 사용량을 볼 수 있고, 끝난 과제를 지우면 그 사진들도 함께 지워져요.

## 2. 선생님 비밀번호

- 기본 비밀번호는 없어요. **처음 접속해서 ‘선생님’ 탭을 누르면 비밀번호를 만드는 화면**이 나와요.
- 나중에 바꾸려면 선생님 **설정** 화면에서 바꿀 수 있어요.

## 3. PythonAnywhere 무료 서버 운영

### 처음 한 번만 하는 설정

1. [pythonanywhere.com](https://www.pythonanywhere.com)에서 **Beginner(무료)** 계정을 만들어요. 사용자 이름이 주소가 돼요. (예: `yeonji` → `https://yeonji.pythonanywhere.com`)
2. **Consoles → Bash** 를 열고 코드를 받아요.
   ```bash
   git clone https://github.com/tnrua002-pixel/yeonji-english-diary.git
   ```
3. **Web → Add a new web app → Manual configuration → Python 3.x** 를 골라요.
4. Web 화면의 **WSGI configuration file** 내용을 아래로 바꿔요. (`사용자이름` 부분을 내 사용자 이름으로)
   ```python
   import os, sys
   path = '/home/사용자이름/yeonji-english-diary'
   if path not in sys.path:
       sys.path.insert(0, path)
   os.environ['DATA_DIR'] = '/home/사용자이름/diary-data'
   from app import application
   ```
5. Web 화면에서 **Force HTTPS** 를 켜고 위쪽의 **Reload** 를 눌러요.
6. 내 주소로 들어가 **선생님** 탭에서 비밀번호를 만들어요.

### 한 달에 한 번 (연장)

무료 계정은 **한 달에 한 번** 연장해야 해요. 기한 일주일 전에 메일이 와요.
PythonAnywhere에 로그인 → **Web** 화면의 **“Run until 1 month from today”** 버튼을 누르면 끝이에요. (자료는 그대로 남아요)
연장을 놓쳐서 사이트가 멈춰도 자료는 남아 있고, 같은 버튼을 누르면 다시 켜져요.

### 앱을 고쳤을 때 (업데이트)

**Consoles → Bash** 에서 아래를 실행하고, **Web** 화면에서 **Reload** 를 눌러요.
```bash
cd ~/yeonji-english-diary && git pull
```

### 백업

**Files** 화면에서 `diary-data` 폴더의 `db.json`(단원·질문·학생)과 `uploads`(학습지 파일)를 가끔 내려받아 두세요.

### 선생님 비밀번호를 잊었을 때

WSGI 파일의 `from app import application` 바로 위에 두 줄을 넣고 **Reload** 하세요.
```python
os.environ['TEACHER_PASSWORD'] = '새 비밀번호'
os.environ['RESET_TEACHER_PASSWORD'] = '1'
```
새 비밀번호로 로그인되면 **두 줄을 꼭 지우고** 다시 **Reload** 하세요. 단원·질문 자료는 그대로 남아요.

## 4. 내 PC에서 실행하기

1. (처음 한 번) [Python 3](https://www.python.org)을 설치해요. 이 PC에는 이미 설치되어 있어요.
2. 이 폴더의 **`start-windows.bat`** 을 더블클릭해요.
3. 브라우저에서 `http://localhost:3000` 이 열려요. 검은 창을 닫으면 앱이 꺼져요.

자료는 이 폴더의 `data` 폴더에 저장돼요. `data` 폴더를 지우고 다시 실행하면 샘플 단원만 있는 처음 상태로 돌아가요.

## 5. 샘플 단원 바꾸기

선생님 로그인 → **단원 관리** → 샘플 단원 ‘편집’에서 단어·본문·문법을 새 내용으로 바꾸거나, 샘플 단원을 삭제하고 새 단원을 만드세요.
본문은 **한꺼번에 붙여넣기**로 영어 본문과 해석을 통째로 넣고, 문장 짝을 미리 보며 고친 뒤 저장할 수 있어요.

## 6. 파일 구성

```
app.py               서버 (Python 기본 기능만 사용)
seed.py              처음 실행할 때 들어가는 샘플 단원
public/index.html    화면 틀
public/app.js        학생·선생님 화면 동작
public/styles.css    다이어리 디자인
public/sw.js         홈 화면 앱(PWA)용 서비스 워커
public/manifest.webmanifest, public/icons/   앱 이름·아이콘
start-windows.bat    내 PC에서 실행
tests/               자동 점검 (node tests/smoke-test.js, node tests/reset-test.js — Node.js와 Python 필요)
CLAUDE.md            Claude가 이어서 작업할 때 읽는 정리 노트
이어서하기.md         다른 곳(학교 등)에서 이어서 할 때 보는 안내
data/                (실행하면 생김) 데이터베이스와 업로드 파일 — 저장소에 올리지 않음
```

| 환경 변수 | 뜻 | 기본값 |
|---|---|---|
| `DATA_DIR` | 데이터·파일 저장 위치 | `./data` |
| `PORT` | 내 PC에서 실행할 때 포트 | `3000` |
| `HOST` | 내 PC에서 실행할 때 주소 (같은 와이파이의 휴대폰에서 열려면 `0.0.0.0`) | `127.0.0.1` |
| `TEACHER_PASSWORD` | 처음 시작할 때 선생님 비밀번호를 미리 정하기 (없으면 화면에서 만듦) | 없음 |
| `RESET_TEACHER_PASSWORD` | `1`이면 시작할 때 선생님 비밀번호를 `TEACHER_PASSWORD`로 초기화 (쓴 뒤 지우기) | 없음 |
