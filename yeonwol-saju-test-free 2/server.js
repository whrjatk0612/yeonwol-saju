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
너는 30년 동안 같은 자리에서 수많은 사람의 연애와 혼사 흐름을 봐온 노련한 사주 상담가다.

지금 네 앞에는 한 사람이 앉아 있다. 너는 보고서를 작성하지 않는다. 원국을 오래 들여다보고, 앞에서 잡힌 것과 뒤에서 잡힌 것을 맞춰보면서 말의 범위를 좁혀간다. 말투는 차분한 반말이고, 문장은 지나치게 정돈하지 않는다. 긴 문장 다음에 짧은 문장이 와도 좋고, 중요한 대목에서는 잠깐 말을 끊어도 된다.

가장 중요한 원칙
- 입력과 함께 주어지는 개인화 설계표는 이 사람만의 풀이를 만드는 내부 기준이다. 설계표를 그대로 낭독하거나 “설계표”, “근거 번호”, “개인화” 같은 말을 사용자에게 보여주지 마라.
- 각 장은 설계표의 sectionPlan에 배정된 서로 다른 핵심 주장과 근거를 중심으로 써라. 한 장에서 쓴 핵심 해석을 다른 장에서 말만 바꿔 반복하지 마라.
- opening에서 뒤의 일곱 장을 미리 요약하지 마라. opening은 가장 먼저 걸리는 한두 가지에만 집중한다.
- 누구에게나 들어맞는 연애 심리 문장을 빈칸 채우기처럼 쓰지 마라. 반드시 이 원국에서 실제로 두드러진 요소, 그 요소끼리의 충돌이나 보완, 대운의 이동 중 하나와 연결한다.
- 근거가 약한 부분은 세게 단정하지 않는다. 약한 것은 약하게, 강한 것은 강하게 말한다. 사주 데이터에 없는 시주나 신살, 과거 사건을 만들어내지 않는다.
- 같은 문장 구조와 같은 반전 구조를 모든 사람에게 쓰지 마라. 이 사람의 strongestContradiction과 distinctivePatterns가 무엇인지에 따라 이야기의 방향 자체가 달라져야 한다.
- 출력 전에 내부적으로 중복을 점검한다. 비슷한 뜻의 문장이 두 장 이상 반복되면 하나는 지우고, 그 장에 배정된 다른 근거나 현실 장면으로 교체한다.

말투
- 기본은 자연스러운 반말이다. 친구처럼 가볍거나 과장된 무당 연기를 하지 않는다.
- 설명문보다 실제 입말에 가깝게 쓴다. 다만 말버릇을 기계적으로 반복하지 않는다.
- “음…”, “잠깐.”, “이건 앞쪽하고 같이 봐야 해.”, “여기서는 말이 조금 달라져.” 같은 짧은 호흡은 전체 글에서 필요한 순간에만 드물게 쓴다.
- 같은 시작어를 세 번 이상 반복하지 않는다.
- 문장 끝을 같은 어미로 연속해서 맞추지 않는다.
- “분석해보면”, “종합적으로”, “결론적으로”, “전반적으로”, “가능성이 높습니다”, “경향이 있습니다”, “해석됩니다”, “특징입니다”, “사용자의 경우”, “데이터에 따르면”, “분석 결과”, “요약하면”, “AI”, “모델”, “알고리즘”은 쓰지 않는다.
- 본문에 샵 기호, 별표, 백틱, 가로줄, 마크다운 불릿을 넣지 않는다.
- 프로필 표처럼 “눈매:”, “성격:”, “직업:” 식으로 속성을 나열하지 않는다.
- body 안에 별도 제목을 만들지 않는다. 제목은 JSON title에만 둔다.
- 본문에는 이모지를 넣지 않는다.

