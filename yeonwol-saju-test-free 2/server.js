const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

loadDotEnv();

const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';
const SPOUSE_IMAGE_ENABLED = String(process.env.SPOUSE_IMAGE_ENABLED || 'true').toLowerCase() === 'true';
const SPOUSE_IMAGE_QUALITY = process.env.SPOUSE_IMAGE_QUALITY || 'low';
const SPOUSE_IMAGE_SIZE = process.env.SPOUSE_IMAGE_SIZE || '1024x1024';
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
너는 30년 동안 한 자리에서 사람들의 연애, 인연, 혼사 흐름을 봐온 노련한 사주 상담가다.

이 결과는 글을 “작성”하는 게 아니다. 눈앞에 사람이 앉아 있고, 네가 사주 원국을 한참 들여다본 다음 실제 입으로 하나씩 말해주는 장면이다. 문장은 사람이 말하듯 길고 짧게 섞어라. 너무 반듯하게 정리하지 마라.

말투의 중심
- 기본은 자연스러운 반말이다. 다정하지만 묵직하다.
- “음…”, “가만있어 봐.”, “여기가 좀 묘하네.”, “근데 이건 그냥 넘기면 안 돼.” 같은 입말은 중요한 대목에서만 쓴다.
- 같은 어미를 반복하지 않는다. 문장 리듬을 일부러 들쭉날쭉하게 만든다.
- 설명하다가 잠깐 멈추는 느낌, 앞에서 한 말을 뒤집거나 좁혀가는 느낌을 살린다.
- 사람을 오래 봐온 상담자처럼 관계의 장면을 말한다. “연락이 늦어질 때 네가 먼저 화를 내는 게 아니라 말수가 줄어드는 식이야.”처럼 구체적으로 말한다.
- 과한 사투리, “허허”, “자네”, “그려”, 연극조 옛말투는 쓰지 않는다.

절대 쓰지 말아야 할 AI 말투
“분석해보면”, “종합적으로”, “결론적으로”, “전반적으로”, “가능성이 높습니다”, “경향이 있습니다”, “~로 해석됩니다”, “~라는 점이 특징입니다”, “사용자의 경우”, “데이터에 따르면”, “AI”, “모델”, “알고리즘”.

형식 규칙
- 마크다운 기호를 본문에 넣지 마라. 별표 두 개, 별표 세 개, 샵 기호, 백틱, 가로줄을 절대 출력하지 마라.
- 제목은 JSON의 title 필드에만 넣고, body 안에는 제목을 다시 쓰지 마라.
- body는 자연스러운 말문장과 짧은 줄바꿈만 사용한다.
- 목록이 꼭 필요하면 “첫째,” “둘째,” 정도로 말하듯 쓴다. 기계적인 불릿 나열을 최소화한다.
- 별점은 “★★★★☆”처럼 문자로만 적어도 된다.

명리 근거
입력과 함께 주어지는 만세력 계산 데이터를 실제 풀이의 중심으로 써라. 일반적인 연애 심리만 늘어놓지 마라.
필요한 곳에서만 “일지 쪽을 보면”, “배우자궁 쪽이”, “대운이 바뀌는 구간에서”, “십신 흐름이 여기서 겹쳐”처럼 근거를 한두 마디 섞는다.
출생시간이 없으면 시주를 만들어내지 마라. 데이터에 없는 살이나 신살을 있는 것처럼 말하지 마라.

미래를 말하는 방식
정확한 이름, 키, 직장명, 날짜를 맞힌다고 하지 않는다. 하지만 너무 흐리게도 말하지 마라.
“정확히 한 사람을 찍는 건 아니지만, 배우자궁 쪽을 한 사람의 인상으로 좁히면…”처럼 말한 뒤 눈매, 표정, 머리, 체형, 옷차림, 말투, 생활 습관을 하나의 사람처럼 묶어 묘사한다.
미래 배우자의 성별은 입력에 partnerGender가 있을 때만 따른다. 비어 있으면 성별이나 성적 지향을 추론하지 말고 중성적으로 묘사한다.

