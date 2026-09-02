const form = document.getElementById('sajuForm');
const loadingPanel = document.getElementById('loadingPanel');
const loadingTitle = document.getElementById('loadingTitle');
const loadingText = document.getElementById('loadingText');
const progressBar = document.getElementById('progressBar');
const resultsSection = document.getElementById('resultsSection');
const resultGrid = document.getElementById('resultGrid');
const resultHighlight = document.getElementById('resultHighlight');
const resultEyebrow = document.getElementById('resultEyebrow');
const resultTitle = document.getElementById('resultTitle');
const submitBtn = document.getElementById('submitBtn');
const submitLabel = submitBtn.querySelector('.btn-label');
const birthTime = document.getElementById('birthTime');
const birthTimeUnknown = document.getElementById('birthTimeUnknown');
const leapMonthWrap = document.getElementById('leapMonthWrap');
const isLeapMonth = document.getElementById('isLeapMonth');
const paywallSection = document.getElementById('paywallSection');
const paymentArea = document.getElementById('paymentArea');
const paymentMessage = document.getElementById('paymentMessage');
const payBtn = document.getElementById('payBtn');
const demoUnlockBtn = document.getElementById('demoUnlockBtn');
const priceText = document.getElementById('priceText');
const manseCard = document.getElementById('manseCard');
const mansePillars = document.getElementById('mansePillars');
const manseMeta = document.getElementById('manseMeta');

const state = {
  config: null,
  analysisId: null,
  analysisToken: null,
  input: null,
  widgets: null,
  paymentReady: false,
  mode: 'preview'
};

const previewLoadingSteps = [
  '만세력 원국을 계산하는 중...',
  '연주·월주·일주·시주를 살펴보는 중...',
  '십신과 대운의 흐름을 정리하는 중...',
  '연애 성향에서 가장 강한 부분을 고르는 중...',
  '무료 맛보기를 다듬는 중...'
];

const fullLoadingSteps = [
  '결제 확인 완료. 전체 사주를 다시 펼치는 중...',
  '미래 인연의 성향을 좁혀보는 중...',
  '첫 만남과 감정의 흐름을 읽는 중...',
  '갈등·재회·결혼 흐름을 살펴보는 중...',
  '앞으로 5년과 12개월 운을 정리하는 중...',
  '마지막 점사를 다듬는 중...'
];

const sampleText = `## 맛보기 — 첫눈에 잡히는 연애 팔자
음… 이 사주는 사람을 빨리 고르는 것 같아도 실제 마음은 꽤 늦게 여는 쪽이야. 첫인상보다 몇 번 더 만나면서 말투와 태도가 일관적인지를 보는 흐름이 강해. 그런데 마음 안으로 한번 들인 뒤에는 오히려 네 쪽이 관계의 온도 변화를 더 빨리 알아차리는 편이야. 겉으로는 괜찮은 척해도 연락의 빈도나 말투가 달라지면 혼자 한 번 더 생각해보는 타입으로 읽혀.

## 맛보기 — 이성이 보는 매력
처음에는 속을 쉽게 보여주지 않는 사람처럼 보이기 쉬워. 그런데 친해지고 나면 생각보다 장난기와 챙겨주는 면이 같이 나오면서 이미지가 크게 바뀌는 편이야. 이 ‘처음과 친해진 뒤의 차이’가 상대 입장에서는 오래 기억되는 매력이 되기 쉽다.

## 맛보기 — 미래 인연 한 조각
미래 인연은 아주 화려하게 존재감을 드러내는 사람보다 첫인상은 단정하고 차분한데 가까워질수록 표현이 늘어나는 타입이 더 자연스럽게 잡혀. 나이차도 크게 벌어지기보다 동갑이나 근소한 차이가 유력한 흐름이야. 만남 역시 완전한 낯선 소개팅보다 지인 연결이나 반복되는 일상 동선에서 익숙해지면서 시작되는 쪽이 조금 더 강해.

## 결제 후 열리는 내용
🔒 미래 연인의 상세 외모·성격·직업 성향
🔒 만남 경로 TOP 3와 첫 만남 시나리오
🔒 누가 먼저 빠지는지·고백·연애 후 감정 변화
🔒 갈등·이별·재회·장거리·외국인 인연
🔒 결혼 상대·결혼 후 모습
🔒 앞으로 5년 및 12개월 연애 흐름
🔒 인생의 중요한 연애 시기와 최종 점사 카드`;

init();

