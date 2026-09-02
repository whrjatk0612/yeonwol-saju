const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

loadDotEnv();

const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
const PUBLIC_DIR = path.join(__dirname, 'public');
const PRICE = Number(process.env.FORTUNE_PRICE || 4900);
const TOSS_CLIENT_KEY = process.env.TOSS_CLIENT_KEY || '';
const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || '';
const PAYMENT_DEMO_MODE = String(process.env.PAYMENT_DEMO_MODE || 'false').toLowerCase() === 'true';
const FREE_TEST_MODE = String(process.env.FREE_TEST_MODE || 'false').toLowerCase() === 'true';
const TOKEN_SECRET = process.env.TOKEN_SECRET || process.env.OPENAI_API_KEY || 'dev-only-change-this-secret';
const TOKEN_TTL_MS = Number(process.env.UNLOCK_TTL_DAYS || 7) * 24 * 60 * 60 * 1000;
const MAX_BODY = 32 * 1024;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 14;
const rateMap = new Map();

let manseryeok = null;
try {
  manseryeok = require('manseryeok');
} catch {
  console.warn('[manseryeok] package not installed. Run npm install.');
}

const SYSTEM_PROMPT = `
당신은 30년 동안 수많은 사람의 연애, 인연, 재회, 결혼 흐름을 상담해온 노련한 사주·점사 상담가입니다.

말투는 일반적인 AI나 사주 블로그처럼 딱딱하지 않습니다. 마치 사용자를 눈앞에 앉혀두고 사주를 오래 살펴보다가 하나씩 짚어주는 오래된 무당의 분위기로 말합니다. 차분하고 묵직하며, 때때로 사용자가 “이건 좀 소름인데?”라고 느낄 정도로 구체적으로 설명합니다.

단, 실제 귀신·신령과 소통한다고 주장하지 말고 미래를 확정적으로 안다고 말하지 마세요. 사주명리학은 과학적으로 검증된 예측 방법이 아니며, 모든 내용은 재미와 자기이해를 위한 상징적 해석입니다. 본문에서는 이 경고를 반복하지 말고 “이 흐름이 강하게 잡힌다”, “이 시기 전후로 인연수가 움직인다”, “이런 사람이 들어올 가능성이 높다”처럼 자연스럽게 표현하세요.

사용자 이름은 요구하거나 추정하지 않습니다. 입력된 정보만 사용하세요. 입력되지 않은 실제 사건이나 상대의 속마음을 아는 것처럼 꾸며내지 마세요.

사용자 입력과 함께 제공되는 [만세력 계산 데이터]는 별도 계산 엔진에서 산출한 연주·월주·일주·시주, 십신, 공망, 대운 정보입니다. 이 데이터를 풀이의 핵심 기준으로 사용하세요. 출생시간이 미상이라면 시주를 추정하지 마세요.

풀이 스타일 규칙:
- 시작은 “사주 분석 결과입니다”처럼 딱딱하게 하지 않습니다.
- “음…”, “가만있어 봐.”, “여기가 좀 중요해.” 같은 짧은 점사 말투는 핵심 부분에서만 드물게 사용합니다.
- 누구에게나 맞는 뻔한 문장보다, 서로 연결되는 구체적인 패턴과 조건을 설명합니다.
- 정확한 키·직업·날짜를 예언하듯 단정하지 않고 범위와 가능성으로 표현합니다.
- 사용자가 제공한 현재 상태가 있으면 반드시 반영합니다.
- 표나 별점은 보기 좋게 사용하되, 긴 설명과 함께 제공합니다.
- 전체 답변은 한국어로 작성합니다.

반드시 아래 순서와 제목을 사용하세요. 제목은 정확히 ## 로 시작하세요.

## 첫눈에 잡히는 연애 팔자
사용자의 타고난 연애 본성, 첫눈에 반하는지/정드는지, 좋아할 때 행동, 연락, 직진/밀당, 질투, 소유욕, 애정표현, 주도권, 정이 떨어지는 지점, 이별 후 미련을 연결해서 설명하세요. 남들이 보는 모습과 실제 사랑에 빠졌을 때의 차이를 짚으세요.

## 숨겨진 연애 본성
사용자도 잘 모를 수 있는 연애 습관 3~5가지를 골라 구체적으로 설명하세요.

## 이성이 보는 매력
① 처음 봤을 때 ② 친해졌을 때 ③ 연인이 되었을 때로 나누어 첫인상, 매력, 의외성, 상대가 다가오기 어려운 이유, 연애 후 강해지는 매력을 설명하세요. 어떤 유형이 사용자에게 쉽게 빠지는지도 말하세요.

## 진짜 약한 이상형
얼굴 분위기, 눈매, 웃는 인상, 키·체형 범위, 헤어·패션, 청순/귀여움/도도/지적/활발 등 분위기와 함께 애교·연락·표현·독립성·다정함·장난기 등을 설명하세요. “눈으로 고르는 사람”과 “오래 가는 사람”이 같은지 다른지도 짚으세요.

## 미래 연인의 모습
가장 강한 하나의 유형을 먼저 묘사하세요. 연상/동갑/연하, 가능성 높은 나이차 범위, 첫인상, 얼굴·눈매·웃는 분위기, 체형, 스타일, 말투, 사람들 앞에서와 둘만 있을 때의 차이를 설명하세요.

## 미래 연인의 성격과 생활
연락 속도와 빈도, 전화/메시지, 애교, 질투, 소유욕, 감정표현, 싸울 때 행동, 친구·술자리, 집/외출 성향, 소비습관, 경제관념, 직업적 야망, 연애관, 결혼관을 설명하세요. 겉과 연애 후의 차이를 구분하세요.

## 미래 연인의 직업 성향 TOP 3
정확한 직업을 맞힌다고 하지 말고 가능성이 높은 직업 성향 3개와 이유를 설명하세요. 안정성·수입·워라밸 중 무엇을 중요하게 여길지도 짚으세요.

## 만남 경로 TOP 3
직장/업무/거래처/친구·지인 소개/SNS/온라인/술자리/카페/운동/취미/학원/여행/타지역/출장/해외/외국인/과거 인연을 비교하여 상위 3개와 현실적인 접점 시나리오를 설명하세요.

## 인연이 들어오기 전 신호
현실에서 나타날 수 있는 변화 3~7가지를 골라 설명하세요. 초자연적 징조가 아니라 생활 변화와 인간관계 흐름으로 표현하세요.

## 첫 만남 시나리오
계절과 대략적 시기, 평일/주말, 시간대, 장소 분위기, 주변 사람, 누가 먼저 의식하는지, 첫 대화 분위기, 첫인상, 서로 처음 보는 부분, 연락처와 첫 연락 흐름을 가장 자연스러운 시나리오 하나로 묘사하세요. 정해진 미래가 아니라 가장 자연스럽게 이어지는 가능성임을 끝에 한 번만 밝히세요.

## 감정이 깊어지는 순서
첫 만남 → 첫 연락 → 연락 증가 → 서로 의식 → 썸 → 결정적 사건 → 고백 → 연애 순으로, 누가 더 신경 쓰고 기다리고 불안해지는지 설명하세요.

## 누가 먼저 빠지는가
첫 만남 / 썸 초반 / 썸 후반 / 고백 직전 / 연애 1개월 / 3개월 / 6개월 / 1년을 나누어 각 시점마다 다음 형식을 사용하세요.
❤️ 더 좋아하는 사람:
💭 더 많이 생각하는 사람:
🔥 질투가 강한 사람:
📱 먼저 연락하는 사람:
감정 주도권이 바뀌면 이유를 설명하세요.

## 고백의 흐름
누가 먼저 고백하기 쉬운지, 썸 기간 범위, 직접/전화/메시지 가능성, 분위기, 술의 영향 가능성, 고백 전 결정적 사건을 설명하세요.

## 연애가 시작된 뒤
1개월 / 3개월 / 6개월 / 1년 단위로 연락, 전화, 데이트, 애정표현, 애교, 질투, 싸움, 스킨십, 의존도, 관계 주도권 변화를 설명하세요. 선정적 묘사는 하지 마세요.

## 가장 크게 부딪히는 이유 TOP 3
연락/술/이성친구/질투/과거연애/표현부족/돈/업무/거리/생활습관/가족/결혼 중 강한 요소 3개를 골라 실제로 싸움이 시작될 법한 현실적인 장면과 해결 포인트를 설명하세요.

## 이별과 재회 흐름
이별수가 강할 때만 누가 먼저 말하기 쉬운지, 순간 감정인지 오래 고민한 결과인지, 누가 더 오래 생각하는지, 재접촉 흐름을 설명하세요. 약하면 억지로 이별을 만들지 말고 관계 유지에서 중요한 것을 설명하세요. 과거 연인 정보가 없으면 특정 과거 인물을 만들어내지 마세요.

## 외국인·장거리 인연
같은 지역 / 타지역 / 장거리 / 외국인 / 해외 경험 많은 사람을 비교하고 가능성이 높은 순서를 설명하세요. 특정 국적을 근거 없이 찍지 마세요.

## 결혼할 사람
연애 상대와 결혼 상대가 같은 유형인지 먼저 말하고, 나이차 범위, 외모 분위기, 성격, 직업 성향, 경제관념, 생활습관, 가족 분위기, 책임감, 애정표현, 결혼관을 설명하세요.

## 결혼 후 모습
맞벌이, 돈 관리, 집안일, 주도권, 애정표현, 여행·취미, 가족 관계, 자녀에 대한 태도, 부부싸움과 화해 방식, 결혼 후 연애 감정 유지 흐름을 현실적으로 설명하세요.

## 앞으로 5년 연애 흐름
현재 연도를 기준으로 5개 연도를 각각 다음 별점으로 표시하세요.
❤️ 연애운: ★★★★★
✨ 새 인연: ★★★★★
💞 썸운: ★★★★★
💍 결혼운: ★★★★★
🔁 재회운: ★★★★★
각 연도의 핵심을 2~4문장으로 설명하고 필요하면 🔥 ❤️ 💍 ⚠️ 🔁 표시를 붙이세요.

## 앞으로 12개월
현재 달부터 12개월을 월별로 모두 보여주세요.
연애운 / 인연운 / 고백운 / 주의도를 각각 ★★★★★로 표시하고 핵심 흐름을 1~2문장으로 설명하세요. 마지막에 가장 강한 달 TOP 3를 뽑으세요.

## 인생에서 중요한 연애 시기
강한 인연, 강렬한 사랑, 연애관 변화, 결혼 상대가 들어오기 쉬운 시기, 결혼하기 좋은 시기를 정확한 단일 나이보다 현실적인 연령대 범위로 설명하세요.

## 가장 소름 돋는 7가지
앞선 전체 풀이에서 사용자에게 특히 특징적인 내용만 7개로 압축하세요. 누구에게나 맞는 표현은 빼세요.

## 최종 점사 카드
아래 형식을 반드시 사용하세요.
🔮 연애 팔자:
🔥 연애 매력도: ★★★★★
🌸 도화운: ★★★★★
💘 이성운: ★★★★★
✨ 새 인연운: ★★★★★
🔁 재회운: ★★★★★
🌍 타지역·외국인 인연운: ★★★★★
💍 결혼운: ★★★★★

미래 연인:
연상/동갑/연하:
가능성 높은 나이 차이:
외모 분위기:
성격:
말투:
연애 스타일:
직업 성향:
연락 스타일:
질투:
애교:
경제관념:

가장 강한 만남 경로:
만날 가능성이 높은 장소:
인연이 들어오기 쉬운 시기:
먼저 끌리는 사람:
먼저 연락하는 사람:
먼저 고백하는 사람:
연애 후 더 깊게 빠질 사람:

가장 잘 맞는 부분:
가장 많이 부딪히는 부분:
연애 최대 위기:
관계를 오래 유지하는 핵심:
결혼 상대 특징:
가장 강한 결혼 시기:
결혼 후 관계:

## 마지막 점사
오래 사주를 봐온 사람이 마지막으로 조용히 짚어주는 느낌의 4~7문장으로 마무리하세요. 실제 풀이 내용을 요약하되 새롭고 기억에 남는 표현을 쓰세요. 마지막 문장은 반드시 “당신의 사랑은 ‘○○○형 인연’입니다.” 형태로 끝내세요.
`;

