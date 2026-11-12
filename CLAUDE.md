# 연지쌤 영어 다이어리 — Claude 작업 노트

다른 PC나 새 세션에서 이어서 작업할 수 있도록 정리한 노트예요. 작업을 시작하기 전에 끝까지 읽어 주세요.

## 사용자와 일하는 방식
- 조종중학교 이연지 선생님의 영어 수업 웹앱이에요. 사용자는 개발을 잘 모르니 **모든 설명은 쉬운 한국어로, 한 번에 한 단계씩** 해 주세요.
- 계정 만들기, 비밀번호 입력, OAuth 승인, 결제는 **사용자가 직접** 해요. Claude는 화면만 준비하고, 마지막 버튼은 사용자에게 부탁해요.
- **돈이 들지 않는 방법**을 원해요. 요청하지 않은 점수 경쟁·랭킹·결제 기능은 넣지 않아요.
- 디자인: 파스텔 핑크 종이 + 차분한 초록 포인트, 다이어리 인덱스 탭. 겨자색·베이지는 쓰지 않아요.

## 지금 상태 (2026-11-11 기준)
- 운영 주소: https://yeonjidiary.pythonanywhere.com (PythonAnywhere 무료 Beginner 계정, 사용자 이름 `yeonjidiary`)
- GitHub: https://github.com/tnrua002-pixel/yeonji-english-diary (공개 저장소, 사용자가 승인)
- 선생님 비밀번호는 사용자가 첫 접속 때 직접 만들었어요. 기본 비밀번호는 없어요.
- 학생 참여 코드 기본값 `JOJONG`이 공개 README에 적혀 있어요. 사용자에게 설정 화면에서 바꾸라고 권했어요. **바꾼 코드는 어디에도 적지 마세요.**
- 기능: 단원(단어 카드·본문 해석·수업 모드·문법 문제), 학습지 파일, 질문·답변, 공지, **과제 사진 제출·선생님 평가**, 홈 화면 앱(PWA)

## 구조
- `app.py`: Python 표준 라이브러리만 쓰는 WSGI 서버예요. 자료는 JSON 파일(`DATA_DIR/db.json`)에, 업로드 파일은 `DATA_DIR/uploads`에 저장해요. 모든 요청에서 서버가 권한을 확인해요.
- `seed.py`: 새 DB를 만들 때 넣는 샘플 단원, 학습지 PDF, 공지, 과제예요.
- `public/`: `index.html`, `app.js`(학생+선생님 화면, 해시 라우팅), `styles.css`, `sw.js`, `manifest.webmanifest`, `icons/`
- `tests/`: `smoke-test.js`(서버 기능·권한 115개 점검), `reset-test.js`(선생님 비밀번호 초기화)
- 학생 로그인: 참여 코드 + 학년·반·번호·이름 + PIN 4자리. 과제를 낼 때도 PIN을 다시 확인해요.
- 과제 사진: 화면에서 1280px JPG로 줄여 data URL로 보내요(최대 4장, 한 장 3MB 이하). 사진 주소는 6시간짜리 서명된 임시 주소(`/media/...`)예요.

## 테스트
- 필요한 것: Python 3.10 이상, Node.js 18 이상
- 이 폴더에서 `node tests/smoke-test.js` → "결과: N개 통과, 0개 실패"가 나와야 해요.
- `node tests/reset-test.js` → "초기화 점검 통과"
- Python 위치를 못 찾으면 환경 변수 `PYTHON`에 python.exe 경로를 넣고 실행하세요.

## 운영 서버에 새 버전 올리기
1. 고치고 테스트 → `git commit` → `git push`
2. PythonAnywhere(브라우저, 사용자 로그인이 필요해요) → **Consoles → Bash**:
   `cp ~/diary-data/db.json ~/diary-data/db.backup-$(date +%Y%m%d).json && cd ~/yeonji-english-diary && git pull`
