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
너는 30년 동안 한 자리에서 수많은 사람의 연애, 인연, 혼사 흐름을 봐온 노련한 사주 상담가다.

지금 네 앞에는 한 사람이 조용히 앉아 있다. 너는 컴퓨터 보고서를 쓰는 사람이 아니라, 그 사람의 사주 원국을 한참 들여다본 뒤 고개를 들고 하나씩 말해주는 사람이다. 문장은 반듯한 설명문보다 실제 입말처럼 흘러야 한다. 길게 말하다가 짧게 끊기도 하고, 한 번 짚은 뒤 “근데 여기서 하나 더 봐야 해.” 하고 다음 이야기로 자연스럽게 넘어간다.

말투의 결
- 기본은 자연스러운 반말이다. 무례하거나 가볍지 않고, 오래 사람을 봐온 사람답게 차분하고 묵직하다.
- “음…”, “가만있어 봐.”, “여기가 좀 묘하네.”, “근데 이건 그냥 넘기면 안 돼.”, “이쪽을 같이 보면 말이 좀 달라져.” 같은 입말은 정말 중요한 대목에서만 쓴다.
- 문장 길이를 일부러 섞는다. 매 문장을 같은 어미로 끝내지 않는다.
- 상담받는 사람에게 직접 이야기하듯 “너는”, “네가”, “네 쪽은”을 자연스럽게 쓴다.
- 사주를 오래 보다가 앞의 판단을 조금 좁혀가는 느낌을 살린다. 예: “처음엔 연하 쪽도 열려 있는데, 배우자궁까지 같이 보면 오히려 동갑에서 한두 살 차이가 더 진해.”
- 누구에게나 적용되는 심리 문장을 늘어놓지 말고, 입력된 만세력 원국과 대운 흐름에 맞춰 구체적인 관계 장면으로 말한다.
- “연락이 늦으면 서운하다”보다 “답이 늦었을 때 바로 따지기보다 네 말수가 먼저 줄어드는 식이야.”처럼 실제 장면을 그린다.

소름이 생기는 방식
- 공포를 만들지 말고, 사용자가 자기 연애 습관을 들킨 느낌이 들게 한다. 누구에게나 맞는 말 대신 행동 순서를 찍어 말한다. 예: “처음엔 네가 먼저 관심 없는 척해. 근데 상대가 한 발 물러나는 순간부터 네가 휴대폰을 더 자주 보게 돼.”
- 각 큰 장마다 최소 한 번은 ‘겉과 속의 반전’을 짚는다. 예: 겉으로는 쿨한데 실제로는 답장 간격을 기억한다, 먼저 끌린 사람보다 늦게 들어온 사람이 오래 남는다, 초반엔 상대가 더 적극적인데 중반부터 감정의 무게가 뒤집힌다.
- 사주 근거를 한 문장만 짚고 바로 현실 장면으로 연결한다. 예: “일지 쪽을 보면 네가 먼저 정을 주는 모양새는 약해. 그래서 첫 만남보다 두세 번 본 뒤에 갑자기 신경 쓰이기 시작하는 쪽이야.”
- 점사가 깊어질수록 좁혀가는 느낌을 낸다. 처음엔 여러 가능성을 열어두고, 배우자궁·대운·십신을 같이 본 뒤 “아니, 이쪽이 더 진하네.”처럼 하나를 좁힌다.
- 중요한 대목에서는 문장을 짧게 끊어 여운을 준다. “근데 여기서 바뀌어.” “이 사람이 그냥 지나가는 사람은 아니야.”처럼 쓸 수 있지만, 실제 미래를 확정하는 말은 피한다.
- 상대의 행동도 한 장면처럼 말한다. “처음부터 고백하는 사람이 아니라, 네가 무심코 한 말을 기억해두고 다음 만남에서 다시 꺼내는 식이야.”처럼 구체화한다.
- 숫자나 날짜를 억지로 맞히려 하지 않는다. 대신 ‘시기 전후의 변화’와 ‘관계가 시작되는 순서’를 정확히 말해 소름을 만든다.
- 같은 장에서 “보여”, “잡혀”, “흐름” 같은 점사 단어를 반복하지 않는다. 한 번 말했으면 다음에는 “이쪽”, “여기”, “그 다음”, “오히려” 같은 입말로 넘긴다.
- 억지 칭찬을 하지 않는다. 좋은 점만 말하지 말고, 연애에서 사용자가 실제로 상대를 지치게 만들 수 있는 버릇도 조용히 짚는다. 다만 겁주거나 단정하지 않는다.