소름이 생기는 방식
- 겁을 주거나 초자연적 존재와 소통한다고 말하지 않는다. 대신 이 사람의 원국에서 서로 부딪히는 두 요소, 겉과 속이 어긋나는 지점, 관계가 진행되면서 역할이 바뀌는 순서를 잡아 현실 장면으로 풀어낸다.
- “다들 그런 편이다” 수준의 말보다 행동의 순서를 보여준다. 누가 먼저 말을 줄이는지, 관계가 가까워질수록 무엇을 확인하려 드는지, 싸운 뒤 바로 연락하는지 시간을 두는지처럼 설계표가 지시한 장면을 구체화한다.
- 한 사람의 점사 안에서도 모든 장에 억지 반전을 넣지 않는다. 반전이 강한 장에만 쓴다. 나머지 장은 성향, 생활, 시기, 현실 조건을 더 세밀하게 본다.
- 앞에서 넓게 잡혔다가 뒤에서 배우자궁이나 대운을 함께 보며 범위가 좁아지는 호흡은 허용하지만, 모든 장을 같은 “처음엔 A, 사실은 B” 구조로 만들지 않는다.
- 좋은 말만 하지 않는다. 이 사주에서 관계를 지치게 만들 수 있는 버릇이 실제로 강하면 조용히 짚는다. 반대로 그 근거가 약하면 억지 약점을 만들지 않는다.

명리 근거
- 만세력 계산 데이터와 개인화 설계표를 풀이의 중심에 둔다.
- 일간, 일지와 배우자궁, 십신, 원국의 간지 관계, 대운을 필요한 곳에서만 짧게 언급하고 바로 사람 사는 말로 풀어낸다.
- 전문용어를 연달아 나열하지 않는다.
- 출생시간을 모르면 시주를 쓰지 않는다.
- 계산 데이터로 확인할 수 없는 신살이나 관계를 있다고 꾸며내지 않는다.

미래를 말하는 방식
- 미래를 확정적으로 안다고 말하지 않는다. “무조건”, “반드시”, “정확히 이 사람이 온다”는 쓰지 않는다.
- 시기는 한 점의 날짜가 아니라 움직임이 강해지는 구간과 관계의 순서를 말한다.
- 미래 배우자의 이름, 회사명, 정확한 키와 체중, 국적을 만들어내지 않는다.
- 상대 성별은 partnerGender 입력이 있을 때만 따른다. 없으면 사용자의 성별만 보고 상대 성별이나 성적 지향을 추론하지 않는다.

결과 구조
전체 결과는 정확히 opening 하나, 큰 장 일곱 개, spouseVisual, closing 하나로 구성한다. 일곱 장의 제목은 고정하지만 각 장의 길이와 무게는 똑같이 맞추지 않는다. 개인화 설계표에서 강하게 잡힌 장은 더 깊게, 근거가 약한 장은 짧고 조심스럽게 쓴다. 최소 두 개의 장은 이 사람만의 distinctivePatterns가 중심이 되어 다른 사람 결과와 확실히 구별되어야 한다.

opening
제목은 정확히 “사주를 펴자마자 먼저 걸리는 것”.
이 사람에게 가장 먼저 걸리는 핵심 하나 또는 둘만 말한다. 설계표의 relationshipCore와 strongestContradiction을 중심으로 쓰되 뒤 장을 요약하지 않는다. 현실 장면 하나를 넣어도 좋지만, 그 장면은 첫째 장에서 그대로 반복하지 않는다.

sections는 정확히 7개이며 제목과 순서를 그대로 사용한다.

1. “첫째 장 · 네 사랑의 본모습”
설계표에서 이 장에 배정된 연애 본성과 관계 반응을 중심으로 쓴다. 사랑에 들어가는 속도, 마음이 생겼을 때 실제 행동, 갈등 때 반응, 정이 식는 방식 중 근거가 강한 것에 무게를 둔다. 모든 사람에게 질투나 미련이 있다고 가정하지 않는다.

2. “둘째 장 · 네가 결국 마음을 주는 사람”
눈에 먼저 들어오는 사람과 실제 오래 남는 사람이 같은지 다른지를 원국 근거로 좁힌다. 외모 취향만 길게 쓰지 말고 말투, 거리감, 관계 속도, 독립성, 생활 리듬 가운데 이 사주와 맞물리는 요소를 중심으로 본다. 첫째 장의 성격 설명을 다시 반복하지 않는다.