async function init() {
  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    state.config = await response.json();
    priceText.textContent = `${Number(state.config.price || 4900).toLocaleString('ko-KR')}원`;
    if (state.config.freeTestMode && submitLabel) submitLabel.textContent = '전체 연애사주 무료로 보기 (테스트)';
  } catch {
    state.config = { price: 4900, paymentEnabled: false, demoPayment: true, freeTestMode: true, manseEngineReady: false };
    if (submitLabel) submitLabel.textContent = '전체 연애사주 무료로 보기 (테스트)';
  }
  updateCalendarUI();
  await restorePaidAnalysis();
}

birthTimeUnknown.addEventListener('change', () => {
  birthTime.disabled = birthTimeUnknown.checked;
  if (birthTimeUnknown.checked) birthTime.value = '';
});

document.querySelectorAll('input[name="calendarType"]').forEach((input) => input.addEventListener('change', updateCalendarUI));

function updateCalendarUI() {
  const type = document.querySelector('input[name="calendarType"]:checked')?.value;
  leapMonthWrap.classList.toggle('hidden', type !== '음력');
  if (type !== '음력') isLeapMonth.checked = false;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!birthTimeUnknown.checked && !birthTime.value) {
    birthTime.focus();
    alert('출생시간을 입력하거나 “태어난 시간을 몰라요”를 체크해주세요.');
    return;
  }

  const fd = new FormData(form);
  const payload = Object.fromEntries(fd.entries());
  payload.birthTimeUnknown = birthTimeUnknown.checked;
  payload.isLeapMonth = isLeapMonth.checked;
  state.input = payload;
  state.mode = 'preview';

  const freeFull = Boolean(state.config?.freeTestMode);
  setLoading(true, freeFull ? fullLoadingSteps.map((x) => x.replace('결제 확인 완료. ', '')) : previewLoadingSteps, freeFull ? '전체 인연 점사를 준비하고 있습니다' : '무료 맛보기를 준비하고 있습니다');
  try {
    const response = await fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '맛보기 분석에 실패했습니다.');

    state.analysisId = data.analysisId;
    state.analysisToken = data.analysisToken;
    persistAnalysis(state.analysisId, data.analysisToken, payload, data.text);
    renderManse(data.manse);
    if (data.fullAccess || state.config?.freeTestMode) {
      localStorage.setItem(storageKey(state.analysisId, 'full'), data.text);
      renderResult(data.text, 'full');
      paywallSection.classList.add('hidden');
    } else {
      renderResult(data.text, 'preview');
      await preparePaywall();
    }
  } catch (error) {
    renderError(error.message);
  } finally {
    setLoading(false);
  }
});

for (const id of ['sampleTopBtn', 'sampleHeroBtn']) {
  document.getElementById(id).addEventListener('click', () => {
    state.analysisId = null;
    state.analysisToken = null;
    state.input = null;
    renderManse({
      available: true,
      pillars: { year: '병자', month: '갑오', day: '경인', hour: '임신' },
      voidBranches: ['오', '미'],
      luckPillars: { startAge: 7, forward: true }
    });
    renderResult(sampleText, 'sample');
    paywallSection.classList.remove('hidden');
    paymentArea.classList.add('hidden');
    demoUnlockBtn.classList.add('hidden');
    paymentMessage.textContent = '예시 화면입니다. 실제 생년월일을 입력하면 결제 가능한 개인 맛보기가 생성됩니다.';
  });
}

