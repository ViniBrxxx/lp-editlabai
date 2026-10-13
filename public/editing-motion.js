/* Editor IA: animação determinística da IA editando sozinha, em loop.
   Você digita o pedido -> a IA retira o silêncio -> aproxima os trechos -> insere as legendas -> pronto.
   Sem rede e sem dependências. Pausa fora da tela e respeita movimento reduzido. */
(() => {
  'use strict';
  const roots = [...document.querySelectorAll('[data-edit-machine].eia')];
  if (!roots.length) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const prog = (t, s, e) => clamp((t - s) / (e - s));
  const lerp = (a, b, k) => a + (b - a) * k;
  const inOut = x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const out = x => 1 - Math.pow(1 - x, 3);
  const back = x => (x <= 0 ? 0 : 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2));

  // Linha do tempo do ciclo (s). O pedido é digitado em [TYPE_A, TYPE_B]; a edição começa em OFF.
  const TYPE_A = .08, TYPE_B = .62, SEND = .62, OFF = .7;
  const LOOP = 12.9;        // duração total do ciclo
  const OUT_A = 12.35, OUT_B = 12.8; // a cena some antes de recomeçar
  const STILL = 8.35 + OFF; // quadro usado com movimento reduzido

  // Geometria (% da faixa): silêncio de 5,0 s a 6,6 s num vídeo de 12 s.
  const S0 = 41.667, GAP = 13.333, S1 = S0 + GAP;
  const END = 100 - GAP;
  const CAP = [[.6, 30.2], [31.4, 55.4], [56.6, 86]];
  const CUT1 = (CAP[0][1] + CAP[1][0]) / 2, CUT2 = (CAP[1][1] + CAP[2][0]) / 2; // pausas entre as falas
  const CAP_T = [5.35, 6.03, 6.71];
  const CAP_D = .6;
  const STATUS = [
    'IA lendo o seu pedido',
    'IA analisando o áudio',
    'Silêncio encontrado: 1,6 s',
    'IA retirando o silêncio',
    'IA aproximando os trechos',
    'IA inserindo as legendas',
    'Pronto: vídeo editado'
  ];

  // u = tempo da edição (s), começa depois do pedido enviado.
  const phaseAt = u => (u < 0 ? 0 : u < 1.3 ? 1 : u < 2.1 ? 2 : u < 3.55 ? 3 : u < 4.9 ? 4 : u < 7.5 ? 5 : 6);

  function agentX(u) {
    if (u < .5) return 0;
    if (u < 2.1) return 100 * inOut(prog(u, .5, 2.05));
    if (u < 3.5) return lerp(100, S0 + GAP / 2, inOut(prog(u, 2.1, 2.7)));
    if (u < 3.8) return lerp(S0 + GAP / 2, S1, inOut(prog(u, 3.5, 3.8)));
    if (u < 4.9) return S1 - GAP * inOut(prog(u, 3.8, 4.6));
    if (u < CAP_T[0]) return lerp(S0, CAP[0][0], inOut(prog(u, 4.9, 5.3)));
    for (let i = 2; i >= 0; i--) {
      if (u >= CAP_T[i]) return lerp(CAP[i][0], CAP[i][1], inOut(prog(u, CAP_T[i], CAP_T[i] + CAP_D)));
    }
    return 0;
  }

  // Estado visual para um instante t (s) do ciclo.
  function stateAt(t) {
    const u = t - OFF;
    const scan = u < .5 ? 0 : u < 2.1 ? inOut(prog(u, .5, 2.05)) : 1;
    const k = CAP_T.map(s => inOut(prog(u, s, s + CAP_D)));
    const ph = END * prog(u, 8.1, 11.4);
    let mcap = -1;
    k.forEach((v, i) => { if (v >= .5) mcap = i; });
    if (u >= 8.1 && u < 11.75) mcap = ph < CUT1 ? 0 : ph < CUT2 ? 1 : 2;
    if (u >= 11.75) mcap = -1;
    const laser = out(prog(u, 2.7, 2.95));
    const vis = prog(t, 0, .45) * (1 - prog(t, OUT_A, OUT_B));
    return {
      u,
      phase: phaseAt(u),
      typed: prog(t, TYPE_A, TYPE_B),
      sent: t >= SEND,
      send: t >= SEND && t < SEND + .5,
      askf: 1 - prog(t, OUT_A, OUT_B),
      fade: vis,
      ax: agentX(u),
      ao: prog(u, .1, .45) * (1 - prog(u, 7.45, 7.85)),
      scan,
      sil: out(prog(u, 1.15, 1.45)),
      laser,
      lo: laser * (1 - prog(u, 3.3, 3.6)),
      rm: inOut(prog(u, 3, 3.45)),
      close: inOut(prog(u, 3.8, 4.6)),
      k,
      done: prog(u, 7.55, 7.85) * (1 - prog(u, 11.7, 12.1)),
      pop: back(prog(u, 7.6, 8.05)),
      ph,
      pho: prog(u, 7.95, 8.15) * (1 - prog(u, 11.5, 11.75)),
      mcap,
      cut: u >= 3 && u < 3.8,
      snap: u >= 4.55 && u < 5.4
    };
  }

  // Onda de áudio desenhada uma vez (e refeita se a largura mudar).
  function drawWave(el, seed) {
    const w = Math.round(el.clientWidth - 6);
    if (w < 10 || el.dataset.eiaW === String(w)) return;
    el.dataset.eiaW = String(w);
    const dip = Number(el.dataset.eiaDip) || -1; // respiração entre duas falas
    let r = seed * 9301 + 49297;
    const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
    const step = w < 180 ? 4 : 5;
    const n = Math.max(6, Math.floor(w / step));
    let d = '';
    for (let i = 0; i < n; i++) {
      const x = (i + .5) * (w / n);
      const pos = i / n;
      let a = .3 + .7 * Math.abs(Math.sin(i * .55 + seed)) * (.62 + .38 * Math.sin(i * .17 + seed * 2));
      a *= .7 + .3 * rand();
      if (Math.abs(pos - dip) < .03) a *= .22;
      if (pos < .03 || pos > .97) a *= .45;
      const h = Math.max(1.2, a * 17);
      d += `M${x.toFixed(1)} ${(20 - h).toFixed(1)}V${(20 + h).toFixed(1)}`;
    }
    const path = cls => `<svg class="${cls}" viewBox="0 0 ${w} 40" preserveAspectRatio="none" focusable="false"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
    el.innerHTML = path('eia-wave-dim') + path('eia-wave-hi');
  }

  class Editor {
    constructor(root) {
      this.root = root;
      this.status = root.querySelector('[data-edit-status]');
      this.dur = root.querySelector('[data-eia-dur]');
      this.tasks = [...root.querySelectorAll('[data-edit-decision]')];
      this.waves = [...root.querySelectorAll('[data-eia-wave]')];
      this.waveA = root.querySelector('.eia-au-a');
      this.waveBC = root.querySelector('.eia-au-bc');
      if (this.waveA) this.waveA.dataset.eiaDip = String(CUT1 / S0);
      if (this.waveBC) this.waveBC.dataset.eiaDip = String((CUT2 - S0) / (100 - S1));
      this.ov = root.querySelector('.eia-ov');
      this.tl = root.querySelector('.eia-tl');
      this.marks = [...root.querySelectorAll('.eia-ruler span')];
      this.markBox = [];
      this.geo = { w: 0, left: 0, right: 0 };
      this.chars = this.splitAsk(root.querySelector('[data-eia-ask]'));
      this.shown = -1;
      this.cache = Object.create(null);
      this.t = 0;
      this.prevAx = null;
      this.trail = 0;
      this.dir = 1;
      this.visible = false;
      this.frame = 0;
      this.last = null;
      this.lastPhase = -1;
      this.tick = this.tick.bind(this);
      this.measure();
      if ('ResizeObserver' in window) {
        let pending = 0;
        new ResizeObserver(() => {
          cancelAnimationFrame(pending);
          pending = requestAnimationFrame(() => { this.measure(); this.render(this.still ? STILL : this.t, 0, this.still); });
        }).observe(root);
      }
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this.measure());
      root.dataset.editReady = 'true';
      this.applyMotionPreference();
    }

    // O pedido vira letras individuais (a largura não muda enquanto é digitado).
    splitAsk(el) {
      if (!el) return [];
      const text = el.textContent;
      el.textContent = '';
      const frag = document.createDocumentFragment();
      const caret0 = document.createElement('span');
      frag.appendChild(caret0);
      const list = [caret0];
      for (const ch of text) {
        const s = document.createElement('span');
        s.className = 'c';
        s.textContent = ch;
        frag.appendChild(s);
        list.push(s);
      }
      el.appendChild(frag);
      return list;
    }

    typeTo(n, caret) {
      const total = this.chars.length - 1;
      if (!total) return;
      n = Math.max(0, Math.min(total, n));
      const key = n + (caret ? 'k' : '');
      if (this.shown === key) return;
      this.shown = key;
      for (let i = 1; i <= total; i++) this.chars[i].classList.toggle('on', i <= n);
      this.chars.forEach((s, i) => s.classList.toggle('k', caret && i === n));
    }

    measure() {
      this.waves.forEach(el => drawWave(el, Number(el.dataset.eiaWave) || 1));
      if (!this.ov || !this.tl) return;
      const ovBox = this.ov.getBoundingClientRect();
      const tlBox = this.tl.getBoundingClientRect();
      this.geo = { w: ovBox.width, left: ovBox.left - tlBox.left, right: tlBox.right - ovBox.right };
      this.markBox = this.marks.map(m => {
        const b = m.getBoundingClientRect();
        return b.width ? [b.left - ovBox.left, b.right - ovBox.left] : null;
      });
    }

    set(name, value) {
      const v = typeof value === 'number' ? String(Math.round(value * 1000) / 1000) : value;
      if (this.cache[name] === v) return;
      this.cache[name] = v;
      this.root.style.setProperty(`--${name}`, v);
    }

    // A marca de tempo que a agulha ou a IA cruza fica apagada (nada se sobrepõe ao texto).
    dodgeMarks(lines) {
      this.markBox.forEach((box, i) => {
        let o = 1;
        if (box) {
          lines.forEach(([x, v]) => {
            if (v <= 0) return;
            const vis = clamp(v * 4); // a marca some antes de a linha aparecer por inteiro
            const dist = x < box[0] ? box[0] - x : x > box[1] ? x - box[1] : 0;
            const k = clamp((dist - 3) / 12);
            o = Math.min(o, 1 - (1 - (.1 + .9 * k)) * vis);
          });
        }
        const v = (Math.round(o * 50) / 50).toString();
        if (this.marks[i].style.opacity !== v) this.marks[i].style.opacity = v === '1' ? '' : v;
      });
    }

    render(t, dt = 0, still = false) {
      const s = stateAt(t);
      if (still) Object.assign(s, { pho: 0, ph: 0, pop: 1, mcap: 0, typed: 1, sent: true, send: false, askf: 1, fade: 1 });

      // Rastro de brilho proporcional à velocidade da IA.
      if (this.prevAx !== null && dt > 0) {
        const v = (s.ax - this.prevAx) / dt;
        if (Math.abs(v) > 2) this.dir = v > 0 ? 1 : -1;
        this.trail = lerp(this.trail, clamp(Math.abs(v) / 70), .25);
      } else this.trail = 0;
      this.prevAx = s.ax;

      // O orbe nunca sai da moldura da linha do tempo (a linha dele continua no lugar exato).
      const W = this.geo.w;
      const x = s.ax * W / 100;
      const half = 22;
      let osh = 0;
      if (W) {
        const minX = -this.geo.left + half + 4;
        const maxX = W + this.geo.right - half - 4;
        if (x < minX) osh = minX - x; else if (x > maxX) osh = maxX - x;
      }

      this.set('ax', s.ax);
      this.set('ao', s.ao);
      this.set('osh', `${Math.round(osh)}px`);
      this.set('trail', this.trail);
      this.set('dir', this.dir);
      this.set('sil', s.sil);
      this.set('laser', s.laser);
      this.set('lo', s.lo);
      this.set('rm', s.rm);
      this.set('close', s.close);
      this.set('k0', s.k[0]);
      this.set('k1', s.k[1]);
      this.set('k2', s.k[2]);
      this.set('done', s.done);
      this.set('pop', s.pop);
      this.set('ph', s.ph);
      this.set('pho', s.pho);
      this.set('fade', s.fade);
      this.set('askf', s.askf);

      if (W) this.dodgeMarks([[x, s.ao * s.fade], [s.ph * W / 100, s.pho * s.fade]]);

      // Pedido digitado letra a letra, com cursor piscando até ser enviado.
      const total = this.chars.length - 1;
      this.typeTo(Math.round(s.typed * total), !still && t < SEND + .15);
      const ask = s.sent ? 'sent' : 'typing';
      if (this.root.dataset.ask !== ask) this.root.dataset.ask = ask;
      this.root.classList.toggle('is-send', s.send);

      // A onda "acende" por onde a IA já passou.
      const scanX = s.scan * 100;
      const sa = clamp(scanX / S0);
      const sb = clamp((scanX - S1) / (100 - S1));
      if (this.waveA && this.cache.sa !== sa) { this.cache.sa = sa; this.waveA.style.setProperty('--s', sa.toFixed(3)); }
      if (this.waveBC && this.cache.sb !== sb) { this.cache.sb = sb; this.waveBC.style.setProperty('--s', sb.toFixed(3)); }

      // Duração do vídeo encolhe quando os trechos se juntam.
      const dur = `${(12 - 1.6 * s.close).toFixed(1).replace('.', ',')} s`;
      if (this.dur && this.dur.textContent !== dur) this.dur.textContent = dur;
      if (s.close >= 1) this.root.dataset.cutDone = ''; else delete this.root.dataset.cutDone;

      const mcap = String(s.mcap);
      if (this.root.dataset.mcap !== mcap) this.root.dataset.mcap = mcap;
      this.root.classList.toggle('is-cut', s.cut);
      this.root.classList.toggle('is-snap', s.snap);

      if (s.phase !== this.lastPhase) {
        this.lastPhase = s.phase;
        this.root.dataset.phase = String(s.phase);
        this.root.dataset.state = s.phase === 6 ? 'done' : 'work';
        if (this.status && this.status.textContent !== STATUS[s.phase]) this.status.textContent = STATUS[s.phase];
        const doneUpTo = s.phase >= 6 ? 3 : s.phase >= 5 ? 2 : s.phase >= 4 ? 1 : 0;
        const active = s.phase >= 1 && s.phase <= 3 ? 0 : s.phase === 4 ? 1 : s.phase === 5 ? 2 : -1;
        this.tasks.forEach((li, i) => {
          li.classList.toggle('is-done', i < doneUpTo);
          li.classList.toggle('is-active', i === active);
        });
      }
    }

    tick(now) {
      this.frame = 0;
      if (!this.running()) return;
      const dt = this.last === null ? 0 : Math.min(now - this.last, 100) / 1000;
      this.last = now;
      this.t = (this.t + dt) % LOOP;
      this.render(this.t, dt);
      this.frame = requestAnimationFrame(this.tick);
    }

    running() { return this.visible && !document.hidden && !reduced.matches; }

    sync() {
      const run = this.running();
      this.root.classList.toggle('is-live', run);
      if (run && !this.frame) {
        this.last = null;
        this.frame = requestAnimationFrame(this.tick);
      } else if (!run && this.frame) {
        cancelAnimationFrame(this.frame);
        this.frame = 0;
      }
    }

    applyMotionPreference() {
      this.still = reduced.matches;
      this.prevAx = null;
      if (this.still) this.render(STILL, 0, true);
      else {
        this.t = 0;
        this.render(0);
      }
      this.sync();
    }
  }

  const editors = roots.filter(r => !r.dataset.editReady).map(r => new Editor(r));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const ed = editors.find(e => e.root === entry.target);
        if (!ed) return;
        ed.visible = entry.isIntersecting;
        ed.sync();
      });
    }, { threshold: .12 });
    editors.forEach(e => io.observe(e.root));
  } else editors.forEach(e => { e.visible = true; e.sync(); });

  document.addEventListener('visibilitychange', () => editors.forEach(e => e.sync()));
  const onMotion = () => editors.forEach(e => e.applyMotionPreference());
  if (reduced.addEventListener) reduced.addEventListener('change', onMotion);
  else if (reduced.addListener) reduced.addListener(onMotion);
})();