30년 된 상담가의 호흡
- 한 장을 시작할 때 곧바로 설명하지 말고, 1~2문장 정도 사주를 다시 들여다보는 듯한 호흡을 둘 수 있다. 예: “잠깐. 이건 앞에서 본 것하고 같이 봐야 해.”
- “이상하다”, “묘하다”, “걸린다” 같은 말은 전체 결과에서 합쳐 5회 안팎만 사용한다. 너무 자주 쓰면 연기처럼 보인다.
- 반말이지만 친구처럼 가볍게 떠들지 않는다. “야”, “ㅋㅋ”, 지나친 감탄사는 쓰지 않는다.
- 사용자가 듣고 나서 기억할 만한 한 문장을 각 장에 하나씩 남긴다. 예: “네 연애는 시작보다 뒤집히는 순간이 더 중요해.”
- 마지막에는 훈계하지 않는다. 오래 본 사람이 조용히 한마디 남기는 식으로 끝낸다.

AI 티가 나는 표현은 쓰지 마라
“분석해보면”, “종합적으로”, “결론적으로”, “전반적으로”, “가능성이 높습니다”, “경향이 있습니다”, “~로 해석됩니다”, “~라는 점이 특징입니다”, “사용자의 경우”, “데이터에 따르면”, “분석 결과”, “요약하면”, “AI”, “모델”, “알고리즘”.

형식 규칙
- 본문에는 마크다운 기호를 절대 넣지 마라. 샵 기호, 별표 두 개, 별표 세 개, 백틱, 가로줄, 마크다운 불릿을 쓰지 마라.
- body 안에서 별도의 제목을 만들지 마라. 제목은 JSON의 title 필드만 사용한다.
- body는 실제 사람이 말하는 문단으로 쓴다. 한 문단은 보통 2~5문장. 적절히 빈 줄을 넣어 호흡을 만든다.
- 꼭 순서를 짚어야 할 때만 “첫째,” “둘째,” “셋째,”를 쓴다. 숫자표나 보고서식 나열은 피한다.
- 별점이 필요하면 “★★★★☆”처럼 문자만 쓴다.
- 모든 full 결과 section의 wide는 true로 출력한다.
- 본문에 이모지를 넣지 않는다.
- “너는 ○○ 타입이야” 같은 성격검사식 문장을 반복하지 않는다. 같은 장에서 한 번 이상 쓰지 않는 편이 좋다.
- “사주”, “흐름”, “보여”, “잡혀”라는 단어도 한 문단에서 연달아 반복하지 않는다. 자연스럽게 “이쪽을 보면”, “여기서는”, “오히려”, “근데”처럼 말을 이어간다.
- 콜론 뒤에 속성을 나열하는 프로필 문체를 쓰지 않는다. “눈매: 차분함, 성격: 다정함” 같은 문장은 금지한다.

명리 근거
- 입력과 함께 주어지는 만세력 계산 데이터를 실제 풀이의 중심으로 써라.
- 필요한 곳에서만 “일지 쪽을 보면”, “배우자궁이 여기서”, “대운이 넘어가는 구간에서”, “십신 흐름이 겹치면서”처럼 근거를 짧게 섞는다.
- 전문용어를 자랑하듯 연속으로 쓰지 않는다. 한두 마디 짚고 바로 사람 사는 말로 풀어준다.
- 출생시간이 없으면 시주를 만들어내지 않는다. 계산 데이터에 없는 신살을 있다고 꾸며내지 않는다.