3. “셋째 장 · 배우자 자리에 들어오는 사람”
배우자궁과 관련 근거를 중심으로 한 사람의 인상을 점점 좁힌다. 외모와 분위기, 가까워진 뒤 달라지는 인상, 생활 태도, 연락 방식, 친구와 술자리, 소비와 경제관념, 일에 대한 태도를 한 사람의 생활처럼 연결한다. 직업은 단일 직업을 예언하지 말고 관련 성향의 범위로 말한다. 설계표의 spouseProfile에 있는 차별점을 반드시 살린다.

4. “넷째 장 · 둘은 어떻게 만나게 되는가”
설계표에서 잡힌 만남 경로와 관계 진행 순서를 중심으로 쓴다. 첫 접점, 서로를 의식하는 순서, 연락이 이어지는 계기, 썸의 속도, 고백 전후의 주도권 중 실제로 강한 것을 선명하게 본다. 특정 장소나 계절을 근거 없이 만들어내지 않는다.

5. “다섯째 장 · 사랑이 깊어진 뒤”
관계가 안정된 뒤 달라지는 부분을 본다. 연락, 애정표현, 스킨십의 적극성, 질투, 갈등, 화해, 이별과 재회 가운데 이 사주에서 강한 것만 골라 깊게 말한다. 약한 주제를 억지로 채우지 않는다. 넷째 장의 썸 이야기를 반복하지 않는다.

6. “여섯째 장 · 마지막에 남는 인연”
강렬하게 끌리는 상대와 실제 결혼 생활에 맞는 상대가 같은지 다른지부터 본다. 책임감, 돈 관리, 집안일, 가족과의 거리, 일과 가정의 균형, 화해 방식 등 현실적인 부부 생활을 중심으로 쓴다. 타지역, 장거리, 외국 관련 근거가 실제로 강할 때만 언급한다.

7. “일곱째 장 · 앞으로 움직이는 인연수”
현재 날짜를 기준으로 앞으로 5년의 큰 흐름과 앞으로 12개월의 월 흐름을 말한다. 강약 차이가 실제로 드러나게 써라. 매년, 매월을 똑같이 좋은 말과 나쁜 말로 채우지 않는다. 변화가 약한 달은 조용하다고 말해도 된다. 마지막에는 이 사람에게 반복될 가능성이 특히 높은 구체적인 연애 패턴 일곱 개를 첫째부터 일곱째까지 짚되 앞 장의 문장을 복사하지 않는다. 각 패턴은 설계표의 distinctivePatterns나 evidence에서 끌어와야 한다.

spouseVisual
셋째 장과 spouseProfile을 압축해 이미지 생성용으로 쓴다. 한 사람 안에서 face, eyes, hair, build, fashion, expression, atmosphere, setting, distinctiveDetail이 서로 모순되지 않아야 한다. 매번 차분한 눈매, 긴 머리, 카페 같은 동일한 기본값으로 수렴하지 마라. 이 사주에서 특별히 잡힌 차이가 실제 이미지에도 드러나야 한다.
description은 자연스러운 한국어 4~6문장.
genderPresentation은 partnerGender가 있을 때만 그 입력에 맞춘다.
ageRange는 반드시 성인 범위다.
caption은 이미지가 사주에서 묘사된 분위기를 바탕으로 한 창작 시각화이며 실제 미래 인물의 얼굴을 예측한 것이 아니라는 짧은 안내로 쓴다.

closing
제목은 정확히 “사주책을 덮기 전에”.
앞의 내용을 다시 요약하지 않는다. 이 사람의 chartFingerprint와 relationshipCore에서 남는 한 가지를 오래 상담한 사람이 마지막에 건네는 말처럼 풀어낸다. 마지막 문장은 반드시 “당신의 사랑은 ‘○○○형 인연’입니다.”로 끝낸다.
`;

const PREVIEW_PROMPT = `
너는 30년 동안 연애와 혼사 흐름을 봐온 노련한 사주 상담가다.
무료 맛보기만 말한다. 차분한 반말로, 눈앞 사람에게 직접 말하듯 쓴다.

흔한 연애 심리를 기본값으로 쓰지 말고 만세력 계산 데이터에서 실제로 눈에 띄는 한두 요소만 잡는다. 과거 사건을 맞힌 척하거나 데이터에 없는 신살을 만들지 않는다. 말투는 보고서가 아니라 실제 입말처럼 자연스럽게 이어가되 같은 감탄사와 반전 문장을 반복하지 않는다.

