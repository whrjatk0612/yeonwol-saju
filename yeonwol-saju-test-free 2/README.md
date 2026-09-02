# 연월당 테스트 무료 전체공개 버전

이 폴더는 테스트용입니다. `FREE_TEST_MODE=true`이면 사용자가 결제하지 않아도 입력 후 전체 연애사주가 바로 생성됩니다.

## 가장 간단한 설정

`.env.example`을 복사해 `.env`로 만들고 아래 항목만 먼저 설정하세요.

```env
OPENAI_API_KEY=여기에_실제_OpenAI_API_키
OPENAI_MODEL=gpt-5.6-luna
FREE_TEST_MODE=true
PAYMENT_DEMO_MODE=true
PORT=3000
```

토스 키는 테스트 무료 공개 중에는 비워둬도 됩니다.

## 실행

```bash
npm install
npm start
```

브라우저: http://localhost:3000

## 흐름

사주 정보 입력 → 만세력 계산 → AI 전체 연애사주 생성 → 전체 결과 즉시 공개

사용자 결제는 없지만 OpenAI API 호출 비용은 API 계정에서 발생합니다.

## 나중에 결제를 다시 켜려면

`.env`에서:

```env
FREE_TEST_MODE=false
PAYMENT_DEMO_MODE=false
```

로 바꾸고 토스페이먼츠 키를 넣으면 기존 무료 맛보기 → 결제 → 전체 공개 구조로 돌아갈 수 있습니다.

---

# 연월당 v2 — 만세력 + 무료 맛보기 + 결제 후 전체 연애사주

생년월일시를 입력하면 **만세력 원국을 먼저 계산**하고, OpenAI가 30년 된 점사 상담가 분위기로 연애 흐름을 풀어주는 웹사이트 스타터입니다.

## v2에서 추가된 기능

- 양력 / 음력 / 윤달 입력
- `manseryeok` 2.x 기반 사주팔자 원국 계산
  - 연주 · 월주 · 일주 · 시주
  - 십신
  - 공망
  - 대운
  - 국내 주요 도시 출생시간의 경도·진태양시 보정
- 처음에는 **무료 맛보기만 생성**
- 맛보기 아래 전체 풀이 Paywall
- 토스페이먼츠 V2 주문서형 결제 UI
- 서버에서 결제 금액·주문번호 검증 후 결제 승인
- 결제 성공 시에만 서명된 `unlockToken` 발급
- 전체 풀이 API는 유효한 잠금해제 토큰이 있어야 호출 가능
- 결제 전/후 데이터는 기본적으로 브라우저 `localStorage`에 임시 보관
- 전체 결과도 브라우저에 캐시하여 새로고침 시 OpenAI 비용 중복 발생을 줄임
- 실결제 키가 없어도 테스트 가능한 개발용 잠금해제(로컬 테스트에서만 `PAYMENT_DEMO_MODE=true`) 모드

---

## 1. 준비

Node.js 18 이상이 필요합니다.

```bash
npm install
```

`npm install`을 하면 `manseryeok` 계산 엔진도 같이 설치됩니다.

`.env.example`을 `.env`로 복사합니다.

```bash
cp .env.example .env
```

Windows에서는 `.env.example`을 복사해서 이름을 `.env`로 바꾸면 됩니다.

---

## 2. 환경변수

```env
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-5.6-luna

TOSS_CLIENT_KEY=test_gck_your_client_key
TOSS_SECRET_KEY=test_gsk_your_secret_key
FORTUNE_PRICE=4900

TOKEN_SECRET=replace-with-a-long-random-secret-at-least-32-chars
UNLOCK_TTL_DAYS=7

PAYMENT_DEMO_MODE=false
PORT=3000
```

### OpenAI

- `OPENAI_API_KEY`: OpenAI API 키
- `OPENAI_MODEL`: 기본값은 비용 효율형 `gpt-5.6-luna`

API 키는 브라우저 코드에 넣지 않습니다. `server.js`가 서버에서만 사용합니다.

### 토스페이먼츠

- `TOSS_CLIENT_KEY`: 결제 SDK에서 쓰는 클라이언트 키
- `TOSS_SECRET_KEY`: 서버 결제 승인에 쓰는 시크릿 키
- `FORTUNE_PRICE`: 전체 풀이 가격. 기본 4,900원

토스페이먼츠 개발자센터의 **테스트 키**로 먼저 연동한 뒤 실제 계약/운영 단계에서 라이브 키로 변경하세요.

### TOKEN_SECRET

결제 완료 후 발급하는 잠금해제 토큰의 서명용 비밀값입니다.

운영에서는 32자 이상의 무작위 문자열을 사용하세요. GitHub에 올리지 마세요.

### PAYMENT_DEMO_MODE

개발용입니다.

```env
PAYMENT_DEMO_MODE=false
```

이면 실제 카드 결제 없이 `개발 모드: 결제 완료 처리` 버튼으로 전체 흐름을 테스트할 수 있습니다.

**운영 배포 전에는 반드시 `false`로 변경하세요.**

---

## 3. 실행

```bash
npm start
```

브라우저:

```text
http://localhost:3000
```

---

## 4. 이용 흐름

