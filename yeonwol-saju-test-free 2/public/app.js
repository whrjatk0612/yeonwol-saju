console.info('[YEONWOL] app.js v4.3 history loaded');
window.addEventListener('error', (e) => console.error('[YEONWOL client error]', e.error || e.message));
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
const historyBtn = document.getElementById('historyBtn');
const historyCount = document.getElementById('historyCount');
const historyModal = document.getElementById('historyModal');
const historyList = document.getElementById('historyList');
const historyEmpty = document.getElementById('historyEmpty');
const historyCloseBtn = document.getElementById('historyCloseBtn');
const historyClearBtn = document.getElementById('historyClearBtn');

const state = {
  config: null,
  analysisId: null,
  analysisToken: null,
  input: null,
  widgets: null,
  paymentReady: false,
  mode: 'preview',
  imageToken: null,
  currentFortune: null,
  currentManse: null
};

const previewLoadingSteps = [
  '만세력 원국을 계산하는 중...',
  '연주·월주·일주·시주를 살펴보는 중...',
  '십신과 대운의 흐름을 정리하는 중...',
  '사주에서 먼저 걸리는 연애 흐름을 보는 중...',
  '말을 고르고 있어. 잠깐만...'
];

const fullLoadingSteps = [
  '결제 확인 완료. 전체 사주를 다시 펼치는 중...',
  '배우자 자리에서 사람의 인상을 좁혀보는 중...',
  '사주에서 잡힌 인상을 바탕으로 배우자 모습을 그리는 중...',
  '첫 만남과 감정의 흐름을 읽는 중...',
  '갈등·재회·결혼 흐름을 살펴보는 중...',
  '앞으로 움직이는 인연 시기를 짚어보는 중...',
  '사주책을 덮기 전에 마지막으로 한 번 더 보는 중...'
];

const sampleFortune = {
  opening: {
    title: '맛보기 · 사주를 펴자마자 걸리는 것',
    body: '음… 연애 쪽을 먼저 보면 마음이 움직이는 속도보다 마음 안으로 사람을 들이는 속도가 더 느려. 겉으로는 금방 친해지는 것처럼 보여도 진짜 좋아하는 건 별개야. 몇 번 더 보고, 말과 행동이 같은지 조용히 확인하는 쪽이지. 그런데 한번 안으로 들어오면 그때부터는 네가 생각한 것보다 훨씬 깊어져.',
    wide: true
  },
  sections: [
    { title: '맛보기 · 네가 사랑에 들어가는 방식', body: '처음에는 오히려 네가 덜 관심 있는 사람처럼 보일 수 있어. 마음에 들수록 말을 조금 아끼고 상대 반응을 더 보는 식이거든. 근데 친해지면 온도가 달라져. 챙길 때는 티 안 나게 챙기고, 상대가 그걸 알아차린 뒤부터 관계가 확 가까워지는 그림이 있어.', wide: true },
    { title: '맛보기 · 인연 쪽에서 하나 더 보이는 것', body: '가만있어 봐. 처음부터 화려하게 시선을 끄는 사람보다 두 번째, 세 번째 볼 때 표정이 자꾸 생각나는 사람이 더 진하게 잡혀. 완전히 낯선 자리에서 번쩍 만나는 것보다는 같은 동선이 몇 번 겹치거나, 누군가의 연결로 한 번 더 보게 되는 흐름이 자연스럽고. 여기 뒤쪽은 배우자 자리까지 같이 봐야 말이 더 선명해져.', wide: true }
  ],
  spouseVisual: {
    description: '단정하고 차분한 인상, 가까워질수록 웃는 표정이 부드러워지는 사람.',
    genderPresentation: '중성적이고 자연스러운 분위기', ageRange: '성인', face: '부드럽고 단정한 얼굴 인상', eyes: '차분한 눈매', hair: '자연스러운 헤어', build: '균형 잡힌 체형', fashion: '깔끔하고 절제된 옷차림', expression: '편안한 미소', atmosphere: '조용하고 따뜻한 분위기', caption: '사주에서 묘사된 분위기를 바탕으로 만든 상징 이미지입니다.'
  },
  closing: { title: '맛보기 한마디', body: '네 인연은 첫눈에 다 결정되는 식보다, 한 번 더 보게 되면서 마음이 붙는 쪽이 더 진해. 그래서 첫 느낌 하나만 가지고 너무 빨리 사람을 잘라내지는 마.', wide: true }
};


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
  initHistoryUI();
  await refreshHistoryCount();
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