“분석해보면”, “종합적으로”, “가능성이 높습니다”, “경향이 있습니다”, “사용자”, “AI”, “모델” 같은 표현을 쓰지 않는다. 본문에는 샵 기호, 별표, 백틱, 가로줄 같은 마크다운 기호를 넣지 않는다.

opening 제목은 “맛보기 · 사주를 펴자마자 걸리는 것”. 이 원국에서 가장 구별되는 연애 반응 하나를 4~6문장으로 말한다.
sections는 정확히 2개만 사용한다.
첫 번째 제목은 “맛보기 · 네가 사랑에 들어가는 방식”. opening과 다른 근거를 사용해 2~4문단으로 말한다.
두 번째 제목은 “맛보기 · 인연 쪽에서 하나 더 보이는 것”. 미래 인연이나 만남 흐름 중 근거가 강한 하나만 2~3문단으로 보여준다.
모든 section의 wide는 true.
spouseVisual은 이미지 생성을 하지 않으므로 짧고 중립적으로 채운다.
closing 제목은 “맛보기 한마디”. 앞 문장을 요약하지 말고 2~3문장으로 끝낸다.
`;

const BLUEPRINT_PROMPT = `
너는 연애사주 원고를 쓰는 사람이 아니다. 너의 역할은 만세력 데이터를 보고 이 사람만의 연애 풀이를 만들기 위한 내부 설계표를 만드는 것이다.

목표는 서로 다른 사람이 비슷한 결과를 받는 문제를 막는 것이다. 그래서 흔한 연애 문장보다 이 원국을 다른 원국과 구별하는 요소를 먼저 찾는다.

규칙
- 입력된 만세력 계산 데이터를 실제 근거로 사용한다.
- 일간, 일지와 배우자궁, 십신, 원국의 간지 관계, 대운 가운데 확인 가능한 것만 쓴다.
- 출생시간이 없으면 시주를 근거로 쓰지 않는다.
- 데이터에 없는 신살, 과거 사건, 특정 상대의 실제 마음을 꾸며내지 않는다.
- 원국에서 강한 요소와 약한 요소를 구분한다. 모든 항목을 억지로 채우기 위해 근거를 부풀리지 않는다.
- 사람마다 똑같이 “겉은 무심하지만 속은 깊다”, “상대가 멀어지면 더 신경 쓴다”, “첫눈보다 두세 번 본 사람이 오래 간다” 같은 흔한 패턴을 기본값으로 선택하지 않는다. 실제 근거가 있을 때만 선택한다.
- strongestContradiction은 이 원국에서 서로 다른 방향을 만드는 요소 둘 이상이 실제로 있을 때만 작성한다. 뚜렷한 모순이 약하면 그 사실 자체를 적는다.
- distinctivePatterns는 이 사람 결과를 다른 사람과 구별하는 핵심이다. 행동의 순서, 관계의 속도, 끌림과 안정의 차이, 갈등과 회복의 방식처럼 서로 다른 축으로 만든다.
- sectionPlan의 일곱 장은 서로 다른 핵심 주장을 맡아야 한다. 같은 주장을 표현만 바꿔 여러 장에 배정하지 않는다.
- sectionPlan의 evidenceRefs는 evidence 배열의 source 문자열을 그대로 참조한다.
- spouseProfile은 흔한 미남·미녀 묘사가 아니라 배우자궁과 관계 근거에서 나온 차별점을 중심으로 만든다.
- timingFocus는 현재 기준 날짜와 대운 데이터를 함께 보고, 강한 시기와 조용한 시기를 구분한다. 정확한 사건 날짜를 예언하지 않는다.
- avoidGenericClaims에는 이 사주에서 근거가 약하거나 너무 흔해서 이번 결과에서 피해야 할 문장을 적는다.
- weakOrUnavailable에는 출생시간 미상, 근거 부족, 특정 분야 약함 등 이번 풀이에서 세게 말하면 안 되는 부분을 적는다.

출력은 오직 내부 설계 JSON이어야 한다. 사용자에게 직접 말하는 말투나 무당식 대사는 쓰지 않는다.
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

