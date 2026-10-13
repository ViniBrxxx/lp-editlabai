/* Carrossel contínuo das capas das aulas: desliza sozinho, pausa no mouse, arrasta no dedo.
   Com movimento reduzido (ou sem JavaScript) fica a fileira rolável do HTML. */
(() => {
  const rail = document.querySelector('[data-cur-rail]');
  if (!rail) return;
  const track = rail.querySelector('[data-cur-track]');
  const toggle = document.querySelector('[data-cur-toggle]');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const originals = [...track.children];
  // Sonda invisível com a largura padrão do conteúdo (.wrap do site) para achar a margem real.
  const section = rail.closest('section') || rail.parentNode;
  const probe = document.createElement('div');
  probe.className = 'wrap';
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'height:0;margin-top:0;margin-bottom:0;padding:0;overflow:hidden;visibility:hidden';
  section.appendChild(probe);

  let active = false, clones = [], setW = 0;
  let x = 0, speed = 0, raf = 0, last = 0;
  let paused = false, hover = false, visible = false;
  let drag = null, inertia = 0, resumeAt = 0;

  const baseSpeed = () => (window.innerWidth < 761 ? 30 : 38); // px por segundo

  function measure() {
    const first = originals[0], lastCard = originals[originals.length - 1];
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    setW = lastCard.offsetLeft + lastCard.offsetWidth + gap - first.offsetLeft;
  }

  // Margem do conteúdo: a primeira capa começa alinhada a ela e o esmaecimento lateral termina nela.
  function edge() {
    const e = probe.getBoundingClientRect().left - rail.getBoundingClientRect().left;
    const px = Math.max(12, Math.round(e));
    rail.style.setProperty('--cur-fade', Math.min(px, 170) + 'px');
    return px;
  }

  function wrap() {
    if (setW <= 0) return;
    while (x <= -setW) x += setW;
    while (x > 0) x -= setW;
  }

  function paint() { track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`; }

  function frame(t) {
    raf = 0;
    if (!active || !visible || document.hidden) { last = 0; return; }
    const dt = last ? Math.min(64, t - last) : 16;
    last = t;
    if (!drag) {
      const target = paused || hover || t < resumeAt ? 0 : baseSpeed();
      speed += (target - speed) * (1 - Math.exp(-dt / (target < speed ? 200 : 450)));
      if (target === 0 && speed < 0.05) speed = 0;
      x -= (speed * dt) / 1000;
      if (Math.abs(inertia) > 0.01) {
        x += inertia * dt;
        inertia *= Math.exp(-dt / 280);
      } else inertia = 0;
      if (speed || inertia) { wrap(); paint(); }
    }
    raf = requestAnimationFrame(frame);
  }

  function start() { if (!raf && active && visible && !document.hidden) raf = requestAnimationFrame(frame); }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; }

  function enable() {
    if (active) return;
    active = true;
    clones = originals.map((li) => {
      const c = li.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      c.querySelectorAll('img').forEach((img) => { img.alt = ''; });
      track.appendChild(c);
      return c;
    });
    rail.classList.add('is-marquee');
    rail.scrollLeft = 0;
    measure();
    x = edge() - setW; speed = 0; wrap(); paint();
    if (toggle) toggle.hidden = false;
    start();
  }

  function disable() {
    if (!active) return;
    active = false;
    stop();
    clones.forEach((c) => c.remove());
    clones = [];
    rail.classList.remove('is-marquee', 'is-dragging');
    rail.style.removeProperty('--cur-fade');
    track.style.transform = '';
    if (toggle) toggle.hidden = true;
  }

  function sync() { reduce.matches ? disable() : enable(); }

  // Pausa com o mouse em cima.
  rail.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hover = true; });
  rail.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hover = false; });

  // Arrastar (mouse ou dedo) com inércia ao soltar.
  rail.addEventListener('pointerdown', (e) => {
    if (!active || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, start: x, lastX: e.clientX, lastT: e.timeStamp, v: 0, moved: false, captured: false };
    inertia = 0;
  });
  rail.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved) {
      if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) {
        if (Math.abs(dy) > 10) drag = null; // gesto vertical: deixa a página rolar
        return;
      }
      drag.moved = true;
      rail.classList.add('is-dragging');
      try { rail.setPointerCapture(e.pointerId); drag.captured = true; } catch (_) {}
    }
    const dtm = Math.max(1, e.timeStamp - drag.lastT);
    drag.v = drag.v * 0.6 + ((e.clientX - drag.lastX) / dtm) * 0.4;
    drag.lastX = e.clientX; drag.lastT = e.timeStamp;
    x = drag.start + dx;
    wrap(); paint();
  });
  const endDrag = (e) => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    if (drag.moved) {
      inertia = Math.max(-2.5, Math.min(2.5, drag.v));
      speed = 0;
      resumeAt = performance.now() + (e && e.pointerType === 'mouse' ? 0 : 900);
    }
    rail.classList.remove('is-dragging');
    drag = null;
  };
  rail.addEventListener('pointerup', endDrag);
  rail.addEventListener('pointercancel', endDrag);
  rail.addEventListener('lostpointercapture', endDrag);

  // Teclado: setas movem as capas quando a faixa está em foco.
  rail.addEventListener('keydown', (e) => {
    if (!active || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    const step = originals[0].offsetWidth + (parseFloat(getComputedStyle(track).columnGap) || 0);
    inertia = (e.key === 'ArrowLeft' ? 1 : -1) * step / 280;
    resumeAt = performance.now() + 1500;
  });

  if (toggle) {
    toggle.addEventListener('click', () => {
      paused = !paused;
      toggle.setAttribute('aria-pressed', String(paused));
    });
  }

  // Só anima quando a seção está na tela; carrega as capas um pouco antes.
  if ('IntersectionObserver' in window) {
    // Começa quando boa parte da faixa já está na tela, com a AULA 01 parada na margem por um instante.
    let seen = false;
    new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        visible = en.isIntersecting && en.intersectionRatio >= 0.44;
        if (visible && !seen) { seen = true; resumeAt = performance.now() + 900; }
        visible ? start() : stop();
      });
    }, { threshold: [0, 0.45] }).observe(rail);
    new IntersectionObserver((entries, obs) => {
      if (entries.some((en) => en.isIntersecting)) {
        track.querySelectorAll('img[loading="lazy"]').forEach((img) => { img.loading = 'eager'; });
        obs.disconnect();
      }
    }, { rootMargin: '900px 0px' }).observe(rail);
  } else { visible = true; }

  document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (active) { measure(); edge(); wrap(); paint(); } }, 120); });
  track.querySelectorAll('img').forEach((img) => { if (!img.complete) img.addEventListener('load', () => { if (active) measure(); }, { once: true }); });

  if (reduce.addEventListener) reduce.addEventListener('change', sync); else if (reduce.addListener) reduce.addListener(sync);
  sync();
})();
