(() => {
  'use strict';
  const amount = document.querySelector('[data-price-start]');
  if (!amount) return;
  const number = amount.querySelector('.ofr-counter-value');
  if (!number) return;

  const from = Number(amount.dataset.priceStart);
  const to = Number(amount.dataset.priceEnd);
  const duration = Number(amount.dataset.priceDuration) || 2000;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const formatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  let observer;
  let frame = 0;
  let started = false;
  let finished = false;

  function paint(value) {
    number.textContent = formatter.format(value);
  }
  function finish(celebrate = false) {
    cancelAnimationFrame(frame);
    observer?.disconnect();
    finished = true;
    paint(to);
    amount.dataset.priceState = 'finished';
    amount.classList.add('is-finished');
    if (celebrate && !reduce.matches) amount.classList.add('is-hit');
  }
  function start() {
    if (started || finished) return;
    started = true;
    observer?.disconnect();
    if (reduce.matches) return finish();
    amount.dataset.priceState = 'running';
    const began = performance.now();
    function tick(now) {
      // Start immediately and slow down as the price approaches R$ 97.
      const progress = Math.min(1, Math.max(0, (now - began) / duration));
      const remaining = Math.pow(1 - progress, 3);
      paint(to + Math.round((from - to) * remaining));
      if (progress === 1) finish(true);
      else frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  }

  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= to) return;
  amount.classList.add('ofr-counter');
  amount.dataset.priceState = 'waiting';
  if (reduce.matches) finish();
  else {
    paint(from);
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.65)) start();
      }, { threshold: [0, 0.65] });
      observer.observe(amount);
    } else start();
  }
  reduce.addEventListener('change', () => { if (reduce.matches) finish(); });
})();