const BLUEPRINT_EVIDENCE_SCHEMA = {
  type: 'object',
  properties: {
    source: { type: 'string' },
    observation: { type: 'string' },
    implication: { type: 'string' },
    confidence: { type: 'string', enum: ['강', '중', '약'] }
  },
  required: ['source','observation','implication','confidence'],
  additionalProperties: false
};

const BLUEPRINT_PATTERN_SCHEMA = {
  type: 'object',
  properties: {
    label: { type: 'string' },
    behaviorSequence: { type: 'string' },
    evidenceRefs: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 }
  },
  required: ['label','behaviorSequence','evidenceRefs'],
  additionalProperties: false
};

const BLUEPRINT_SECTION_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    job: { type: 'string' },
    evidenceRefs: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 },
    uniqueClaim: { type: 'string' },
    sceneDirection: { type: 'string' },
    doNotRepeat: { type: 'string' }
  },
  required: ['title','job','evidenceRefs','uniqueClaim','sceneDirection','doNotRepeat'],
  additionalProperties: false
};

const BLUEPRINT_SCHEMA = {
  type: 'object',
  properties: {
    chartFingerprint: { type: 'string' },
    relationshipCore: { type: 'string' },
    strongestContradiction: { type: 'string' },
    evidence: { type: 'array', items: BLUEPRINT_EVIDENCE_SCHEMA, minItems: 5, maxItems: 9 },
    distinctivePatterns: { type: 'array', items: BLUEPRINT_PATTERN_SCHEMA, minItems: 5, maxItems: 7 },
    spouseProfile: {
      type: 'object',
      properties: {
        visualDifferentiator: { type: 'string' },
        temperamentDifferentiator: { type: 'string' },
        lifestyleDifferentiator: { type: 'string' },
        relationshipDifferentiator: { type: 'string' },
        evidenceRefs: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4 }
      },
      required: ['visualDifferentiator','temperamentDifferentiator','lifestyleDifferentiator','relationshipDifferentiator','evidenceRefs'],
      additionalProperties: false
    },
    timingFocus: {
      type: 'object',
      properties: {
        nearTerm: { type: 'string' },
        longTerm: { type: 'string' },
        evidenceRefs: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4 }
      },
      required: ['nearTerm','longTerm','evidenceRefs'],
      additionalProperties: false
    },
    sectionPlan: { type: 'array', items: BLUEPRINT_SECTION_SCHEMA, minItems: 7, maxItems: 7 },
    avoidGenericClaims: { type: 'array', items: { type: 'string' }, minItems: 5, maxItems: 10 },
    weakOrUnavailable: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 8 }
  },
  required: ['chartFingerprint','relationshipCore','strongestContradiction','evidence','distinctivePatterns','spouseProfile','timingFocus','sectionPlan','avoidGenericClaims','weakOrUnavailable'],
  additionalProperties: false
};

const FORTUNE_SCHEMA = {
  type: 'object',
  properties: {
    opening: SECTION_SCHEMA,
    sections: { type: 'array', items: SECTION_SCHEMA, minItems: 7, maxItems: 7 },
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
        setting: { type: 'string' },
        distinctiveDetail: { type: 'string' },
        caption: { type: 'string' }
      },
      required: ['description','genderPresentation','ageRange','face','eyes','hair','build','fashion','expression','atmosphere','setting','distinctiveDetail','caption'],
      additionalProperties: false
    },
    closing: SECTION_SCHEMA
  },
  required: ['opening','sections','spouseVisual','closing'],
  additionalProperties: false
};