```text
사용자 정보 입력
      ↓
만세력 원국 계산
      ↓
무료 맛보기 AI 생성
      ↓
맛보기 결과 표시
      ↓
전체 풀이 Paywall
      ↓
토스페이먼츠 결제 요청
      ↓
결제 성공 URL
      ↓
서버가 amount / orderId 검증
      ↓
토스페이먼츠 결제 승인 API
      ↓
unlockToken 발급
      ↓
전체 연애사주 AI 생성
      ↓
전체 결과 공개
```

중요: `successUrl`에 돌아왔다고 바로 잠금을 풀지 않습니다. 서버가 토스페이먼츠 승인까지 성공한 경우에만 잠금해제 토큰을 발급합니다.

---

## 5. 만세력 계산

`manseryeok` 2.x 패키지를 사용합니다.

사이트는 입력값을 AI에 바로 보내지 않고 다음 순서로 처리합니다.

1. 생년월일 / 양력·음력 / 윤달 / 출생시간 확인
2. 만세력 엔진에서 사주팔자 계산
3. 연주·월주·일주·시주 추출
4. 십신·공망·대운 추출
5. 이 구조화된 데이터를 AI 프롬프트에 첨부
6. AI는 계산값을 기반으로 설명만 담당

출생시간을 모르면 임의의 시주를 사용자에게 보여주지 않고 `미상`으로 처리합니다.

### 출생지역 보정

현재 스타터에는 다음 주요 국내 도시의 경도를 간단히 매핑해 진태양시 보정을 적용합니다.

서울, 수원, 인천, 대전, 대구, 부산, 울산, 광주, 제주, 춘천, 강릉, 청주, 전주, 포항, 창원

상용 서비스에서 전국 읍·면·동 또는 해외 출생까지 정밀하게 처리하려면 주소→좌표 지오코딩을 별도로 연동하는 것이 좋습니다.

---

## 6. 결제 보안 구조

`/api/payment/order`

- 서버가 주문번호를 생성합니다.
- 주문번호에는 분석 ID와 가격을 서버 비밀값으로 서명한 값이 포함됩니다.

`/api/payment/confirm`

- 성공 URL의 `paymentKey`, `orderId`, `amount`를 받습니다.
- 서버 설정 가격과 `amount`가 같은지 확인합니다.
- 주문번호 서명을 검증합니다.
- 토스페이먼츠 결제 승인 API를 서버 시크릿 키로 호출합니다.
- 승인 결과의 주문번호·총액·상태가 일치할 때만 잠금해제 토큰을 발급합니다.

`/api/fortune/full`

- 잠금해제 토큰이 없거나 변조됐거나 만료되면 HTTP 402로 거부합니다.

따라서 프론트엔드 HTML에서 잠긴 영역을 개발자도구로 지운다고 전체 결과를 받을 수는 없습니다.

---

## 7. 현재 스타터의 데이터 보관 방식

서버 DB를 사용하지 않습니다.

입력 정보, 무료 결과, 결제 후 전체 결과, 잠금해제 토큰은 같은 브라우저의 `localStorage`에 저장됩니다.

장점:

- 구현이 단순함
- 서버 DB에 생년월일 정보를 남기지 않음

제약:

- 다른 기기에서는 구매 결과가 자동 복원되지 않음
- 브라우저 데이터를 삭제하면 결과도 사라질 수 있음

**실제 유료 서비스에서는 회원/주문 DB를 붙여 결제내역과 결과 접근권한을 서버에 저장하는 구조를 권장합니다.**

---

## 8. 상용 배포 전에 반드시 추가할 것

- 사업자 정보
- 이용약관
- 개인정보 처리방침
- 개인정보 수집·이용 동의
- 유료 콘텐츠 가격 표시
- 환불/청약철회 정책
- 결제 실패/취소/환불 처리
- 결제 웹훅 또는 서버 DB 기반 주문 상태 동기화
- 주문 및 `paymentKey` 영구 보관
- Redis/DB 기반 rate limit
- 서버 로그에 생년월일 등 개인정보를 기록하지 않는 정책
- HTTPS
- `PAYMENT_DEMO_MODE=false`
- 강한 `TOKEN_SECRET`

디지털 콘텐츠의 환불·청약철회 조건은 실제 판매 형태와 국내 법령, PG사 계약 조건에 맞게 별도로 검토하세요.

---

## 9. 프로젝트 구조

```text
yeonwol-saju-v2/
├─ .env.example
├─ .gitignore
├─ package.json
├─ server.js
├─ README.md
└─ public/
   ├─ index.html
   ├─ styles.css
   ├─ app.js
   ├─ payment-success.html
   ├─ payment-success.js
   ├─ payment-fail.html
   └─ payment-fail.js
```

---

## 10. 운영 단계에서 추천하는 다음 업그레이드

1. PostgreSQL/Supabase 등 주문·결과 DB
2. 로그인 또는 주문번호+이메일 방식 결과 재열람
3. 토스 결제 취소/환불 API
4. 결제 웹훅
5. 궁합 상대 입력 및 2인 만세력 비교
6. 재물운·영적 사주 등 상품 추가
7. 무료 맛보기와 유료 결과의 A/B 테스트
8. 관리자 페이지에서 가격·프롬프트·판매량 관리

## 외부 라이브러리

- `manseryeok` — MIT License, 만세력/사주팔자 계산
- Toss Payments JavaScript SDK V2 — 결제 UI 및 결제 요청
- OpenAI Responses API — 사주 해석 텍스트 생성
