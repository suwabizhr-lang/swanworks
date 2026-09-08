(() => {
  const productsByHost = {
    'pasyatto-for-sale.com': 'pasyatto',
    'quickmarketing-pro.com': 'quima',
    'soramoto.jp': 'soramoto'
  };

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || typeof window.gtag !== 'function') return;

    const destination = new URL(link.href, window.location.href);
    const product = link.dataset.ga4Product || productsByHost[destination.hostname];
    const variant = link.dataset.ga4Variant || document.body.dataset.ga4Variant;
    if (!product || !variant) return;

    window.gtag('event', 'select_product', {
      variant,
      product,
      destination_url: destination.href,
      transport_type: 'beacon'
    });
  });
})();
