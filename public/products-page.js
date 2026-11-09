(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SwanworksProductsPage = api;
  if (root.document) root.document.addEventListener('DOMContentLoaded', api.init);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign'];
  const defaults = {
    utm_source: 'swanworks',
    utm_medium: 'referral',
    utm_campaign: 'normal-swanworks-hub'
  };

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
  }

  function productUrl(product, pageUrl) {
    const destination = new URL(product.lpUrl);
    const incoming = new URL(pageUrl, 'https://swanworks.jp/products');
    for (const key of UTM_KEYS) destination.searchParams.set(key, incoming.searchParams.get(key) || defaults[key]);
    destination.searchParams.set('utm_content', product.id);
    return destination.href;
  }

  function activeProducts(products) {
    return products.filter((product) => product.status === '販売中');
  }

  function renderProductCards(products, pageUrl) {
    return activeProducts(products).map((product) => {
      const id = escapeHtml(product.id);
      const href = escapeHtml(productUrl(product, pageUrl));
      return `<article class="product-card" data-product-id="${id}">
        <div class="product-logo"><img src="${escapeHtml(product.logo)}" alt="${escapeHtml(product.name)} ロゴ"></div>
        <div class="product-copy"><h2>${escapeHtml(product.name)}</h2><p>${escapeHtml(product.tagline)}</p><p class="audience"><strong>対象</strong>${escapeHtml(product.audience)}</p></div>
        <a class="product-cta" href="${href}" target="_blank" rel="noopener" data-product-link data-ga4-product="${id}" data-ga4-variant="products-hub"><span>無料で試す</span></a>
        <p class="product-error" data-product-error role="status" aria-live="polite" hidden></p>
      </article>`;
    }).join('');
  }

  function resetLink(link) {
    link.dataset.opening = '';
    link.removeAttribute('aria-disabled');
    link.querySelector('span').textContent = '無料で試す';
  }

  function handleProductClick(event) {
    const link = event.target.closest('[data-product-link]');
    if (!link) return;
    event.preventDefault();
    if (link.dataset.opening === 'true') return;

    link.dataset.opening = 'true';
    link.setAttribute('aria-disabled', 'true');
    link.querySelector('span').textContent = '開いています…';
    const error = link.parentElement.querySelector('[data-product-error]');
    error.hidden = true;
    let opened = null;
    try { opened = root.open('', '_blank'); } catch (_error) { opened = null; }
    if (!opened) {
      error.innerHTML = `新しいタブを開けませんでした。ポップアップの許可後にリンクをもう一度押すか、<a href="${escapeHtml(link.href)}">こちらのURLを開いてください</a>。`;
      error.hidden = false;
      resetLink(link);
      return;
    }
    opened.opener = null;
    opened.location.href = link.href;
    root.setTimeout(() => resetLink(link), 2000);
  }

  function init() {
    const list = root.document.querySelector('[data-product-list]');
    if (!list || !Array.isArray(root.SWANWORKS_PRODUCTS)) return;
    list.innerHTML = renderProductCards(root.SWANWORKS_PRODUCTS, root.location.href);

    if (typeof root.gtag === 'function') root.gtag('event', 'view_product_list', { list_id: 'products-hub' });

    list.addEventListener('click', handleProductClick);

    root.addEventListener('pageshow', () => list.querySelectorAll('[data-product-link]').forEach(resetLink));
  }

  return { activeProducts, productUrl, renderProductCards, handleProductClick, init };
});
