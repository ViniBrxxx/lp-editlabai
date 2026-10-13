/* Etapas do método: a barra percorre as 4 etapas em loop e acende uma por vez.
   O avanço segue o fim da animação da barra, então pausar as animações pausa tudo. */
(function () {
  var root = document.querySelector('[data-etp]');
  if (!root) return;
  var steps = Array.prototype.slice.call(root.querySelectorAll('.etp-step'));
  if (!steps.length) return;

  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var FINALE = 650, RESET = 450;
  var cur = 0, inView = false, live = false, timer = null;

  function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } }

  function paint(i) {
    clearTimer();
    root.classList.remove('etp-finale', 'etp-reset');
    steps.forEach(function (s, k) {
      s.classList.remove('is-active');
      s.classList.toggle('is-done', k < i);
    });
    void root.offsetWidth; // reinicia a animação mesmo se a etapa for a mesma
    steps[i].classList.add('is-active');
    cur = i;
  }

  function finale() {
    // Etapa 4 concluída: as quatro ficam acesas por um instante e o ciclo recomeça.
    steps.forEach(function (s) { s.classList.remove('is-active'); s.classList.add('is-done'); });
    root.classList.add('etp-finale');
    timer = setTimeout(function () {
      root.classList.add('etp-reset');
      timer = setTimeout(function () { timer = null; if (live) paint(0); }, RESET);
    }, FINALE);
  }

  function next() {
    if (cur < steps.length - 1) paint(cur + 1);
    else finale();
  }

  root.addEventListener('animationend', function (e) {
    if (!live || e.animationName !== 'etpFill') return;
    if (e.target.closest('.etp-step') === steps[cur]) next();
  });

  function syncRun() {
    var run = live && inView && !document.hidden;
    root.classList.toggle('etp-run', run);
  }

  function enable() {
    if (live) return;
    live = true;
    root.classList.add('etp-live');
    paint(0);
    syncRun();
  }

  function disable() {
    live = false;
    clearTimer();
    root.classList.remove('etp-live', 'etp-run', 'etp-finale', 'etp-reset');
    steps.forEach(function (s) { s.classList.remove('is-active', 'is-done'); });
  }

  function applyMotionPref() {
    if (reduce && reduce.matches) disable(); else enable();
  }

  // Passar o mouse (ou tocar) em uma etapa leva a barra até ela.
  steps.forEach(function (s, k) {
    s.addEventListener('pointerenter', function (e) {
      if (live && e.pointerType === 'mouse' && (k !== cur || root.classList.contains('etp-finale'))) paint(k);
    });
    s.addEventListener('click', function () { if (live) paint(k); });
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[entries.length - 1].isIntersecting;
      syncRun();
    }, { threshold: 0.2 }).observe(root);
  } else {
    inView = true;
  }
  document.addEventListener('visibilitychange', syncRun);

  if (reduce) {
    if (reduce.addEventListener) reduce.addEventListener('change', applyMotionPref);
    else if (reduce.addListener) reduce.addListener(applyMotionPref);
  }
  applyMotionPref();
})();