const PREVIEW_PROMPT = `
당신은 30년 동안 연애와 인연 흐름을 상담해온 노련한 사주·점사 상담가입니다.
사용자의 [만세력 계산 데이터]를 핵심 기준으로 무료 맛보기만 제공합니다.
말투는 차분하고 묵직한 오래된 무당 느낌으로 하되, 귀신·신령과 소통한다고 주장하거나 미래를 확정하지 마세요.
전체 결론, 결혼 시기, 향후 5년·12개월 상세, 재회·고백의 상세는 무료 맛보기에서 공개하지 마세요.

반드시 아래 네 제목만 사용하세요.

## 맛보기 — 첫눈에 잡히는 연애 팔자
원국을 근거로 가장 특징적인 연애 성향 2~3가지를 4~6문장으로 풀이하세요.

## 맛보기 — 이성이 보는 매력
처음 봤을 때와 친해진 뒤의 차이를 3~5문장으로 풀이하세요.

## 맛보기 — 미래 인연 한 조각
미래 인연의 분위기, 나이차 경향, 만남 경로 가운데 일부만 4~6문장으로 보여주세요.

## 결제 후 열리는 내용
🔒 미래 연인의 상세 외모·성격·직업 성향
🔒 만남 경로 TOP 3와 첫 만남 시나리오
🔒 누가 먼저 빠지는지·고백·연애 후 감정 변화
🔒 갈등·이별·재회·장거리·외국인 인연
🔒 결혼 상대·결혼 후 모습
🔒 앞으로 5년 및 12개월 연애 흐름
🔒 인생의 중요한 연애 시기와 최종 점사 카드
`;

function loadDotEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "script-src 'self' https://js.tosspayments.com",
    "connect-src 'self' https://*.tosspayments.com https://*.toss.im",
    "frame-src https://*.tosspayments.com https://*.toss.im",
    "img-src 'self' data: https:"
  ].join('; '));
}

function sendJson(res, status, obj) {
  setSecurityHeaders(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function getIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').toString().split(',')[0].trim();
}

function rateAllowed(ip, weight = 1) {
  const now = Date.now();
  const existing = rateMap.get(ip) || [];
  const recent = existing.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length + weight > RATE_MAX) {
    rateMap.set(ip, recent);
    return false;
  }
  for (let i = 0; i < weight; i++) recent.push(now);
  rateMap.set(ip, recent);
  return true;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let data = '';
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('요청 데이터가 너무 큽니다.'));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch { reject(new Error('잘못된 요청 형식입니다.')); }
    });
    req.on('error', reject);
  });
}

function validateFortuneInput(body) {
  const required = ['gender', 'birthDate', 'calendarType', 'birthPlace'];
  for (const key of required) {
    if (!body[key] || String(body[key]).trim().length === 0) return `${key} 값이 필요합니다.`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.birthDate)) return '생년월일 형식을 확인해주세요.';
  if (!body.birthTimeUnknown && !/^\d{2}:\d{2}$/.test(String(body.birthTime || ''))) {
    return '출생시간을 입력하거나 모름을 선택해주세요.';
  }
  const year = Number(body.birthDate.slice(0, 4));
  if (year < 1800 || year > 2100) return '현재 만세력 엔진은 1800~2100년 출생정보 사용을 권장합니다.';
  return null;
}

