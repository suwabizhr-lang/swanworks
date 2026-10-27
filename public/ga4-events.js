(() => {
  const productsByHost = {
    'pasyatto-for-sale.com': 'pasyatto',
    'quickmarketing-pro.com': 'quima',
    'soramoto.jp': 'soramoto'
  };
  const campaignProducts = {
    pasyatto: 'pasha',
    quima: 'quima',
    soramoto: 'soramoto'
  };

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link) return;

    const destination = new URL(link.href, window.location.href);
    const product = link.dataset.ga4Product || productsByHost[destination.hostname];
    const variant = link.dataset.ga4Variant || document.body.dataset.ga4Variant;
    if (!product || !variant) return;

    if (!destination.searchParams.has('utm_source')) {
      destination.searchParams.set('utm_source', 'swanworks');
    }
    if (!destination.searchParams.has('utm_medium')) {
      destination.searchParams.set('utm_medium', 'referral');
    }
    if (!destination.searchParams.has('utm_campaign')) {
      destination.searchParams.set('utm_campaign', `normal-${campaignProducts[product]}-hp`);
    }
    link.href = destination.href;

    if (typeof window.gtag !== 'function') return;
    window.gtag('event', 'select_product', {
      variant,
      product,
      destination_url: destination.href,
      transport_type: 'beacon'
    });
  });
})();