async function runFortune(event) {
  if (event) event.preventDefault();
  if (!form.reportValidity()) return;
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
    persistAnalysis(state.analysisId, data.analysisToken, payload, data.fortune);
    state.imageToken = data.imageToken || null;
    if (state.imageToken) localStorage.setItem(storageKey(state.analysisId, 'imageToken'), state.imageToken);
    renderManse(data.manse);
    if (data.fullAccess || state.config?.freeTestMode) {
      localStorage.setItem(storageKey(state.analysisId, 'full'), JSON.stringify(data.fortune));
      renderResult(data.fortune, 'full', data.imageToken ? { enabled: true, loading: true } : null);
      paywallSection.classList.add('hidden');
      await saveCurrentReading();
      if (data.imageToken) loadSpouseImage(data.imageToken, data.fortune?.spouseVisual);
    } else {
      renderResult(data.fortune, 'preview', null);
      await preparePaywall();
    }
  } catch (error) {
    renderError(error.message);
  } finally {
    setLoading(false);
  }
}

form.addEventListener('submit', runFortune);
submitBtn.addEventListener('click', runFortune);

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
    renderResult(sampleFortune, 'sample', null);
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
  const imageToken = localStorage.getItem(storageKey(analysisId, 'imageToken'));
  state.imageToken = imageToken;

  if (!inputRaw) return;
  state.analysisId = analysisId;
  state.analysisToken = analysisToken;
  try { state.input = JSON.parse(inputRaw); } catch { return; }

  if (!unlockToken) {
    if (preview) {
      renderResult(parseStoredFortune(preview), 'preview', null);
      await preparePaywall();
    }
    return;
  }

  const cachedFull = localStorage.getItem(storageKey(analysisId, 'full'));
  if (cachedFull) {
    const cachedFortune = parseStoredFortune(cachedFull);
    const cachedImage = getCachedSpouseImage(analysisId);
    renderResult(cachedFortune, 'full', cachedImage || (imageToken ? { enabled: true, loading: true } : null));
    if (!cachedImage && imageToken) loadSpouseImage(imageToken, cachedFortune?.spouseVisual);
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
    localStorage.setItem(storageKey(state.analysisId, 'full'), JSON.stringify(data.fortune));
    state.imageToken = data.imageToken || null;
    if (state.imageToken) localStorage.setItem(storageKey(state.analysisId, 'imageToken'), state.imageToken);
    renderManse(data.manse);
    renderResult(data.fortune, 'full', data.imageToken ? { enabled: true, loading: true } : null);
    await saveCurrentReading();
    if (data.imageToken) loadSpouseImage(data.imageToken, data.fortune?.spouseVisual);
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

function persistAnalysis(analysisId, analysisToken, input, previewFortune) {
  localStorage.setItem(storageKey(analysisId, 'analysis'), analysisToken);
  localStorage.setItem(storageKey(analysisId, 'input'), JSON.stringify(input));
  localStorage.setItem(storageKey(analysisId, 'preview'), JSON.stringify(previewFortune));
}

function parseStoredFortune(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

function cacheSpouseImage(analysisId, spouseImage) {
  if (!analysisId || !spouseImage?.dataUrl) return;
  try {
    if (spouseImage.dataUrl.length < 3500000) localStorage.setItem(storageKey(analysisId, 'spouseImage'), spouseImage.dataUrl);
  } catch {}
}

function getCachedSpouseImage(analysisId) {
  try {
    const dataUrl = localStorage.getItem(storageKey(analysisId, 'spouseImage'));
    return dataUrl ? { enabled: true, dataUrl, error: null } : null;
  } catch { return null; }
}

function storageKey(analysisId, type) {
  return `yeonwol:${analysisId}:${type}`;
}


const HISTORY_DB_NAME = 'yeonwol-reading-history';
const HISTORY_DB_VERSION = 1;
const HISTORY_STORE = 'readings';
let historyDbPromise = null;

function openHistoryDB() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('이 브라우저에서는 점사 보관함을 사용할 수 없습니다.'));
  if (historyDbPromise) return historyDbPromise;
  historyDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(HISTORY_DB_NAME, HISTORY_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        const store = db.createObjectStore(HISTORY_STORE, { keyPath: 'analysisId' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('점사 보관함을 열지 못했습니다.'));
  });
  return historyDbPromise;
}