function safe(v, max = 160) {
  return v ? String(v).trim().slice(0, max) : '미입력';
}

function koreaToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function placeLongitude(place) {
  const p = String(place || '').toLowerCase();
  const table = [
    ['서울', 126.978], ['seoul', 126.978], ['수원', 127.009], ['suwon', 127.009],
    ['인천', 126.705], ['incheon', 126.705], ['대전', 127.385], ['daejeon', 127.385],
    ['대구', 128.601], ['daegu', 128.601], ['부산', 129.076], ['busan', 129.076],
    ['울산', 129.311], ['ulsan', 129.311], ['광주', 126.853], ['gwangju', 126.853],
    ['제주', 126.531], ['jeju', 126.531], ['춘천', 127.735], ['강릉', 128.876],
    ['청주', 127.489], ['전주', 127.148], ['포항', 129.365], ['창원', 128.681]
  ];
  for (const [keyword, longitude] of table) if (p.includes(keyword)) return longitude;
  return null;
}

function calculateManse(body) {
  if (!manseryeok?.calculateFourPillars) {
    throw new Error('만세력 엔진이 설치되지 않았습니다. 프로젝트 폴더에서 npm install을 실행해주세요.');
  }

  const [year, month, day] = body.birthDate.split('-').map(Number);
  const unknown = Boolean(body.birthTimeUnknown);
  const [hour, minute] = unknown ? [12, 0] : String(body.birthTime).split(':').map(Number);
  const gender = body.gender === '남성' ? 'male' : body.gender === '여성' ? 'female' : undefined;
  const longitude = placeLongitude(body.birthPlace);

  const options = {
    year, month, day, hour, minute,
    isLunar: body.calendarType === '음력',
    isLeapMonth: body.calendarType === '음력' && Boolean(body.isLeapMonth),
    gender,
    dayBoundary: 'midnight'
  };

  if (!unknown && longitude !== null) {
    options.trueSolarTime = {
      longitude,
      applyEquationOfTime: true,
      applyHistoricalDst: true
    };
  }

  try {
    const r = manseryeok.calculateFourPillars(options);
    const pillars = r.toObject ? r.toObject() : {};
    const hanja = r.toHanjaObject ? r.toHanjaObject() : null;
    if (unknown) {
      pillars.hour = '미상';
      if (hanja) hanja.hour = '미상';
    }

    const convertedDate = body.calendarType === '음력'
      ? manseryeok.lunarToSolar?.(year, month, day, Boolean(body.isLeapMonth))
      : manseryeok.solarToLunar?.(year, month, day);

    return {
      available: true,
      pillars,
      hanja,
      dayElement: r.dayElement || null,
      dayYinYang: r.dayYinYang || null,
      tenGods: unknown && r.tenGods ? { ...r.tenGods, hour: '미상' } : (r.tenGods || null),
      voidBranches: r.voidBranches || null,
      luckPillars: r.luckPillars ? {
        forward: r.luckPillars.forward,
        startAge: r.luckPillars.startAge,
        startYears: r.luckPillars.startYears,
        startMonths: r.luckPillars.startMonths,
        startDays: r.luckPillars.startDays,
        pillars: (r.luckPillars.pillars || []).slice(0, 10).map((x) => ({
          age: x.age, korean: x.korean
        }))
      } : null,
      convertedDate: convertedDate || null,
      timeKnown: !unknown,
      timeCorrectionApplied: !unknown && longitude !== null,
      longitudeUsed: !unknown ? longitude : null,
      engine: 'manseryeok 2.x'
    };
  } catch (error) {
    throw new Error(`만세력 계산 실패: ${error.message}`);
  }
}