출력 순서
opening에는 “첫눈에 잡히는 연애 팔자”를 넣는다.
sections는 아래 제목을 정확히 이 순서대로 한 번씩 넣는다.
숨겨진 연애 본성
이성이 보는 매력
진짜 약한 이상형
미래 연인의 모습
미래 연인의 성격과 생활
미래 연인의 직업 성향 TOP 3
만남 경로 TOP 3
인연이 들어오기 전 신호
첫 만남 시나리오
감정이 깊어지는 순서
누가 먼저 빠지는가
고백의 흐름
연애가 시작된 뒤
가장 크게 부딪히는 이유 TOP 3
이별과 재회 흐름
외국인·장거리 인연
결혼할 사람
결혼 후 모습
앞으로 5년 연애 흐름
앞으로 12개월
인생에서 중요한 연애 시기
가장 소름 돋는 7가지
최종 점사 카드
closing에는 “마지막 점사”를 넣는다.

각 섹션 작성법
- 첫 문장부터 결론표처럼 쓰지 말고, 실제로 사주를 보다가 입을 여는 듯 시작한다.
- 같은 내용을 다른 섹션에서 반복하지 않는다.
- 미래 연인의 모습은 특히 시각적으로 자세히 말한다. 얼굴의 전체 인상, 눈매, 웃을 때의 변화, 헤어, 체형 범위, 옷차림, 말투와 분위기를 7~12문장으로 묘사한다.
- 누가 먼저 빠지는가는 첫 만남, 썸 초반, 썸 후반, 고백 직전, 연애 1개월, 3개월, 6개월, 1년의 흐름을 말하되, 표처럼 딱딱하게 쓰지 말고 감정의 주도권이 바뀌는 장면을 설명한다.
- 앞으로 5년과 12개월은 별점을 넣어도 되지만, 별점 뒤의 설명이 핵심이다. “좋다/나쁘다” 반복을 피한다.
- 가장 소름 돋는 7가지는 앞 내용을 단순 요약하지 말고, 원국과 시기에서 반복해서 걸리는 구체적인 패턴만 뽑는다.
- 마지막 점사는 사주책을 덮기 직전 마지막으로 해주는 말처럼 5~8문장. 마지막 문장은 반드시 “당신의 사랑은 ‘○○○형 인연’입니다.”로 끝낸다.

spouseVisual 작성법
이 값은 홈페이지에서 미래 배우자 상징 이미지를 만들 때 쓴다.
실제 미래 얼굴을 예측한다고 말하지 않는다. 사주에서 묘사한 “분위기”를 시각화하는 재료다.
description은 사람이 읽는 설명, 각 세부 필드는 이미지 생성용 특징이다.
나이는 반드시 성인 범위로 적는다.
민족, 국적, 인종은 출생지나 이름으로 추론하지 않는다.
`;

const PREVIEW_PROMPT = `
너는 30년 동안 사람의 인연과 혼사를 봐온 노련한 사주 상담가다.
무료 맛보기만 말한다. 실제 사람 앞에서 말하듯 자연스러운 반말로 하고, 보고서 말투를 쓰지 않는다.
마크다운 기호, 별표 두 개, 별표 세 개, 샵 기호, 백틱을 절대 쓰지 않는다.
“분석해보면”, “종합적으로”, “가능성이 높습니다”, “경향이 있습니다”, “사용자” 같은 표현을 쓰지 않는다.
만세력 계산 데이터를 중심으로 말하되 명리 용어는 필요한 곳에서만 짧게 끼워 넣는다.

opening 제목은 “맛보기 — 첫눈에 잡히는 연애 팔자”.
sections에는 “맛보기 — 이성이 보는 매력”, “맛보기 — 미래 인연 한 조각”, “결제 후 열리는 내용” 세 제목만 이 순서대로 넣는다.
마지막 섹션은 전체 결과에서 더 볼 수 있는 항목을 짧게 알려주되 본문을 미리 다 풀지 않는다.
closing 제목은 “맛보기 한마디”로 하고 2~3문장으로 끝낸다.
spouseVisual은 맛보기에서는 아주 짧게만 채우고 이미지 생성에는 사용하지 않는다.
`;

const SECTION_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    body: { type: 'string' },
    wide: { type: 'boolean' }
  },
  required: ['title', 'body', 'wide'],
  additionalProperties: false
};

const FORTUNE_SCHEMA = {
  type: 'object',
  properties: {
    opening: SECTION_SCHEMA,
    sections: { type: 'array', items: SECTION_SCHEMA },
    spouseVisual: {
      type: 'object',
      properties: {
        description: { type: 'string' },
        genderPresentation: { type: 'string' },
        ageRange: { type: 'string' },
        face: { type: 'string' },
        eyes: { type: 'string' },
        hair: { type: 'string' },
        build: { type: 'string' },
        fashion: { type: 'string' },
        expression: { type: 'string' },
        atmosphere: { type: 'string' },
        caption: { type: 'string' }
      },
      required: ['description','genderPresentation','ageRange','face','eyes','hair','build','fashion','expression','atmosphere','caption'],
      additionalProperties: false
    },
    closing: SECTION_SCHEMA
  },
  required: ['opening','sections','spouseVisual','closing'],
  additionalProperties: false
};

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
보고 싶은 미래 인연 성별: ${safe(body.partnerGender)}
현재 마음에 있는 사람: ${safe(body.hasCrush)}
최근 이별 여부: ${safe(body.recentBreakup)}
현재 기준 날짜(한국): ${koreaToday()}

[만세력 계산 데이터]
${JSON.stringify(manse, null, 2)}

위 정보를 기준으로 풀이하세요. 사용자가 입력하지 않은 실제 과거 사건을 맞힌 것처럼 꾸며내지 마세요.
`;
}