async function historyRequest(mode, handler) {
  const db = await openHistoryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, mode);
    const store = tx.objectStore(HISTORY_STORE);
    let request;
    try { request = handler(store); } catch (error) { reject(error); return; }
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error || request?.error || new Error('점사 보관함 처리에 실패했습니다.'));
    tx.onabort = () => reject(tx.error || new Error('점사 보관함 처리가 중단되었습니다.'));
  });
}

async function getSavedReadings() {
  const rows = await historyRequest('readonly', (store) => store.getAll());
  return (rows || []).sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
}

async function getSavedReading(analysisId) {
  return historyRequest('readonly', (store) => store.get(analysisId));
}

async function putSavedReading(record) {
  await historyRequest('readwrite', (store) => store.put(record));
}

async function deleteSavedReading(analysisId) {
  await historyRequest('readwrite', (store) => store.delete(analysisId));
}

async function clearSavedReadings() {
  await historyRequest('readwrite', (store) => store.clear());
}

async function saveCurrentReading(spouseImageDataUrl) {
  if (state.mode !== 'full' || !state.analysisId || !state.currentFortune || !state.input) return;
  try {
    const existing = await getSavedReading(state.analysisId);
    const cachedImage = spouseImageDataUrl || getCachedSpouseImage(state.analysisId)?.dataUrl || existing?.spouseImageDataUrl || null;
    const now = Date.now();
    await putSavedReading({
      analysisId: state.analysisId,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      input: state.input,
      manse: state.currentManse || existing?.manse || null,
      fortune: state.currentFortune,
      spouseImageDataUrl: cachedImage
    });
    await refreshHistoryCount();
  } catch (error) {
    console.warn('[YEONWOL history save]', error);
  }
}

function formatSavedDate(timestamp) {
  try {
    return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
  } catch { return ''; }
}

function formatBirthDate(value) {
  if (!value) return '생년월일 미상';
  const [y, m, d] = String(value).split('-');
  return [y, m, d].filter(Boolean).join('.');
}

function initHistoryUI() {
  if (!historyBtn || !historyModal) return;
  historyBtn.addEventListener('click', async () => {
    historyModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    await renderHistoryList();
  });
  historyCloseBtn?.addEventListener('click', closeHistoryModal);
  historyModal.addEventListener('click', (event) => {
    if (event.target === historyModal) closeHistoryModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !historyModal.classList.contains('hidden')) closeHistoryModal();
  });
  historyClearBtn?.addEventListener('click', async () => {
    const rows = await getSavedReadings();
    if (!rows.length) return;
    if (!confirm('이 브라우저에 저장된 점사 기록을 모두 삭제할까요? 삭제한 기록은 복구할 수 없습니다.')) return;
    await clearSavedReadings();
    await renderHistoryList();
    await refreshHistoryCount();
  });
  historyList?.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-history-action]');
    if (!button) return;
    const analysisId = button.dataset.analysisId;
    if (!analysisId) return;
    if (button.dataset.historyAction === 'open') {
      const record = await getSavedReading(analysisId);
      if (record) openSavedReading(record);
    }
    if (button.dataset.historyAction === 'delete') {
      if (!confirm('이 점사 기록을 삭제할까요?')) return;
      await deleteSavedReading(analysisId);
      await renderHistoryList();
      await refreshHistoryCount();
    }
  });
}