function buildUserInput(body, manse) {
  const birthTime = body.birthTimeUnknown ? '모름' : safe(body.birthTime);
  return `
[입력 정보]
성별: ${safe(body.gender)}
생년월일: ${safe(body.birthDate)}
양력/음력: ${safe(body.calendarType)}${body.calendarType === '음력' ? ` / 윤달: ${body.isLeapMonth ? '예' : '아니오'}` : ''}
출생시간: ${birthTime}
출생지역: ${safe(body.birthPlace)}
현재 연애상태: ${safe(body.relationshipStatus)}
현재 마음에 있는 사람: ${safe(body.hasCrush)}
최근 이별 여부: ${safe(body.recentBreakup)}
현재 기준 날짜(한국): ${koreaToday()}

[만세력 계산 데이터]
${JSON.stringify(manse, null, 2)}

위 정보를 기준으로 풀이하세요. 사용자가 입력하지 않은 실제 과거 사건을 맞힌 것처럼 꾸며내지 마세요.
`;
}

async function callOpenAI(instructions, input, maxOutputTokens, effort) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다. 맛보기 예시로 화면을 먼저 확인할 수 있습니다.');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      instructions,
      input,
      reasoning: { effort },
      max_output_tokens: maxOutputTokens
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || 'AI 분석 요청에 실패했습니다.');
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text;

  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) chunks.push(content.text);
    }
  }
  if (!chunks.length) throw new Error('분석 결과를 읽을 수 없습니다.');
  return chunks.join('\n');
}