async function callOpenAIJson(instructions, input, maxOutputTokens, effort) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');

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
      max_output_tokens: maxOutputTokens,
      text: {
        format: {
          type: 'json_schema',
          name: 'yeonwol_love_saju',
          strict: true,
          schema: FORTUNE_SCHEMA
        }
      }
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || 'AI 점사 요청에 실패했습니다.');
  let raw = typeof data.output_text === 'string' ? data.output_text : '';
  if (!raw) {
    const chunks = [];
    for (const item of data.output || []) {
      for (const content of item.content || []) {
        if (content.type === 'output_text' && content.text) chunks.push(content.text);
      }
    }
    raw = chunks.join('');
  }
  if (!raw.trim()) throw new Error('점사 결과를 읽을 수 없습니다.');
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('점사 결과 형식을 읽지 못했습니다. 다시 시도해주세요.');
  }
}

function buildSpouseImagePrompt(fortune, input) {
  const v = fortune?.spouseVisual || {};
  const requestedGender = safe(input?.partnerGender, 30);
  const genderLine = requestedGender !== '미입력' && requestedGender !== '선택하지 않음'
    ? `User requested partner presentation: ${requestedGender}.`
    : 'Do not infer sexual orientation or a specific gender from the user\'s own gender; keep the presentation consistent with the neutral description.';
  return `
Create a photorealistic, elegant portrait of a fictional adult romantic partner as an artistic visualization inspired by a Korean saju fortune-reading narrative. This is NOT a prediction of a real future person's exact face.
${genderLine}
Adult age range: ${v.ageRange || 'adult'}.
Gender presentation: ${v.genderPresentation || 'natural and understated'}.
Face and overall impression: ${v.face || ''}.
Eyes: ${v.eyes || ''}.
Hair: ${v.hair || ''}.
Build: ${v.build || ''}.
Fashion: ${v.fashion || ''}.
Expression: ${v.expression || ''}.
Atmosphere: ${v.atmosphere || ''}.
Additional narrative: ${v.description || ''}.
Composition: chest-up portrait, natural posture, soft cinematic indoor daylight, refined but realistic styling, subtle depth of field, believable skin texture, no glamour retouching, no text, no letters, no logos, no watermark, no fortune-telling symbols in the image. Make the person clearly adult and entirely fictional.
`.trim();
}

async function generateSpouseImage(fortune, input) {
  if (!SPOUSE_IMAGE_ENABLED) return { enabled: false, dataUrl: null, error: null };
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { enabled: true, dataUrl: null, error: 'OPENAI_API_KEY가 없습니다.' };
  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt: buildSpouseImagePrompt(fortune, input),
        n: 1,
        size: SPOUSE_IMAGE_SIZE,
        quality: SPOUSE_IMAGE_QUALITY
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || '이미지 생성 요청에 실패했습니다.');
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error('이미지 데이터를 받지 못했습니다.');
    return {
      enabled: true,
      dataUrl: `data:image/png;base64,${b64}`,
      model: IMAGE_MODEL,
      error: null
    };
  } catch (error) {
    console.error('[spouse image error]', error.message);
    return { enabled: true, dataUrl: null, model: IMAGE_MODEL, error: error.message };
  }
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
    partnerGender: safe(input.partnerGender, 24),
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

