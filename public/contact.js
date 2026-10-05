(() => {
  const form = document.querySelector('[data-contact-form]');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    const status = form.querySelector('[data-contact-status]');
    if (button.disabled) return;
    button.disabled = true;
    status.textContent = '送信しています…';
    const data = new FormData(form);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.get('name'),
          email: data.get('email'),
          type: data.get('type'),
          message: data.get('message'),
          website: data.get('website')
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      form.reset();
      status.textContent = result.message || 'お問い合わせを受け付けました。';
    } catch (error) {
      status.textContent = error.message || '送信できませんでした。時間をおいて再度お試しください。';
    } finally {
      button.disabled = false;
    }
  });
})();
