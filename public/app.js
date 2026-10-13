(() => {
  'use strict';
  const config = window.editLabConfig || {};
  const notice = document.getElementById('notice-dialog');
  const heroVideo = document.getElementById('hero-video');
  const heroPlay = document.querySelector('[data-vsl-open]');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const safeUrl = value => {
    if (!value) return null;
    try {
      const url = new URL(value, location.href);
      return ['https:', 'http:'].includes(url.protocol) ? url : null;
    } catch { return null; }
  };
  function showNotice(title, message) {
    document.getElementById('notice-title').innerHTML = title;
    document.getElementById('notice-message').textContent = message;
    notice.showModal();
  }
  document.querySelectorAll('[data-dialog-close]').forEach(button => button.addEventListener('click', () => notice.close()));
  [notice].forEach(dialog => dialog.addEventListener('click', event => {
    if (event.target === dialog) {
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    }
  }));

  const checkout = safeUrl(config.checkoutUrl);
  if (checkout) {
    const params = new URLSearchParams(location.search);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'src', 'sck', 'fbclid'].forEach(key => {
      if (params.has(key) && !checkout.searchParams.has(key)) checkout.searchParams.set(key, params.get(key));
    });
  }
  document.querySelectorAll('.checkout-button').forEach(link => {
    if (checkout) link.href = checkout.href;
    else link.addEventListener('click', event => {
      event.preventDefault();
      showNotice('INSCRIÇÕES<br><em>EM BREVE.</em>', 'O link de inscrição da EditLab AI será disponibilizado em breve. Enquanto isso, conheça o método e os conteúdos desta página.');
    });
  });
  document.querySelectorAll('.buy-link:not(.checkout-button)').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    document.getElementById('comprar').scrollIntoView({ behavior: reduce.matches ? 'instant' : 'smooth', block: 'start' });
    history.replaceState(null, '', '#comprar');
  }));
  if (heroVideo && heroPlay) {
    const src = safeUrl(config.presentationVideo);
    const poster = safeUrl(config.presentationPoster);
    if (src && heroVideo.src !== src.href) heroVideo.src = src.href;
    if (poster && heroVideo.poster !== poster.href) heroVideo.poster = poster.href;
    heroPlay.addEventListener('click', () => {
      if (heroVideo.ended) heroVideo.currentTime = 0;
      heroVideo.play().catch(() => {
        showNotice('VÍDEO DE<br><em>APRESENTAÇÃO.</em>', 'Não foi possível iniciar a reprodução. Tente novamente usando os controles do vídeo.');
      });
    });
    heroVideo.addEventListener('play', () => { heroPlay.hidden = true; });
    heroVideo.addEventListener('pause', () => {
      heroPlay.hidden = false;
      heroPlay.setAttribute('aria-label', 'Continuar reprodução do vídeo da EditLab AI');
    });
    heroVideo.addEventListener('ended', () => {
      heroPlay.hidden = false;
      heroPlay.setAttribute('aria-label', 'Assistir novamente ao vídeo da EditLab AI');
    });
  }

  const styles = [
    { category: 'LEGENDAS INTELIGENTES', title: 'As palavras<br>ganham destaque.', copy: 'Legendas que acompanham o ritmo da fala, com palavras-chave em evidência e a identidade do seu conteúdo.', command: '“Coloque legendas e destaque as palavras mais importantes em verde.”', caption: 'A sua ideia.<br><mark>Na tela.</mark>' },
    { category: 'MOTION EXPLICATIVO', title: 'Sua mensagem.<br>Em movimento.', copy: 'Dê forma à sua explicação com elementos visuais que ajudam a acompanhar cada ideia.', command: '“Mostre os três passos com elementos que entram junto de cada explicação.”', caption: 'Ideias que<br><mark>se movem.</mark>' },
    { category: 'MONTAGEM EM 3D', title: 'Mais camadas.<br>Mais profundidade.', copy: 'Explore perspectiva, enquadramentos e camadas para criar uma composição com profundidade.', command: '“Organize os elementos em camadas e destaque o vídeo principal.”', caption: 'Uma nova<br><mark>perspectiva.</mark>' },
    { category: 'LETTERING CRIATIVO', title: 'A palavra<br>vira a cena.', copy: 'Use tipografia como parte da história. Frases grandes e contrastes dão presença à mensagem.', command: '“Transforme a frase principal em um lettering grande, branco e verde neon.”', caption: 'EDIT.<br><mark>CREATE.</mark><br>AMPLIFY.' },
    { category: 'RECORTE DE FUNDO', title: 'O foco está<br>na sua história.', copy: 'Enquadramento, recorte e elementos de apoio organizam a cena e valorizam o assunto.', command: '“Destaque o assunto principal e componha o fundo com a identidade da marca.”', caption: 'Sua história.<br><mark>Em foco.</mark>' },
  ];
  let selected = 0;
  const tabs = [...document.querySelectorAll('[data-style]')];
  function selectStyle(index, focus = false) {
    selected = (index + styles.length) % styles.length;
    const style = styles[selected];
    tabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === selected)); tab.tabIndex = i === selected ? 0 : -1; });
    document.getElementById('style-panel').setAttribute('aria-labelledby', `tab-${selected}`);
    document.getElementById('style-screen').className = `style-screen style-${selected}`;
    document.querySelector('[data-style-category]').textContent = style.category;
    document.querySelector('[data-style-title]').innerHTML = style.title;
    document.querySelector('[data-style-copy]').textContent = style.copy;
    document.querySelector('[data-style-command]').textContent = style.command;
    document.querySelector('.style-caption').innerHTML = style.caption;
    document.querySelector('[data-style-number]').textContent = String(selected + 1).padStart(2, '0');
    document.querySelector('[data-style-count]').textContent = `${String(selected + 1).padStart(2, '0')} / 05`;
    if (focus) tabs[selected].focus();
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectStyle(i));
    tab.addEventListener('keydown', event => {
      if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        selectStyle(event.key === 'Home' ? 0 : event.key === 'End' ? 4 : selected + (event.key === 'ArrowRight' ? 1 : -1), true);
      }
    });
  });
  document.querySelector('[data-style-prev]').addEventListener('click', () => selectStyle(selected - 1));
  document.querySelector('[data-style-next]').addEventListener('click', () => selectStyle(selected + 1));
  let touchX = null;
  const screen = document.getElementById('style-screen');
  screen.addEventListener('touchstart', event => { touchX = event.touches[0].clientX; }, { passive: true });
  screen.addEventListener('touchend', event => { const dx = event.changedTouches[0].clientX - touchX; if (touchX !== null && Math.abs(dx) > 50) selectStyle(selected + (dx < 0 ? 1 : -1)); touchX = null; }, { passive: true });

  const skillToggle = document.getElementById('skill-toggle');
  skillToggle.addEventListener('click', () => {
    const enabled = skillToggle.getAttribute('aria-checked') !== 'true';
    skillToggle.setAttribute('aria-checked', String(enabled));
    skillToggle.closest('.skills-window').classList.toggle('skills-off', !enabled);
    document.getElementById('skills-state').textContent = enabled ? 'DIREÇÃO CRIATIVA ATIVADA' : 'DIREÇÃO CRIATIVA DESATIVADA';
  });
  document.getElementById('copy-command').addEventListener('click', async () => {
    const text = document.getElementById('guide-command').textContent;
    const status = document.getElementById('copy-status');
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      status.textContent = 'Comando copiado. Pronto para usar.';
    } catch {
      const selection = getSelection();
      const range = document.createRange(); range.selectNodeContents(document.getElementById('guide-command'));
      selection.removeAllRanges(); selection.addRange(range);
      status.textContent = 'Comando selecionado. Use Ctrl+C para copiar.';
    }
  });
  // A single open answer keeps the FAQ easy to scan.
  document.querySelectorAll('.faq-list details').forEach(detail => detail.addEventListener('toggle', () => {
    if (detail.open) document.querySelectorAll('.faq-list details').forEach(other => { if (other !== detail) other.open = false; });
  }));
  const pause = document.querySelector('[data-cur-toggle]');
  pause?.addEventListener('click', () => queueMicrotask(() => pause.setAttribute('aria-label', pause.getAttribute('aria-pressed') === 'true' ? 'Retomar carrossel das aulas' : 'Pausar carrossel das aulas')));
})();
