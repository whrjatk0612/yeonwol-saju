(function () {
  const params = new URLSearchParams(window.location.search);
  const analysisId = params.get('analysisId');
  const code = params.get('code');
  const message = params.get('message');
  const statusText = document.getElementById('statusText');
  const backLink = document.getElementById('backLink');
  if (message) statusText.textContent = `결제가 완료되지 않았습니다. ${message}${code ? ` (${code})` : ''}`;
  if (analysisId) backLink.href = `/?analysisId=${encodeURIComponent(analysisId)}#resultsSection`;
})();