document.getElementById('restartBtn').addEventListener('click', () => {
  resultsSection.classList.add('hidden');
  document.getElementById('fortuneForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

payBtn.addEventListener('click', startPayment);
demoUnlockBtn.addEventListener('click', demoUnlock);

async function preparePaywall() {
  paywallSection.classList.remove('hidden');
  paymentMessage.textContent = '';

  if (state.config?.paymentEnabled) {
    paymentArea.classList.remove('hidden');
    try {
      await ensurePaymentWidgets();
      payBtn.disabled = false;
    } catch (error) {
      payBtn.disabled = true;
      paymentMessage.textContent = `결제창 준비 실패: ${error.message}`;
    }
  } else {
    paymentArea.classList.add('hidden');
    paymentMessage.textContent = '현재 실결제 키가 설정되지 않았습니다. .env에 토스페이먼츠 키를 넣으면 실제 결제가 활성화됩니다.';
  }

  if (state.config?.demoPayment) demoUnlockBtn.classList.remove('hidden');
  else demoUnlockBtn.classList.add('hidden');
}

async function ensurePaymentWidgets() {
  if (state.widgets && state.paymentReady) return;
  if (!window.TossPayments) throw new Error('토스페이먼츠 SDK를 불러오지 못했습니다.');
  if (!state.config?.clientKey) throw new Error('클라이언트 키가 없습니다.');

  const tossPayments = window.TossPayments(state.config.clientKey);
  state.widgets = tossPayments.widgets({ customerKey: 'ANONYMOUS' });
  await state.widgets.setAmount({ currency: 'KRW', value: Number(state.config.price) });
  await Promise.all([
    state.widgets.renderPaymentMethods({ selector: '#payment-method', variantKey: 'DEFAULT' }),
    state.widgets.renderAgreement({ selector: '#agreement', variantKey: 'AGREEMENT' })
  ]);
  state.paymentReady = true;
}

async function startPayment() {
  if (!state.analysisId || !state.input) return;
  payBtn.disabled = true;
  paymentMessage.textContent = '결제 정보를 준비하고 있습니다...';
  try {
    const response = await fetch('/api/payment/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysisId: state.analysisId, analysisToken: state.analysisToken })
    });
    const order = await response.json();
    if (!response.ok) throw new Error(order.error || '주문 생성에 실패했습니다.');

    paymentMessage.textContent = '';
    await state.widgets.requestPayment({
      orderId: order.orderId,
      orderName: order.orderName,
      successUrl: `${window.location.origin}/payment-success.html?analysisId=${encodeURIComponent(state.analysisId)}`,
      failUrl: `${window.location.origin}/payment-fail.html?analysisId=${encodeURIComponent(state.analysisId)}`
    });
  } catch (error) {
    if (error?.code === 'USER_CANCEL') paymentMessage.textContent = '결제를 취소했습니다. 원할 때 다시 진행할 수 있어요.';
    else paymentMessage.textContent = error.message || '결제창을 열지 못했습니다.';
    payBtn.disabled = false;
  }
}

async function demoUnlock() {
  if (!state.analysisId || !state.input) return;
  demoUnlockBtn.disabled = true;
  paymentMessage.textContent = '개발 모드에서 잠금을 해제하고 있습니다...';
  try {
    const response = await fetch('/api/payment/demo-unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysisId: state.analysisId, analysisToken: state.analysisToken })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '개발용 잠금해제 실패');
    localStorage.setItem(storageKey(state.analysisId, 'unlock'), data.unlockToken);
    await loadFullFortune(data.unlockToken);
  } catch (error) {
    paymentMessage.textContent = error.message;
  } finally {
    demoUnlockBtn.disabled = false;
  }
}

async function restorePaidAnalysis() {
  const params = new URLSearchParams(window.location.search);
  const analysisId = params.get('analysisId');
  if (!analysisId) return;

  const inputRaw = localStorage.getItem(storageKey(analysisId, 'input'));
  const analysisToken = localStorage.getItem(storageKey(analysisId, 'analysis'));
  const unlockToken = localStorage.getItem(storageKey(analysisId, 'unlock'));
  const preview = localStorage.getItem(storageKey(analysisId, 'preview'));

  if (!inputRaw) return;
  state.analysisId = analysisId;
  state.analysisToken = analysisToken;
  try { state.input = JSON.parse(inputRaw); } catch { return; }

  if (!unlockToken) {
    if (preview) {
      renderResult(preview, 'preview');
      await preparePaywall();
    }
    return;
  }

  const cachedFull = localStorage.getItem(storageKey(analysisId, 'full'));
  if (cachedFull) {
    renderResult(cachedFull, 'full');
    return;
  }
  await loadFullFortune(unlockToken);
}

async function loadFullFortune(unlockToken) {
  setLoading(true, fullLoadingSteps, '전체 인연 점사를 열고 있습니다');
  try {
    const response = await fetch('/api/fortune/full', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysisId: state.analysisId, analysisToken: state.analysisToken, unlockToken, input: state.input })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '전체 풀이 생성에 실패했습니다.');
    localStorage.setItem(storageKey(state.analysisId, 'full'), data.text);
    renderManse(data.manse);
    renderResult(data.text, 'full');
    const url = new URL(window.location.href);
    url.searchParams.set('analysisId', state.analysisId);
    url.searchParams.delete('paid');
    history.replaceState(null, '', `${url.pathname}${url.search}#resultsSection`);
  } catch (error) {
    renderError(error.message);
  } finally {
    setLoading(false);
  }
}

function persistAnalysis(analysisId, analysisToken, input, previewText) {
  localStorage.setItem(storageKey(analysisId, 'analysis'), analysisToken);
  localStorage.setItem(storageKey(analysisId, 'input'), JSON.stringify(input));
  localStorage.setItem(storageKey(analysisId, 'preview'), previewText);
}

function storageKey(analysisId, type) {
  return `yeonwol:${analysisId}:${type}`;
}

let loadingTimer;
function setLoading(active, steps = previewLoadingSteps, title = '인연의 흐름을 살펴보고 있습니다') {
  clearInterval(loadingTimer);
  submitBtn.disabled = active;
  if (!active) {
    loadingPanel.classList.add('hidden');
    return;
  }
  resultsSection.classList.add('hidden');
  loadingPanel.classList.remove('hidden');
  loadingTitle.textContent = title;
  let i = 0;
  loadingText.textContent = steps[0];
  progressBar.style.width = '14%';
  loadingTimer = setInterval(() => {
    i = Math.min(i + 1, steps.length - 1);
    loadingText.textContent = steps[i];
    progressBar.style.width = `${14 + (i / Math.max(1, steps.length - 1)) * 78}%`;
  }, 1800);
  loadingPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function parseSections(text) {
  const normalized = String(text || '').replace(/\r/g, '').trim();
  const lines = normalized.split('\n');
  const sections = [];
  let current = { title: '첫 점사', body: [] };
  for (const line of lines) {
    const match = line.match(/^##\s+(.+)$/);
    if (match) {
      if (current.body.join('\n').trim()) sections.push({ title: current.title, body: current.body.join('\n').trim() });
      current = { title: match[1].trim(), body: [] };
    } else current.body.push(line);
  }
  if (current.body.join('\n').trim()) sections.push({ title: current.title, body: current.body.join('\n').trim() });
  return sections;
}

function formatBody(raw) {
  return escapeHtml(raw)
    .replace(/(★{1,5}☆{0,5})/g, '<span class="stars">$1</span>')
    .replace(/^([①②③④⑤]|\d+[.)]|❤️|💭|🔥|📱|🔮|🌸|💘|✨|🔁|🌍|💍|🔒)\s*([^:\n]{0,38}:?)/gm, '<strong>$1 $2</strong>')
    .replace(/\n/g, '<br>');
}

function renderResult(text, mode) {
  state.mode = mode;
  const sections = parseSections(text);
  resultGrid.innerHTML = '';
  resultHighlight.innerHTML = '';

  if (mode === 'full') {
    resultEyebrow.textContent = 'FULL LOVE SAJU · UNLOCKED';
    resultTitle.textContent = '당신의 전체 인연을 읽었습니다';
    paywallSection.classList.add('hidden');
  } else {
    resultEyebrow.textContent = mode === 'sample' ? 'SAMPLE PREVIEW' : 'FREE PREVIEW';
    resultTitle.textContent = '당신의 인연, 먼저 조금만 보여드릴게요';
  }

  if (!sections.length) {
    resultHighlight.innerHTML = `<h3>연애 점사</h3><p>${formatBody(text)}</p>`;
  } else {
    const first = sections.shift();
    resultHighlight.innerHTML = `<h3>${escapeHtml(first.title)}</h3><p>${formatBody(first.body)}</p>`;
    sections.forEach((section) => {
      const card = document.createElement('article');
      const wide = /앞으로 12개월|앞으로 5년|최종 점사 카드|마지막 점사|누가 먼저 빠지는가|결제 후/.test(section.title);
      card.className = `result-card${wide ? ' wide' : ''}${/결제 후/.test(section.title) ? ' locked-preview-card' : ''}`;
      card.innerHTML = `<h3>${escapeHtml(section.title)}</h3><p>${formatBody(section.body)}</p>`;
      resultGrid.appendChild(card);
    });
  }

  loadingPanel.classList.add('hidden');
  resultsSection.classList.remove('hidden');
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderManse(manse) {
  if (!manse?.available) {
    manseCard.classList.add('hidden');
    return;
  }
  const p = manse.pillars || {};
  const items = [p.year, p.month, p.day, p.hour].filter(Boolean);
  mansePillars.textContent = items.join(' · ');
  const meta = [];
  if (manse.voidBranches?.length) meta.push(`공망 ${manse.voidBranches.join('·')}`);
  if (manse.luckPillars?.startAge) meta.push(`대운 시작 약 ${manse.luckPillars.startAge}세`);
  if (manse.timeCorrectionApplied) meta.push('출생지 경도·진태양시 보정 적용');
  if (!manse.timeKnown) meta.push('출생시간 미상: 시주 제외');
  manseMeta.textContent = meta.join(' · ') || '만세력 계산 완료';
  manseCard.classList.remove('hidden');
}

function renderError(message) {
  resultGrid.innerHTML = '';
  resultHighlight.innerHTML = `<div class="error-card"><h3>분석을 시작하지 못했습니다</h3><p>${escapeHtml(message)}<br><br>API 키가 아직 없다면 “맛보기 예시”로 화면을 먼저 확인할 수 있습니다.</p></div>`;
  manseCard.classList.add('hidden');
  paywallSection.classList.add('hidden');
  loadingPanel.classList.add('hidden');
  resultsSection.classList.remove('hidden');
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
}