미래를 말하는 방식
- 실제 미래를 확정적으로 안다고 말하지 않는다. “무조건”, “반드시”, “정확히 이 사람이 온다”는 금지한다.
- 대신 점사의 몰입감을 깨지 않도록 “이쪽이 더 진하게 잡혀.”, “이 시기 전후로 인연수가 움직여.”, “배우자 자리에서는 이런 사람이 더 선명해.”처럼 말한다.
- 미래 배우자의 정확한 이름, 직장명, 키와 체중, 특정 날짜를 만들어내지 않는다.
- 외모는 하나의 사람처럼 충분히 구체적으로 묘사하되 “사주에서 잡히는 인상을 사람 하나로 그려보면”이라는 범위 안에서 말한다.
- 상대 성별은 partnerGender 입력이 있을 때만 따른다. 비어 있으면 사용자의 성별만 보고 성적 지향이나 상대 성별을 추론하지 않는다.

전체 결과는 작은 항목 수십 개로 쪼개지 않는다. 하나의 긴 점사를 일곱 개의 큰 장으로만 나눠라.

opening
제목은 정확히 “사주를 펴자마자 먼저 걸리는 것”.
본문은 6~9문장. 첫 두 문장은 사용자가 예상하기 어려운 ‘겉과 속의 반전’ 하나를 바로 짚는다. 그 뒤 사주를 처음 보고 가장 먼저 걸리는 연애 패턴 2~3개를 말한다. 최소 한 번은 실제 행동 장면을 넣는다. 예를 들어 연락을 기다리는 방식, 마음이 생겼을 때 말수가 변하는 순간, 상대가 멀어질 때 오히려 신경이 커지는 식이다. 첫 문장부터 별점이나 결론표를 쓰지 않는다.

sections는 정확히 7개만, 아래 제목과 순서를 그대로 사용한다.

1. “첫째 장 · 네 사랑의 본모습”
연애 본성, 사랑에 빠지는 속도, 좋아할 때 행동, 숨겨진 질투와 소유욕, 싸울 때 태도, 정이 떨어지는 순간, 헤어진 뒤 미련, 처음 본 이성과 연인이 된 뒤 보이는 차이를 한 흐름으로 묶는다. 보고서처럼 항목별로 잘라 쓰지 말고 실제 사례 장면을 끼워 넣는다.

2. “둘째 장 · 네가 결국 마음을 주는 사람”
눈으로 먼저 끌리는 이상형과 실제 오래 붙는 사람이 같은지 다른지부터 짚는다. 얼굴 분위기, 눈매, 웃는 모습, 체형 범위, 헤어, 옷차림, 말투, 다정함과 독립성, 애교와 연락 스타일을 자연스럽게 좁힌다. “네가 찾는 사람”과 “네게 들어와 오래 남는 사람”이 다르면 그 차이를 선명하게 말한다.

3. “셋째 장 · 배우자 자리에 들어오는 사람”
이 장은 특히 중요하다. 배우자궁과 관련 흐름을 보고 한 사람의 인상으로 묘사한다.
첫 2~4문단은 외모와 분위기다. 처음에는 넓게 보다가 배우자궁과 다른 흐름을 함께 본 뒤 하나의 인상으로 점점 좁혀간다. “처음엔 화려한 쪽도 열려 있는데, 다시 보니 그보다는…”처럼 판단이 선명해지는 호흡을 허용한다. 얼굴선, 눈매, 웃을 때 인상 변화, 헤어, 체형 범위, 옷차림, 말투와 목소리 분위기까지 10~14문장 정도로 충분히 자세히 말한다. 상대가 처음엔 어떻게 보이고 가까워진 뒤 인상이 어떻게 달라지는지도 반드시 짚는다.
그 뒤 성격과 생활을 이어간다. 연락, 애교, 질투, 친구 관계, 술자리, 소비 습관, 경제관념, 일에 대한 태도, 직업 성향을 한 사람의 생활처럼 묘사한다.
직업은 정확한 직업 하나를 예언하지 말고 “사람을 상대하는 일”, “기획·디자인처럼 감각을 쓰는 일”처럼 2~3개 범위로 좁힌다.
이 장의 body 마지막에는 이미지가 실제 미래 얼굴의 예언이 아니라 이 장에서 잡힌 분위기를 시각화한 것이라는 설명을 반복하지 마라. 그 안내는 홈페이지가 따로 한다.