function closeHistoryModal() {
  historyModal?.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

async function refreshHistoryCount() {
  if (!historyCount) return;
  try {
    const rows = await getSavedReadings();
    historyCount.textContent = rows.length ? String(rows.length) : '';
    historyBtn?.classList.toggle('has-history', rows.length > 0);
  } catch {
    historyCount.textContent = '';
  }
}

async function renderHistoryList() {
  if (!historyList || !historyEmpty) return;
  historyList.innerHTML = '';
  try {
    const rows = await getSavedReadings();
    historyEmpty.classList.toggle('hidden', rows.length > 0);
    historyClearBtn?.classList.toggle('hidden', rows.length === 0);
    for (const record of rows) {
      const input = record.input || {};
      const item = document.createElement('article');
      item.className = 'history-item';
      const title = `${formatBirthDate(input.birthDate)} · ${input.gender || '성별 미상'}`;
      const meta = [input.birthPlace, input.relationshipStatus, formatSavedDate(record.updatedAt || record.createdAt)].filter(Boolean).join(' · ');
      item.innerHTML = `
        <div class="history-item-copy">
          <span>저장된 인연 점사</span>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(meta)}</p>
        </div>
        <div class="history-item-actions">
          <button type="button" data-history-action="open" data-analysis-id="${escapeHtml(record.analysisId)}">다시 보기</button>
          <button type="button" class="danger" data-history-action="delete" data-analysis-id="${escapeHtml(record.analysisId)}">삭제</button>
        </div>`;
      historyList.appendChild(item);
    }
  } catch (error) {
    historyEmpty.classList.remove('hidden');
    historyEmpty.innerHTML = `<strong>보관함을 열지 못했습니다.</strong><p>${escapeHtml(error.message)}</p>`;
  }
}

function openSavedReading(record) {
  state.analysisId = record.analysisId;
  state.analysisToken = null;
  state.imageToken = null;
  state.input = record.input || null;
  state.currentFortune = record.fortune || null;
  state.currentManse = record.manse || null;
  renderManse(record.manse);
  renderResult(record.fortune, 'full', record.spouseImageDataUrl ? { enabled: true, dataUrl: record.spouseImageDataUrl } : null);
  closeHistoryModal();
  const url = new URL(window.location.href);
  url.searchParams.delete('analysisId');
  url.searchParams.delete('paid');
  history.replaceState(null, '', `${url.pathname}#resultsSection`);
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

function legacySections(text) {
  const normalized = String(text || '').replace(/\r/g, '').trim();
  const lines = normalized.split('\n');
  const sections = [];
  let current = { title: '첫 점사', body: [] };
  for (const line of lines) {
    const match = line.match(/^##\s+(.+)$/);
    if (match) {
      if (current.body.join('\n').trim()) sections.push({ title: current.title, body: current.body.join('\n').trim(), wide: false });
      current = { title: match[1].trim(), body: [] };
    } else current.body.push(line);
  }
  if (current.body.join('\n').trim()) sections.push({ title: current.title, body: current.body.join('\n').trim(), wide: false });
  return sections;
}

function normalizeFortune(value) {
  if (value && typeof value === 'object' && value.opening && Array.isArray(value.sections)) return value;
  const legacy = legacySections(value);
  return {
    opening: legacy.shift() || { title: '첫 점사', body: String(value || ''), wide: true },
    sections: legacy,
    spouseVisual: null,
    closing: null
  };
}

function cleanResultText(raw) {
  return String(raw || '')
    .replace(/\*\*\*+/g, '')
    .replace(/\*\*/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/`{1,3}/g, '')
    .replace(/^[-_*]{3,}\s*$/gm, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .trim();
}

function inlineFormat(raw) {
  return escapeHtml(cleanResultText(raw))
    .replace(/(★{1,5}☆{0,5})/g, '<span class="stars">$1</span>');
}

function formatBody(raw) {
  return inlineFormat(raw).replace(/\n/g, '<br>');
}

function formatNarrativeBody(raw) {
  const text = cleanResultText(raw);
  if (!text) return '<p></p>';
  const paragraphs = text.split(/\n\s*\n+/).map((x) => x.trim()).filter(Boolean);
  return paragraphs.map((paragraph) => {
    const html = inlineFormat(paragraph).replace(/\n/g, '<br>');
    return `<p>${html}</p>`;
  }).join('');
}

function createPreviewCard(section) {
  const card = document.createElement('article');
  card.className = 'result-card wide preview-reading-card';
  card.innerHTML = `<h3>${escapeHtml(section.title || '점사')}</h3><div class="preview-reading-body">${formatNarrativeBody(section.body || '')}</div>`;
  return card;
}

function createChapterCard(section, index) {
  const card = document.createElement('article');
  card.className = 'reading-chapter';
  card.dataset.chapter = String(index + 1).padStart(2, '0');
  card.innerHTML = `
    <div class="chapter-heading">
      <span class="chapter-index">${String(index + 1).padStart(2, '0')}</span>
      <h3>${escapeHtml(section.title || '점사')}</h3>
    </div>
    <div class="chapter-body">${formatNarrativeBody(section.body || '')}</div>
  `;
  return card;
}

function createSpouseVisualBlock(spouseVisual, spouseImage) {
  if (!spouseVisual) return null;
  const block = document.createElement('section');
  block.className = 'spouse-portrait-block';
  block.id = 'spouseVisualCard';
  const caption = spouseVisual.caption || '사주에서 묘사된 인연의 분위기를 시각화한 창작 이미지입니다. 실제 미래 인물의 얼굴을 예측한 사진은 아닙니다.';
  let visual = '';
  if (spouseImage?.dataUrl) {
    visual = `<div class="spouse-image-wrap" id="spouseVisualMedia"><img src="${spouseImage.dataUrl}" alt="사주에서 묘사된 미래 인연의 분위기를 시각화한 생성 이미지"></div>`;
  } else if (spouseImage?.loading) {
    visual = `<div class="spouse-image-placeholder generating" id="spouseVisualMedia"><span>緣</span><p>가만있어 봐.<br>지금 배우자 자리에서 잡힌 인상을 한 장으로 옮기고 있어.</p></div>`;
  } else if (spouseImage?.enabled) {
    visual = `<div class="spouse-image-placeholder" id="spouseVisualMedia"><span>緣</span><p>이번에는 그림을 만들지 못했어.<br>위에 적힌 사람의 인상은 그대로 보면 돼.</p></div>`;
    if (spouseImage?.error) console.warn('[spouse image]', spouseImage.error);
  } else {
    visual = `<div class="spouse-image-placeholder"><span>緣</span><p>배우자 이미지 기능이 꺼져 있어.</p></div>`;
  }

  const tags = ['ageRange','face','eyes','hair','fashion','atmosphere']
    .map((key) => spouseVisual[key] ? `<span>${escapeHtml(spouseVisual[key])}</span>` : '')
    .join('');

  block.innerHTML = `
    <div class="spouse-portrait-head">
      <span>사주가 그린 인연의 인상</span>
      <h4>말로 잡힌 모습을 한 장으로 옮기면</h4>
      <p>위 점사에서 잡힌 얼굴 분위기와 표정, 옷차림, 전체 인상을 바탕으로 만든 상징적인 모습이야.</p>
    </div>
    <div class="spouse-portrait-layout">
      ${visual}
      <div class="spouse-portrait-note">
        <div class="spouse-visual-summary">${formatNarrativeBody(spouseVisual.description || '')}</div>
        <div class="spouse-tags">${tags}</div>
        <small>${escapeHtml(caption)}</small>
      </div>
    </div>
  `;
  return block;
}

function createClosingCard(section) {
  const card = document.createElement('article');
  card.className = 'reading-closing';
  card.innerHTML = `
    <span class="closing-kicker">마지막으로</span>
    <h3>${escapeHtml(section.title || '사주책을 덮기 전에')}</h3>
    <div class="chapter-body">${formatNarrativeBody(section.body || '')}</div>
  `;
  return card;
}

function renderResult(result, mode, spouseImage = null) {
  state.mode = mode;
  const fortune = normalizeFortune(result);
  state.currentFortune = fortune;
  resultGrid.innerHTML = '';
  resultHighlight.innerHTML = '';
  resultGrid.className = `result-grid ${mode === 'full' ? 'reading-flow' : 'preview-flow'}`;

  if (mode === 'full') {
    resultEyebrow.textContent = '연월당 · 인연 점사';
    resultTitle.textContent = '다 봤어. 이제 하나씩 말해줄게';
    paywallSection.classList.add('hidden');
  } else {
    resultEyebrow.textContent = mode === 'sample' ? '연월당 · 예시 점사' : '연월당 · 맛보기';
    resultTitle.textContent = '인연 쪽부터 먼저 조금 볼게';
  }

  const first = fortune.opening || { title: '첫 점사', body: '' };
  resultHighlight.className = `result-highlight${mode === 'full' ? ' reading-prologue' : ''}`;
  resultHighlight.innerHTML = `<span class="prologue-mark">緣</span><div><h3>${escapeHtml(first.title)}</h3><div class="prologue-body">${formatNarrativeBody(first.body)}</div></div>`;

  const sections = Array.isArray(fortune.sections) ? fortune.sections : [];
  if (mode === 'full') {
    sections.forEach((section, index) => {
      const chapter = createChapterCard(section, index);
      resultGrid.appendChild(chapter);
      if (index === 2 || /셋째 장|배우자 자리에/.test(section.title || '')) {
        const spouseBlock = createSpouseVisualBlock(fortune.spouseVisual, spouseImage);
        if (spouseBlock) chapter.appendChild(spouseBlock);
      }
    });
    if (fortune.closing?.body) resultGrid.appendChild(createClosingCard(fortune.closing));
  } else {
    for (const section of sections) resultGrid.appendChild(createPreviewCard(section));
    if (fortune.closing?.body) resultGrid.appendChild(createPreviewCard({ ...fortune.closing, wide: true }));
  }

  loadingPanel.classList.add('hidden');
  resultsSection.classList.remove('hidden');
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadSpouseImage(imageToken, spouseVisual) {
  if (!imageToken || !state.analysisId || !state.input || !spouseVisual) return;
  try {
    const response = await fetch('/api/spouse-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        analysisId: state.analysisId,
        analysisToken: state.analysisToken,
        imageToken,
        input: state.input,
        spouseVisual
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '배우자 이미지 생성에 실패했습니다.');
    const image = data.spouseImage;
    cacheSpouseImage(state.analysisId, image);
    updateSpouseImage(image);
  } catch (error) {
    updateSpouseImage({ enabled: true, dataUrl: null, error: error.message });
  }
}

function updateSpouseImage(spouseImage) {
  const media = document.getElementById('spouseVisualMedia');
  if (!media) return;
  if (spouseImage?.dataUrl) {
    media.className = 'spouse-image-wrap';
    media.innerHTML = `<img src="${spouseImage.dataUrl}" alt="사주에서 묘사된 미래 인연의 분위기를 시각화한 생성 이미지">`;
    void saveCurrentReading(spouseImage.dataUrl);
  } else {
    media.className = 'spouse-image-placeholder';
    media.innerHTML = '<span>緣</span><p>이번에는 그림을 만들지 못했어.<br>위에 적힌 사람의 인상은 그대로 보면 돼.</p>';
    if (spouseImage?.error) console.warn('[spouse image]', spouseImage.error);
  }
}

function renderManse(manse) {
  state.currentManse = manse || null;
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