function normalizeSpouseVisual(v = {}) {
  return {
    description: safe(v.description, 1800),
    genderPresentation: safe(v.genderPresentation, 160),
    ageRange: safe(v.ageRange, 120),
    face: safe(v.face, 280),
    eyes: safe(v.eyes, 220),
    hair: safe(v.hair, 220),
    build: safe(v.build, 220),
    fashion: safe(v.fashion, 280),
    expression: safe(v.expression, 220),
    atmosphere: safe(v.atmosphere, 280),
    caption: safe(v.caption, 420)
  };
}

function spouseVisualHash(v) {
  return crypto.createHash('sha256').update(JSON.stringify(normalizeSpouseVisual(v))).digest('hex');
}

function createSpouseImageToken(analysisId, input, spouseVisual) {
  const payload = Buffer.from(JSON.stringify({
    analysisId,
    inputHash: inputHash(input),
    spouseHash: spouseVisualHash(spouseVisual),
    exp: Date.now() + TOKEN_TTL_MS
  })).toString('base64url');
  return `${payload}.${hmac(payload)}`;
}

function verifySpouseImageToken(token, analysisId, input, spouseVisual) {
  try {
    const [payload, signature] = String(token || '').split('.');
    if (!payload || !signature) return false;
    const expected = hmac(payload);
    if (signature.length !== expected.length) return false;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.analysisId === analysisId &&
      data.inputHash === inputHash(input) &&
      data.spouseHash === spouseVisualHash(spouseVisual) &&
      Number(data.exp) > Date.now();
  } catch { return false; }
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
      model: MODEL,
      imageModel: IMAGE_MODEL,
      spouseImageEnabled: SPOUSE_IMAGE_ENABLED
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
      const fortune = await callOpenAIJson(
        isFreeFull ? SYSTEM_PROMPT : PREVIEW_PROMPT,
        buildUserInput(body, manse),
        isFreeFull ? 16000 : 2600,
        isFreeFull ? 'medium' : 'low'
      );
      const analysisId = randomId(10);
      const imageToken = isFreeFull ? createSpouseImageToken(analysisId, body, fortune.spouseVisual) : null;
      return sendJson(res, 200, {
        analysisId,
        analysisToken: createAnalysisToken(analysisId, body),
        fortune,
        imageToken,
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

  if (req.method === 'POST' && req.url === '/api/spouse-image') {
    const ip = getIp(req);
    if (!rateAllowed(ip, 3)) {
      return sendJson(res, 429, { error: '이미지 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' });
    }
    try {
      const body = await readJson(req);
      const analysisId = safe(body.analysisId, 40);
      const input = body.input || {};
      const spouseVisual = body.spouseVisual || {};
      if (!verifyAnalysisToken(body.analysisToken, analysisId, input)) {
        return sendJson(res, 403, { error: '사주 분석 정보가 만료되었거나 올바르지 않습니다.' });
      }
      if (!verifySpouseImageToken(body.imageToken, analysisId, input, spouseVisual)) {
        return sendJson(res, 403, { error: '배우자 이미지 생성 정보가 올바르지 않습니다.' });
      }
      const spouseImage = await generateSpouseImage({ spouseVisual }, input);
      return sendJson(res, 200, { spouseImage });
    } catch (error) {
      console.error('[spouse image route error]', error.message);
      return sendJson(res, 500, { error: error.message || '배우자 이미지 생성 중 오류가 발생했습니다.' });
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
      const fortune = await callOpenAIJson(
        SYSTEM_PROMPT,
        buildUserInput(input, manse),
        16000,
        'medium'
      );
      const imageToken = createSpouseImageToken(analysisId, input, fortune.spouseVisual);

      return sendJson(res, 200, { fortune, imageToken, manse });
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
      imageModel: IMAGE_MODEL,
      spouseImageEnabled: SPOUSE_IMAGE_ENABLED,
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
  console.log(`Spouse image: ${SPOUSE_IMAGE_ENABLED ? IMAGE_MODEL + ' / ' + SPOUSE_IMAGE_QUALITY : 'disabled'}`);
  console.log(
    `Toss Payments: ${TOSS_CLIENT_KEY && TOSS_SECRET_KEY ? 'configured' : 'NOT configured'} / demo=${PAYMENT_DEMO_MODE} / freeTest=${FREE_TEST_MODE}`
  );
  if (TOKEN_SECRET === 'dev-only-change-this-secret') {
    console.warn('WARNING: 운영 전에 TOKEN_SECRET를 반드시 변경하세요.');
  }
});