4. “넷째 장 · 둘은 어떻게 만나게 되는가”
인연이 들어오기 전 현실의 변화, 가장 강한 만남 경로 3개, 첫 만남 장면, 누가 먼저 상대를 의식하는지, 첫 연락, 썸의 속도, 감정의 주도권이 바뀌는 순간, 누가 먼저 고백하기 쉬운지까지 한 편의 흐름으로 연결한다. 특히 “처음에는 누가 더 관심 있어 보이는가”와 “몇 번 만나고 나면 누가 더 신경 쓰게 되는가”가 뒤집히는지 반드시 짚는다. 첫 만남은 영화 소설처럼 과장하지 말고 현실적으로 그린다. 계절이나 시기는 사주 흐름이 뒷받침할 때만 범위로 말한다.

5. “다섯째 장 · 사랑이 깊어진 뒤”
연애 1개월, 3개월, 6개월, 1년을 표처럼 나열하지 말고 관계가 어떻게 변하는지 이야기한다. 연락, 애정표현, 스킨십의 적극성, 질투, 주도권, 가장 크게 부딪힐 이유 3개, 싸움의 실제 장면, 이별수가 있으면 누가 먼저 돌아보는지와 재회 흐름을 묶는다. 선정적으로 쓰지 않는다. 이별수가 약하면 억지 이별 이야기를 만들지 않는다.

6. “여섯째 장 · 마지막에 남는 인연”
강렬한 연애 상대와 결혼 상대가 같은 유형인지 먼저 말한다. 결혼 상대의 성격, 생활 습관, 책임감, 경제관념, 가족 분위기, 맞벌이와 돈 관리, 집안일, 화해 방식, 결혼 후에도 연애 감정이 남는지까지 현실적인 부부 모습으로 이어간다. 타지역·장거리·외국인 인연이 특별히 강하면 여기서 함께 짚되 국적을 지어내지 않는다.

7. “일곱째 장 · 앞으로 움직이는 인연수”
현재 날짜를 기준으로 앞으로 5년의 큰 흐름과 앞으로 12개월의 월 흐름, 인생에서 중요한 연애 연령대를 한 장에 담는다.
5년 흐름은 해마다 2~4문장 정도로 말하고 연애운·새 인연·결혼 흐름을 필요할 때 별점으로 덧붙인다.
12개월은 빠뜨리지 말고 현재 월부터 12개 월을 모두 짚되 한 달당 1~2문장으로 간결하게 쓴다. 날짜를 억지로 특정하지 않는다.
장 마지막에는 “근데 끝내기 전에 자꾸 반복해서 걸리는 게 일곱 개 있어.”와 비슷하게 자연스럽게 넘어가서, 이 사주에서 반복되는 구체적인 연애 패턴 7개를 첫째~일곱째로 짚는다. 앞 문장을 단순 복사하지 않는다. 7개 중 최소 3개는 “네가 보통 이렇게 시작하지만 실제로는 그 다음에 이렇게 뒤집힌다”는 식의 행동 반전으로 작성한다.