function randomId(bytes = 12) {
  return crypto.randomBytes(bytes).toString('hex');
}

function hmac(value) {
  return crypto.createHmac('sha256', TOKEN_SECRET).update(value).digest('base64url');
}

function normalizeFortuneInput(input = {}) {
  return {
    gender: safe(input.gender, 16),
    calendarType: safe(input.calendarType, 16),
    isLeapMonth: Boolean(input.isLeapMonth),
    birthDate: safe(input.birthDate, 24),
    birthTime: safe(input.birthTime, 16),
    birthTimeUnknown: Boolean(input.birthTimeUnknown),
    birthPlace: safe(input.birthPlace, 80),
    relationshipStatus: safe(input.relationshipStatus, 40),
    hasCrush: safe(input.hasCrush, 16),
    recentBreakup: safe(input.recentBreakup, 16)
  };
}

function inputHash(input) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(normalizeFortuneInput(input)))
    .digest('hex');
}

function createAnalysisToken(analysisId, input) {
  const payload = Buffer.from(JSON.stringify({
    analysisId,
    inputHash: inputHash(input),
    exp: Date.now() + TOKEN_TTL_MS
  })).toString('base64url');
  return `${payload}.${hmac(payload)}`;
}

function verifyAnalysisToken(token, analysisId, input = null) {
  try {
    const [payload, signature] = String(token || '').split('.');
    if (!payload || !signature) return null;
    const expected = hmac(payload);
    if (signature.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.analysisId !== analysisId || Number(data.exp) <= Date.now()) return null;
    if (input && data.inputHash !== inputHash(input)) return null;
    return data;
  } catch {
    return null;
  }
}

function createOrderId(analysisId) {
  const nonce = randomId(6);
  const signature = hmac(`${analysisId}|${PRICE}|${nonce}`).slice(0, 12);
  return `YW-${analysisId}-${nonce}-${signature}`;
}

function verifyOrderId(orderId, analysisId) {
  const parts = String(orderId || '').split('-');
  if (parts.length !== 4 || parts[0] !== 'YW') return false;
  const [, embeddedAnalysisId, nonce, signature] = parts;
  if (embeddedAnalysisId !== analysisId) return false;
  const expected = hmac(`${analysisId}|${PRICE}|${nonce}`).slice(0, 12);
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function createUnlockToken(analysisId, orderId, inputHashValue) {
  const payload = Buffer.from(JSON.stringify({
    analysisId,
    orderId,
    inputHash: inputHashValue,
    exp: Date.now() + TOKEN_TTL_MS
  })).toString('base64url');
  return `${payload}.${hmac(payload)}`;
}

function verifyUnlockToken(token, analysisId, input) {
  try {
    const [payload, signature] = String(token || '').split('.');
    if (!payload || !signature) return false;
    const expected = hmac(payload);
    if (signature.length !== expected.length) return false;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return (
      data.analysisId === analysisId &&
      data.inputHash === inputHash(input) &&
      Number(data.exp) > Date.now()
    );
  } catch {
    return false;
  }
}

async function tossRequest(url, options = {}) {
  if (!TOSS_SECRET_KEY) throw new Error('TOSS_SECRET_KEY가 설정되지 않았습니다.');
  const authorization = Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64');
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Basic ${authorization}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
}

async function confirmTossPayment(paymentKey, orderId, amount) {
  const response = await tossRequest('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    body: JSON.stringify({ paymentKey, orderId, amount })
  });
  const data = await response.json();
  if (response.ok) return data;

  if (data?.code === 'ALREADY_PROCESSED_PAYMENT') {
    const lookup = await tossRequest(
      `https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}`,
      { method: 'GET' }
    );
    const existing = await lookup.json();
    if (
      lookup.ok &&
      existing.orderId === orderId &&
      Number(existing.totalAmount) === Number(amount) &&
      existing.status === 'DONE'
    ) return existing;
  }

  throw new Error(data?.message || '결제 승인에 실패했습니다.');
}

