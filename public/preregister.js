(() => {
  const PRODUCTS = ['パシャっと出品', 'クイマ', 'ソラモト', '未来競馬', '株スク', 'VoiceKey', 'MIMAMORO'];
  const PAGE_PRODUCT = {
    'lp-pasha': 'パシャっと出品',
    'lp-quima': 'クイマ',
    'lp-soramoto': 'ソラモト',
    'lp-mirai-keiba': '未来競馬'
  };

  function pageSource() {
    return location.pathname.split('/').pop()?.replace(/\.html$/, '') || 'index';
  }

  function createForm() {
    const section = document.createElement('section');
    section.id = 'preregister';
    section.className = 'preregister-section';
    section.setAttribute('aria-labelledby', 'preregister-title');
    section.innerHTML = `
      <form class="preregister" data-preregister-form novalidate>
        <p class="preregister__eyebrow">EARLY ACCESS</p>
        <h2 id="preregister-title">先行案内を受け取る</h2>
        <p>気になるサービスの準備が整い次第、メールでお知らせします。</p>
        <div class="preregister__grid" data-preregister-fields>
          <label>氏名（ニックネーム可）<input name="name" type="text" autocomplete="name" maxlength="100" required></label>
          <label>メールアドレス<input name="email" type="email" autocomplete="email" maxlength="254" required></label>
          <fieldset><legend>興味のあるプロダクト（複数選択可）</legend><div class="preregister__choices" data-preregister-products></div></fieldset>
          <label class="preregister__consent"><input name="consent" type="checkbox" required><span>準備が整い次第、SWAN WORKSから一方的にご案内が届くことに同意します</span></label>
          <label class="preregister__honeypot" aria-hidden="true">Webサイト<input name="website" type="text" tabindex="-1" autocomplete="off"></label>
          <input name="source" type="hidden" value="${pageSource()}">
          <button type="submit">先行案内に登録する</button>
        </div>
        <p class="preregister__status" data-preregister-status role="status" aria-live="polite"></p>
      </form>`;
    const footer = document.querySelector('footer');
    if (footer) footer.before(section);
    else document.body.append(section);
    return section.querySelector('form');
  }

  function mount(form) {
    const productArea = form.querySelector('[data-preregister-products]');
    if (productArea && !productArea.children.length) {
      PRODUCTS.forEach((product) => {
        const label = document.createElement('label');
        label.className = 'preregister__choice';
        const checked = PAGE_PRODUCT[pageSource()] === product ? ' checked' : '';
        label.innerHTML = `<input type="checkbox" name="products" value="${product}"${checked}> <span>${product}</span>`;
        productArea.append(label);
      });
    }

    const source = form.querySelector('[name="source"]');
    if (source && !source.value) source.value = pageSource();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('[type="submit"]');
      const status = form.querySelector('[data-preregister-status]');
      if (button.disabled) return;
      button.disabled = true;
      status.textContent = '送信しています…';

      let submissionId = sessionStorage.getItem('swanworksSubmissionId');
      if (!submissionId) {
        submissionId = crypto.randomUUID();
        sessionStorage.setItem('swanworksSubmissionId', submissionId);
      }

      const data = new FormData(form);
      const payload = {
        name: data.get('name'),
        email: data.get('email'),
        products: data.getAll('products'),
        consent: data.get('consent') === 'on',
        source: data.get('source'),
        website: data.get('website'),
        submissionId
      };

      try {
        const response = await fetch('/api/preregister', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        form.classList.add('is-complete');
        form.querySelector('[data-preregister-fields]').hidden = true;
        status.textContent = 'ありがとうございます。準備が整い次第ご案内します';
      } catch (error) {
        status.textContent = error.message || '送信できませんでした。もう一度お試しください。';
        button.disabled = false;
      }
    });
  }

  let forms = [...document.querySelectorAll('[data-preregister-form]')];
  if (!forms.length) forms = [createForm()];
  forms.forEach(mount);

  document.querySelectorAll('a').forEach((link) => {
    if (link.textContent.includes('先行案内')) link.href = '#preregister';
  });
})();