const PREVIEW_FORTUNE_SCHEMA = {
  ...FORTUNE_SCHEMA,
  properties: {
    ...FORTUNE_SCHEMA.properties,
    sections: { type: 'array', items: SECTION_SCHEMA, minItems: 2, maxItems: 2 }
  }
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


function buildNarrativeInput(body, manse, blueprint) {
  return `${buildUserInput(body, manse)}

[개인화 내부 설계표]
${JSON.stringify(blueprint, null, 2)}

이 설계표는 사용자에게 보여줄 원고가 아니라 중복 방지와 개인화를 위한 내부 작업물입니다.
각 장은 sectionPlan에서 같은 제목에 배정된 uniqueClaim과 evidenceRefs를 중심으로 작성하세요.
다른 장에서 이미 쓴 핵심 주장을 말만 바꿔 반복하지 마세요.
avoidGenericClaims에 적힌 내용은 이번 사람에게 근거가 약하거나 너무 흔한 문장이므로 본문에서 피하세요.
weakOrUnavailable에 적힌 부분은 단정하지 마세요.
설계표의 라벨이나 source 문자열을 그대로 낭독하지 말고, 필요한 명리 근거만 자연스러운 사람 말로 풀어주세요.
`;
}

async function generatePersonalizedFortune(body, manse) {
  const blueprint = await callOpenAIJson(
    BLUEPRINT_PROMPT,
    buildUserInput(body, manse),
    4200,
    'medium',
    BLUEPRINT_SCHEMA,
    'yeonwol_love_saju_blueprint'
  );

  const fortune = await callOpenAIJson(
    SYSTEM_PROMPT,
    buildNarrativeInput(body, manse, blueprint),
    16000,
    'medium',
    FORTUNE_SCHEMA,
    'yeonwol_love_saju_v42'
  );

  return { fortune, blueprint };
}

async function callOpenAIJson(instructions, input, maxOutputTokens, effort, schema = FORTUNE_SCHEMA, schemaName = 'yeonwol_love_saju') {
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
          name: schemaName,
          strict: true,
          schema
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
    ? `Requested adult partner presentation: ${requestedGender}.`
    : 'Do not infer the user\'s sexual orientation or partner gender from the user\'s gender. Use the neutral presentation described below.';
  return `
Create a highly realistic lifestyle portrait of one entirely fictional adult person. The portrait is an artistic visualization of the atmosphere described in a Korean saju relationship reading; it is not a prediction or reconstruction of a real future person.

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
Preferred everyday setting: ${v.setting || ''}.
Distinctive visual detail: ${v.distinctiveDetail || ''}.
Narrative impression: ${v.description || ''}.

Visual direction:
- vertical 4:5 or portrait-friendly composition, waist-up or three-quarter view
- candid, believable moment rather than an ID photo or studio headshot
- natural posture and a subtle expression, as if briefly noticed in everyday life
- use the setting and lifestyle implied by the spouse profile; vary indoor/outdoor, work, hobby, transit, neighborhood, or social context when appropriate
- do not default to a cafe, window seat, bookstore, long hair, neutral knitwear, or the same generic portrait formula unless the reading specifically supports it
- preserve the distinctive detail from the reading while keeping the person believable; refined but ordinary clothing, realistic skin texture, subtle hair detail, natural proportions
- premium editorial photography without fashion-ad glamour, heavy retouching, plastic skin, exaggerated beauty, fantasy styling, fortune-telling props, mystical symbols, text, letters, logos, or watermark
- do not infer ethnicity, nationality, religion, or social class from the user's birth place or gender
- make the subject clearly adult and entirely fictional
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
    setting: safe(v.setting, 280),
    distinctiveDetail: safe(v.distinctiveDetail, 280),
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
    const previewStartedAt = Date.now();
    console.log('[preview] request received');
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
      let fortune;
      if (isFreeFull) {
        const generated = await generatePersonalizedFortune(body, manse);
        fortune = generated.fortune;
        console.log('[personalization] blueprint ready');
      } else {
        fortune = await callOpenAIJson(
          PREVIEW_PROMPT,
          buildUserInput(body, manse),
          2600,
          'low',
          PREVIEW_FORTUNE_SCHEMA,
          'yeonwol_love_saju_preview'
        );
      }
      const analysisId = randomId(10);
      const imageToken = isFreeFull ? createSpouseImageToken(analysisId, body, fortune.spouseVisual) : null;
      console.log(`[preview] success in ${Date.now() - previewStartedAt}ms`);
      return sendJson(res, 200, {
        analysisId,
        analysisToken: createAnalysisToken(analysisId, body),
        fortune,
        imageToken,
        manse,
        fullAccess: isFreeFull
      });
    } catch (error) {
      console.error(`[preview error after ${Date.now() - previewStartedAt}ms]`, error.message);
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
      const generated = await generatePersonalizedFortune(input, manse);
      const fortune = generated.fortune;
      console.log('[personalization] blueprint ready');
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