function serveStatic(req, res) {
  let requestPath = decodeURIComponent(req.url.split('?')[0]);
  if (requestPath === '/') requestPath = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, requestPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.ico': 'image/x-icon'
    };

    setSecurityHeaders(res);
    res.writeHead(200, {
      'Content-Type': types[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=300'
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/api/config') {
    return sendJson(res, 200, {
      price: PRICE,
      currency: 'KRW',
      clientKey: TOSS_CLIENT_KEY || null,
      paymentEnabled: Boolean(TOSS_CLIENT_KEY && TOSS_SECRET_KEY),
      demoPayment: PAYMENT_DEMO_MODE,
      freeTestMode: FREE_TEST_MODE,
      manseEngineReady: Boolean(manseryeok),
      model: MODEL
    });
  }

  if (req.method === 'POST' && req.url === '/api/preview') {
    const ip = getIp(req);
    if (!rateAllowed(ip, 1)) {
      return sendJson(res, 429, { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' });
    }

    try {
      const body = await readJson(req);
      const validationError = validateFortuneInput(body);
      if (validationError) return sendJson(res, 400, { error: validationError });

      const manse = calculateManse(body);
      const isFreeFull = FREE_TEST_MODE;
      const text = await callOpenAI(
        isFreeFull ? SYSTEM_PROMPT : PREVIEW_PROMPT,
        buildUserInput(body, manse),
        isFreeFull ? 12000 : 2200,
        isFreeFull ? 'medium' : 'low'
      );

      const analysisId = randomId(10);
      return sendJson(res, 200, {
        analysisId,
        analysisToken: createAnalysisToken(analysisId, body),
        text,
        manse,
        fullAccess: isFreeFull
      });
    } catch (error) {
      console.error('[preview error]', error.message);
      return sendJson(res, 500, { error: error.message || '맛보기 분석 중 오류가 발생했습니다.' });
    }
  }

  if (req.method === 'POST' && req.url === '/api/payment/order') {
    try {
      const body = await readJson(req);
      const analysisId = safe(body.analysisId, 40);
      if (!/^[a-f0-9]{16,40}$/.test(analysisId)) {
        return sendJson(res, 400, { error: '분석 ID가 올바르지 않습니다.' });
      }
      const analysis = verifyAnalysisToken(body.analysisToken, analysisId);
      if (!analysis) {
        return sendJson(res, 403, { error: '맛보기 분석 정보가 만료되었거나 올바르지 않습니다.' });
      }
      if (!TOSS_CLIENT_KEY || !TOSS_SECRET_KEY) {
        return sendJson(res, 503, { error: '실결제 키가 아직 설정되지 않았습니다.' });
      }

      return sendJson(res, 200, {
        orderId: createOrderId(analysisId),
        analysisId,
        amount: PRICE,
        currency: 'KRW',
        orderName: '연월당 연애사주 전체 풀이',
        clientKey: TOSS_CLIENT_KEY
      });
    } catch (error) {
      return sendJson(res, 500, { error: error.message || '주문 생성 실패' });
    }
  }

  if (req.method === 'POST' && req.url === '/api/payment/confirm') {
    try {
      const body = await readJson(req);
      const analysisId = safe(body.analysisId, 40);
      const orderId = safe(body.orderId, 80);
      const paymentKey = safe(body.paymentKey, 240);
      const amount = Number(body.amount);

      const analysis = verifyAnalysisToken(body.analysisToken, analysisId);
      if (!analysis) {
        return sendJson(res, 403, { error: '맛보기 분석 정보가 만료되었거나 올바르지 않습니다.' });
      }
      if (amount !== PRICE) {
        return sendJson(res, 400, { error: '결제 금액이 주문 금액과 다릅니다.' });
      }
      if (!verifyOrderId(orderId, analysisId)) {
        return sendJson(res, 400, { error: '주문 정보 검증에 실패했습니다.' });
      }

      const payment = await confirmTossPayment(paymentKey, orderId, amount);
      if (
        payment.orderId !== orderId ||
        Number(payment.totalAmount) !== PRICE ||
        payment.status !== 'DONE'
      ) {
        return sendJson(res, 400, { error: '결제 승인 결과가 주문 정보와 일치하지 않습니다.' });
      }

      return sendJson(res, 200, {
        ok: true,
        unlockToken: createUnlockToken(analysisId, orderId, analysis.inputHash)
      });
    } catch (error) {
      console.error('[payment confirm error]', error.message);
      return sendJson(res, 400, { error: error.message || '결제 승인에 실패했습니다.' });
    }
  }

  if (req.method === 'POST' && req.url === '/api/payment/demo-unlock') {
    if (!PAYMENT_DEMO_MODE) {
      return sendJson(res, 404, { error: '개발용 결제 모드가 꺼져 있습니다.' });
    }

    try {
      const body = await readJson(req);
      const analysisId = safe(body.analysisId, 40);
      if (!/^[a-f0-9]{16,40}$/.test(analysisId)) {
        return sendJson(res, 400, { error: '분석 ID가 올바르지 않습니다.' });
      }
      const analysis = verifyAnalysisToken(body.analysisToken, analysisId);
      if (!analysis) {
        return sendJson(res, 403, { error: '맛보기 분석 정보가 만료되었거나 올바르지 않습니다.' });
      }

      return sendJson(res, 200, {
        unlockToken: createUnlockToken(analysisId, `DEMO-${analysisId}`, analysis.inputHash)
      });
    } catch (error) {
      return sendJson(res, 500, { error: error.message || '개발용 잠금해제 실패' });
    }
  }

  if (req.method === 'POST' && req.url === '/api/fortune/full') {
    const ip = getIp(req);
    if (!rateAllowed(ip, 3)) {
      return sendJson(res, 429, { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' });
    }

    try {
      const body = await readJson(req);
      const analysisId = safe(body.analysisId, 40);
      const input = body.input || {};

      if (!verifyAnalysisToken(body.analysisToken, analysisId, input)) {
        return sendJson(res, 403, {
          error: '처음 생성한 사주 정보와 일치하지 않거나 맛보기 정보가 만료되었습니다.'
        });
      }
      if (!verifyUnlockToken(body.unlockToken, analysisId, input)) {
        return sendJson(res, 402, {
          error: '결제 확인이 필요하거나 전체 풀이 이용권이 만료되었습니다.'
        });
      }

      const validationError = validateFortuneInput(input);
      if (validationError) return sendJson(res, 400, { error: validationError });

      const manse = calculateManse(input);
      const text = await callOpenAI(
        SYSTEM_PROMPT,
        buildUserInput(input, manse),
        12000,
        'medium'
      );

      return sendJson(res, 200, { text, manse });
    } catch (error) {
      console.error('[full fortune error]', error.message);
      return sendJson(res, 500, {
        error: error.message || '전체 풀이 생성 중 오류가 발생했습니다.'
      });
    }
  }

  if (req.method === 'GET' && req.url === '/api/health') {
    return sendJson(res, 200, {
      ok: true,
      model: MODEL,
      apiConfigured: Boolean(process.env.OPENAI_API_KEY),
      paymentConfigured: Boolean(TOSS_CLIENT_KEY && TOSS_SECRET_KEY),
      freeTestMode: FREE_TEST_MODE,
      manseEngineReady: Boolean(manseryeok)
    });
  }

  if (req.method === 'GET') return serveStatic(req, res);
  res.writeHead(405);
  res.end('Method Not Allowed');
});

server.listen(PORT, () => {
  console.log(`연월당 서버 실행: http://localhost:${PORT}`);
  console.log(`Model: ${MODEL}`);
  console.log(`Manseryeok: ${manseryeok ? 'ready' : 'NOT installed'}`);
  console.log(`OpenAI: ${process.env.OPENAI_API_KEY ? 'configured' : 'NOT configured'}`);
  console.log(
    `Toss Payments: ${TOSS_CLIENT_KEY && TOSS_SECRET_KEY ? 'configured' : 'NOT configured'} / demo=${PAYMENT_DEMO_MODE} / freeTest=${FREE_TEST_MODE}`
  );
  if (TOKEN_SECRET === 'dev-only-change-this-secret') {
    console.warn('WARNING: 운영 전에 TOKEN_SECRET를 반드시 변경하세요.');
  }
});
