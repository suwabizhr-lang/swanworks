const GA4_ID_PATTERN = /^G-[A-Z0-9]{10}$/i;

function normalizeMeasurementId(value) {
  const measurementId = String(value || '').trim().toUpperCase();
  return GA4_ID_PATTERN.test(measurementId) ? measurementId : '';
}

function injectGa4(html, measurementId) {
  const safeId = normalizeMeasurementId(measurementId);
  if (!safeId) return html;

  const tag = `<script async src="https://www.googletagmanager.com/gtag/js?id=${safeId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${safeId}');
</script>`;

  return html.replace('</head>', `${tag}\n</head>`);
}

module.exports = { injectGa4, normalizeMeasurementId };