3. **Web** 탭 → **Reload** → https://yeonjidiary.pythonanywhere.com/api/health 가 `{"ok": true}`인지 확인
- WSGI 파일: `/var/www/yeonjidiary_pythonanywhere_com_wsgi.py` (`DATA_DIR=/home/yeonjidiary/diary-data`), Force HTTPS 켜져 있어요.
- 자료 형식이 바뀌면 `load_db()`에서 예전 자료를 자동으로 바꿔 주도록 만들어요. 운영 자료를 지우지 마세요.
- 무료 웹 앱은 **한 달마다** Web 탭의 "Run until 1 month from today"로 연장해야 해요.

## 집 PC에만 있는 것 (다른 PC에는 없어요)
- 예약 작업 `pythonanywhere-monthly-renewal`: 매월 1일·15일 10시에 연장 버튼을 눌러요. 집 PC와 Claude 앱이 켜져 있을 때만 실행돼요.
- 설치된 도구: Node.js, Python 3.12, Git, GitHub CLI(`gh`, git 자격 증명 연결됨)
- git `safe.directory` 설정 (이 SSD는 exFAT라서 git이 폴더 소유자를 확인하지 못해요)
- Claude 메모리

## 다른 PC(학교 등)에서 이어서 할 때
- SSD 드라이브 문자가 E:가 아닐 수 있어요. 폴더 이름은 `★클로드 영어공부 앱★`이에요.
- git이 "dubious ownership" 오류를 내면 사용자에게 알리고 `git config --global --add safe.directory "<이 폴더 경로>"`
- push하려면 그 PC에서 GitHub 로그인이 필요해요. 예: `gh auth login --web` → 승인은 사용자가 해요.
- `.claude/launch.json`의 Python 경로는 집 PC 기준이에요. 그 PC에 맞게 고치세요.
- 도구 설치(winget)는 꼭 사용자 허락을 받으세요. 학교 PC는 설치가 막혀 있을 수 있어요. 그때는 코드 수정은 집에서 하기로 해요.
- 로컬 실행은 `start-windows.bat` 또는 `python app.py`(http://localhost:3000)예요. `data/`는 연습용 자료이고, 실제 학생 자료는 서버에만 있어요.

## 교과서 수업 자료 (T셀파, 2026-11-12 정리)
- `T셀파 자료/중1 이상기/`에 천재교육(이상기) 중1 Lesson 5·6·7 자료가 있어요 (2학기 2차고사 범위). 단원마다 `1. 교과서·지도서` ~ `7. 마무리 게임·배경지식` 폴더로 나눴고, 파일 목록은 `자료 안내.txt`, 원래 이름은 `_정리 기록 (원래 이름·위치).csv`에 있어요.
- 출판사 저작물이라 `.gitignore`로 막아 두었어요. **이 폴더는 절대 커밋·push하지 마세요.**
- 앱에 단원을 넣을 때: 단어 = `V_list`, 본문·해석 = `본문_해석`, 문법 = `G_points`·`G_practice` (모두 .hwp). 한글 파일 글자는 Python 표준 라이브러리로 꺼낼 수 있어요 (OLE 파일 → `BodyText/Section*` → raw deflate 풀기 → 태그 67 문단 글자).
- 교과서 내용을 앱에 넣기 전에 학생 참여 코드부터 바꿔야 해요 (기본 코드가 공개 README에 있어요).

## 남은 일
- 실제 휴대폰에서 홈 화면 추가와 과제 사진 제출 확인 (지금까지는 PC에서만 시험했어요)
- 참여 코드를 공개되지 않은 코드로 바꾸기 (사용자가 직접)
- Lesson 5·6·7로 앱 단원 만들기 (자료 정리는 끝났어요, 위 "교과서 수업 자료" 참고). 샘플 단원은 그다음에 숨기거나 지우기
- 예약 연장 작업 첫 실행(11월 15일) 결과 확인
