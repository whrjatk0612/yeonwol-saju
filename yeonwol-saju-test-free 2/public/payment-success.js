(async function () {
  const text = document.getElementById('statusText');
  const params = new URLSearchParams(window.location.search);
  const analysisId = params.get('analysisId');
  const paymentKey = params.get('paymentKey');
  const orderId = params.get('orderId');
  const amount = params.get('amount');

  if (!analysisId || !paymentKey || !orderId || !amount) {
    text.textContent = '결제 결과 정보가 부족합니다. 맛보기 화면으로 돌아가 다시 시도해주세요.';
    return;
  }

  const key = `yeonwol:${analysisId}:unlock`;
  const analysisToken = localStorage.getItem(`yeonwol:${analysisId}:analysis`);
  if (!analysisToken) {
    text.textContent = '원래 맛보기 분석 정보를 찾지 못했습니다. 같은 브라우저에서 다시 시도해주세요.';
    return;
  }
  const existing = localStorage.getItem(key);
  if (existing) {
    window.location.replace(`/?analysisId=${encodeURIComponent(analysisId)}&paid=1#resultsSection`);
    return;
  }

  try {
    const response = await fetch('/api/payment/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysisId, analysisToken, paymentKey, orderId, amount: Number(amount) })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '결제 승인 실패');
    localStorage.setItem(key, data.unlockToken);
    text.textContent = '결제가 확인되었습니다. 전체 점사를 열고 있습니다...';
    window.location.replace(`/?analysisId=${encodeURIComponent(analysisId)}&paid=1#resultsSection`);
  } catch (error) {
    text.textContent = `결제 승인 확인 중 문제가 발생했습니다: ${error.message}`;
  }
})();