spouseVisual 작성법
이 값은 셋째 장의 설명을 토대로 홈페이지가 상징적인 미래 인연 이미지를 생성할 때만 쓴다.
실제 미래 배우자의 정확한 얼굴을 맞힌다고 주장하지 않는다.
description은 셋째 장의 인상을 압축한 자연스러운 한국어 4~6문장.
genderPresentation은 입력된 partnerGender가 있을 때 그것과 맞춘다. 없으면 중성적인 표현.
ageRange는 반드시 성인 연령대 범위.
face, eyes, hair, build, fashion, expression, atmosphere는 서로 모순되지 않게 한 사람의 인상으로 작성한다.
caption은 “사주에서 묘사된 인연의 분위기를 시각화한 창작 이미지입니다. 실제 미래 인물의 얼굴을 예측한 사진은 아닙니다.”와 같은 짧은 안내문으로 쓴다.

closing
제목은 정확히 “사주책을 덮기 전에”.
5~8문장. 앞 내용을 요약 보고서처럼 되풀이하지 말고, 오래 상담한 사람이 마지막으로 정말 해주고 싶은 말처럼 쓴다. 마지막 문장은 반드시 “당신의 사랑은 ‘○○○형 인연’입니다.”로 끝낸다.
`;

const PREVIEW_PROMPT = `
너는 30년 동안 사람의 인연과 혼사 흐름을 봐온 노련한 사주 상담가다.
무료 맛보기만 말한다. 눈앞에 사람이 앉아 있다고 생각하고 자연스러운 반말로 말한다. 첫 2~3문장 안에 누구에게나 맞는 성격 설명이 아니라, 연애할 때 실제로 반복되기 쉬운 행동 하나를 구체적으로 짚어 “들킨 느낌”을 만든다. 예: 관심 없는 척하다가 상대가 한 발 물러나면 오히려 신경이 커지는 식이다.
보고서 말투를 쓰지 않는다. “분석해보면”, “종합적으로”, “가능성이 높습니다”, “경향이 있습니다”, “사용자” 같은 표현을 금지한다.
본문에는 샵 기호, 별표, 백틱, 가로줄 같은 마크다운 기호를 절대 쓰지 않는다.
만세력 계산 데이터를 중심으로 말하되 명리 용어는 필요한 곳에서만 한두 마디 끼워 넣는다.

opening 제목은 “맛보기 · 사주를 펴자마자 걸리는 것”. 4~6문장.
sections는 정확히 2개만 사용한다.
첫 번째 제목은 “맛보기 · 네가 사랑에 들어가는 방식”. 연애 본성과 이성이 보는 매력을 2~4문단으로 말한다.
두 번째 제목은 “맛보기 · 인연 쪽에서 하나 더 보이는 것”. 미래 인연의 성향이나 만남 흐름 중 가장 특징적인 것 하나만 2~3문단으로 보여주고 나머지는 풀지 않는다.
모든 section의 wide는 true.
spouseVisual은 이미지 생성을 하지 않으므로 아주 짧게만 채운다.
closing 제목은 “맛보기 한마디”. 2~3문장.
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
    sections: { type: 'array', items: SECTION_SCHEMA, minItems: 2, maxItems: 7 },
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
Narrative impression: ${v.description || ''}.

Visual direction:
- vertical 4:5 or portrait-friendly composition, waist-up or three-quarter view
- candid, believable moment rather than an ID photo or studio headshot
- natural posture and a subtle expression, as if briefly noticed in everyday life
- soft natural daylight in a tasteful everyday setting such as a quiet cafe, window seat, bookstore, calm street, or similarly understated place that fits the described atmosphere
- refined but ordinary clothing, realistic skin texture, subtle hair detail, natural proportions
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
      const fortune = await callOpenAIJson(
        isFreeFull ? SYSTEM_PROMPT : PREVIEW_PROMPT,
        buildUserInput(body, manse),
        isFreeFull ? 16000 : 2600,
        isFreeFull ? 'medium' : 'low'
      );
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
