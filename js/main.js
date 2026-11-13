/* ALTAI — интерактив ПК-версии */
(function () {
  'use strict';
  const D = window.ALTAI;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* Плавный скролл (Lenis): колесо и тачпад на ПК, тач остаётся нативным. Окна прокручиваются сами. */
  const lenis = (window.Lenis && !reduce) ? new window.Lenis({
    lerp: 0.085, wheelMultiplier: 1, autoRaf: true,
    anchors: { offset: 0, duration: 1.4 },
    prevent: n => !!(n.closest && n.closest('.modal, [data-lenis-prevent]')),
  }) : null;
  window.lenis = lenis;
  // сцены, которые уже сглаживают прокрутку сами, при Lenis догоняют быстрее, чтобы не было двойной инерции
  const mobile = window.matchMedia('(max-width: 760px)');
  // планшет и телефон: та же «сенсорная» раскладка (лента фото, свайпы, меню-бургер); плашка заявки и прокрутка к форме — только на телефоне
  const touch = window.matchMedia('(max-width: 1100px)');
  const SCRUB = lenis ? 0.3 : 0.12, SCRUB_FOOT = lenis ? 0.32 : 0.14;
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const img = (src, alt = '', extra = '') => `<img src="assets/img/${src}.jpg" alt="${esc(alt)}" loading="lazy" ${extra} onerror="this.remove()">`;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* без хранилища */ } },
  };

  /* Картинки, которых пока нет, — оставляем серую заглушку */
  $$('img').forEach(i => { i.addEventListener('error', () => i.remove(), { once: true }); if (i.complete && !i.naturalWidth && i.src) i.remove(); });

  /* ---------- Местное время на Алтае (UTC+7) ---------- */
  function altaiNow() {
    const now = new Date();
    const opts = { timeZone: 'Asia/Barnaul' };
    const time = now.toLocaleTimeString('ru-RU', { ...opts, hour: '2-digit', minute: '2-digit' });
    let date = now.toLocaleDateString('ru-RU', { ...opts, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    date = date.charAt(0).toUpperCase() + date.slice(1).replace(' г.', '');
    return { time, date };
  }
  function tick() {
    const { time, date } = altaiNow();
    $$('[data-altai-time]').forEach(el => { el.textContent = time; });
    $$('[data-altai-date]').forEach(el => { el.textContent = date; });
  }
  tick(); setInterval(tick, 30000);

  /* ---------- Шапка ---------- */
  const header = $('[data-header]');
  const navLinks = $$('.header__nav a[href^="#"]');
  const hero = $('.hero');
  const reelEl = $('[data-reel]');
  function onScrollHeader() {
    // над тёмной сценой «Фильм среди фото» шапка остаётся прозрачной
    const reelBottom = reelEl ? reelEl.offsetTop + reelEl.offsetHeight : hero.offsetHeight;
    header.classList.toggle('is-solid', window.scrollY > reelBottom - 88);
    if (window.scrollY < hero.offsetHeight * 0.6) navLinks.forEach(a => a.setAttribute('aria-current', 'false'));
  }
  window.addEventListener('scroll', onScrollHeader, { passive: true }); onScrollHeader();
  const spy = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      navLinks.forEach(a => a.setAttribute('aria-current', a.getAttribute('href') === '#' + e.target.id ? 'true' : 'false'));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  ['trip', 'program', 'stay', 'team', 'faq'].forEach(id => { const s = document.getElementById(id); if (s) spy.observe(s); });

  /* ---------- Видео: hero и сцена «Фильм среди фото» (общая пауза) ---------- */
  const heroVideo = $('[data-hero-video]');
  const reelVideo = $('[data-film-video]');
  const REEL_START = 12.6; // в сцене фильм начинается с тёплой половины: девушка с чаем у окна
  let userPaused = reduce; // пауза, выбранная человеком, общая для обоих видео
  const toggles = $$('[data-video-toggle]');
  function syncButtons() {
    toggles.forEach(btn => {
      btn.setAttribute('aria-pressed', String(userPaused));
      $('[data-video-label]', btn).textContent = userPaused ? 'Воспроизвести' : 'Пауза';
      $('use', btn).setAttribute('href', userPaused ? '#i-play' : '#i-pause');
    });
  }
  const inView = new Map();
  function updateVideo(v) {
    if (!v || !v.isConnected) return;
    if (!userPaused && inView.get(v)) v.play().catch(() => {}); else v.pause();
  }
  [heroVideo, reelVideo].forEach(v => {
    if (!v) return;
    if (reduce) v.removeAttribute('autoplay');
    const onReady = () => {
      const poster = v.previousElementSibling;
      if (poster && poster.tagName === 'IMG') poster.style.display = 'none';
      toggles.filter(t => t.closest('.hero, [data-film]') === v.closest('.hero, [data-film]')).forEach(t => { t.hidden = false; });
      updateVideo(v);
    };
    v.addEventListener('loadeddata', onReady);
    if (v.readyState >= 2) onReady();
    // Ошибка загрузки — не удаляем видео, а пробуем ещё раз; до этого виден постер
    let retries = 0;
    const retry = () => { if (retries++ < 3) setTimeout(() => { v.load(); }, 1200 * retries); };
    v.addEventListener('error', retry);
    $$('source', v).forEach(s => s.addEventListener('error', retry));
    v.addEventListener('stalled', () => { if (v.readyState < 2 && inView.get(v)) retry(); });
    if (v === reelVideo) v.addEventListener('loadedmetadata', () => { if (!v.dataset.started) { v.dataset.started = '1'; v.currentTime = REEL_START; } });
    new IntersectionObserver(([e]) => {
      inView.set(v, e.isIntersecting);
      if (e.isIntersecting && v.readyState === 0) { v.preload = 'auto'; v.load(); }
      updateVideo(v);
    }, { rootMargin: '100px' }).observe(v === reelVideo ? v.closest('[data-film]') : v);
  });
  if (heroVideo) { inView.set(heroVideo, true); updateVideo(heroVideo); }
  toggles.forEach(btn => btn.addEventListener('click', () => {
    userPaused = !userPaused; syncButtons(); updateVideo(heroVideo); updateVideo(reelVideo);
  }));
  syncButtons();

  /* ---------- Сцена «Фильм среди фото» → «О нас»: один фильм, анимация по прокрутке ----------
     1) коллаж: три колонки едут вверх, слот с видео встаёт в центр;
     2) видео раскрывается на весь экран, появляется подпись;
     3) передача: видео уменьшается и уезжает вправо в колонку «О нас» (560 × 720),
        слева проявляется текст. Видео — один и тот же элемент, без перезапуска. */
  (function reelScene() {
    if (!reelEl) return;
    const stage = $('.reel__stage', reelEl);
    const cols = { left: $('[data-col="left"]', reelEl), center: $('[data-col="center"]', reelEl), right: $('[data-col="right"]', reelEl) };
    const slot = $('[data-slot]', reelEl);
    const fades = $$('[data-fade]', reelEl);
    const film = $('[data-film]');
    const dock = $('[data-film-dock]');
    const caption = $('[data-caption]', film);
    const shade = $('[data-film-shade]', film);
    const aboutText = $('.about__text');
    const mq = window.matchMedia('(max-width: 1100px), (prefers-reduced-motion: reduce)');
    const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
    const seg = (p, a, b) => clamp((p - a) / (b - a));
    const lerp = (a, b, t) => a + (b - a) * t;
    const lerpRect = (r1, r2, t) => ({ x: lerp(r1.x, r2.x, t), y: lerp(r1.y, r2.y, t), w: lerp(r1.w, r2.w, t), h: lerp(r1.h, r2.h, t) });
    const rectOf = el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
    const p1out = t => 1 - (1 - t) * (1 - t);                              // power1.out
    const p2io = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // power2.inOut
    // s — сглаженная прокрутка в пикселях от верха сцены
    let target = 0, current = 0, raf = 0, geo = null;
    function measure() {
      const vh = stage.clientHeight, vw = stage.clientWidth;
      const keep = el => { const t = el.style.transform; el.style.transform = 'none'; return t; };
      const saved = [cols.left, cols.right, cols.center].map(keep);
      geo = {
        vh, vw,
        run: reelEl.offsetHeight - vh,
        leftH: cols.left.offsetHeight, rightH: cols.right.offsetHeight,
        slotTop: slot.offsetTop, slotH: slot.offsetHeight,
      };
      [cols.left, cols.right, cols.center].forEach((c, i) => { c.style.transform = saved[i]; });
    }
    function placeFilm(r) {
      film.classList.add('is-flying');
      film.style.left = r.x + 'px'; film.style.top = r.y + 'px';
      film.style.width = r.w + 'px'; film.style.height = r.h + 'px';
    }
    function dockFilm() {
      film.classList.remove('is-flying');
      film.style.left = film.style.top = film.style.width = film.style.height = '';
    }
    function render(sPx) {
      const g = geo;
      const p = clamp(sPx / g.run);                 // сцена 340svh
      const h = clamp((sPx - g.run) / g.vh);        // передача в «О нас»: ещё один экран прокрутки
      // 1. колонки
      const lp = seg(p, 0, 0.89);
      cols.left.style.transform = `translate3d(0, ${lerp(0.10 * g.vh, -g.leftH * 0.97, lp)}px, 0)`;
      cols.right.style.transform = `translate3d(0, ${lerp(0.42 * g.vh, g.vh * 0.28 - g.rightH, lp)}px, 0)`;
      const cEnd = g.vh / 2 - (g.slotTop + g.slotH / 2);
      cols.center.style.transform = `translate3d(-50%, ${lerp(0.70 * g.vh, cEnd, p1out(seg(p, 0, 0.52)))}px, 0)`;
      const f = 1 - seg(p, 0.52, 0.65);
      fades.forEach(el => { el.style.opacity = f; });
      const side = 1 - seg(p, 0.63, 0.83);
      cols.left.style.opacity = side; cols.right.style.opacity = side;
      // 2–3. фильм
      const screen = { x: 0, y: 0, w: g.vw, h: g.vh };
      if (h >= 1) dockFilm();
      else if (h > 0) placeFilm(lerpRect(screen, rectOf(dock), p2io(h)));
      else placeFilm(lerpRect(rectOf(slot), screen, p2io(seg(p, 0.54, 0.88))));
      film.style.borderRadius = (p > 0.6 && h < 0.5) ? '0' : '';
      // подпись: появляется в конце сцены и гаснет в начале передачи
      const c = seg(p, 0.90, 1) * (1 - seg(h, 0, 0.3));
      caption.style.opacity = c;
      caption.style.transform = `translate(-50%, ${lerp(30, 0, seg(p, 0.90, 1))}px)`;
      shade.style.opacity = seg(p, 0.85, 1) * (1 - seg(h, 0, 0.35));
      // текст «О нас» проявляется и поднимается на 24 px
      const t = seg(h, 0.5, 1);
      aboutText.style.opacity = t;
      aboutText.style.transform = t < 1 ? `translate3d(0, ${lerp(24, 0, t)}px, 0)` : '';
    }
    function scrollPx() { return reelEl ? -reelEl.getBoundingClientRect().top : 0; }
    function loop() {
      // сглаживание как scrub: 0.7 — догоняем цель примерно за 0,7 с
      current += (target - current) * SCRUB;
      if (Math.abs(target - current) < 0.5) current = target;
      render(current);
      raf = current !== target ? requestAnimationFrame(loop) : 0;
    }
    function onScroll() { if (mq.matches) return; target = scrollPx(); if (!raf) raf = requestAnimationFrame(loop); }
    function setup() {
      reelEl.classList.toggle('is-static', mq.matches);
      [cols.left, cols.right, cols.center, caption, shade, aboutText, ...fades].forEach(el => { el.style.transform = ''; el.style.opacity = ''; });
      film.style.borderRadius = '';
      aboutText.classList.toggle('is-scrubbed', !mq.matches);
      dockFilm();
      // на телефоне фильм — плитка с видео в начале ленты, а не в «О нас»
      const home = touch.matches ? slot : dock;
      if (film.parentNode !== home) home.appendChild(film);
      if (mq.matches) return;
      measure(); current = target = scrollPx(); render(current);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => { setup(); onScroll(); });
    (mq.addEventListener ? mq.addEventListener('change', setup) : mq.addListener(setup));
    touch.addEventListener('change', setup);
    $$('img', reelEl).forEach(im => im.addEventListener('load', () => { if (!mq.matches) { measure(); render(current); } }, { once: true }));
    setup();
  })();

  /* ---------- Появление при скролле ---------- */
  if (!reduce) {
    const rv = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); rv.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
    $$('.team-card, .day-card, .room, .info-col').forEach((el, i) => { el.classList.add('reveal'); el.style.transitionDelay = (i % 3) * 80 + 'ms'; rv.observe(el); });
  }

  /* ---------- Переход к подвалу (как на lorunser.com): подвал открывается из-под страницы ----------
     p: 0 — верх подвала у нижнего края экрана, 1 — подвал на своём месте.
     Подвал сдвинут вверх на 60% оставшегося пути (видна «подложка»), затемнение и размытие 5 px
     уходят к 80% пути. Сглаживание как у остальных сцен. */
  (function footerReveal() {
    const wrap = $('[data-footer-reveal]');
    if (!wrap) return;
    const mask = $('[data-footer-mask]', wrap), shade = $('[data-footer-shade]', wrap), footer = $('.footer', wrap);
    const mq = window.matchMedia('(max-width: 1100px), (prefers-reduced-motion: reduce)');
    const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
    let target = 1, current = 1, raf = 0;
    function progress() {
      const vh = window.innerHeight, r = wrap.getBoundingClientRect();
      const D = Math.min(r.height, vh);
      return clamp((vh - r.top) / D);
    }
    function render(p) {
      const D = Math.min(wrap.offsetHeight, window.innerHeight);
      mask.style.transform = p >= 1 ? '' : `translate3d(0, ${(-0.6 * D * (1 - p)).toFixed(1)}px, 0)`;
      const k = clamp(p / 0.8);
      shade.style.opacity = (0.85 * (1 - k)).toFixed(3);
      footer.style.filter = k >= 1 ? '' : `blur(${(5 * (1 - k)).toFixed(2)}px)`;
    }
    function loop() {
      current += (target - current) * SCRUB_FOOT;
      if (Math.abs(target - current) < 0.001) current = target;
      render(current);
      raf = current !== target ? requestAnimationFrame(loop) : 0;
    }
    function onScroll() { if (mq.matches) return; target = progress(); if (!raf) raf = requestAnimationFrame(loop); }
    function setup() {
      wrap.classList.toggle('is-animated', !mq.matches);
      if (mq.matches) { mask.style.transform = ''; shade.style.opacity = ''; footer.style.filter = ''; return; }
      current = target = progress(); render(current);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', setup);
    (mq.addEventListener ? mq.addEventListener('change', setup) : mq.addListener(setup));
    setup();
    // содержимое подвала проявляется по очереди, когда подвал открылся на 20%
    $$('.footer__col, .footer__bottom', footer).forEach((el, i) => { el.classList.add('reveal-in'); el.style.transitionDelay = (i * 90) + 'ms'; });
    new IntersectionObserver((es, io) => es.forEach(e => { if (e.isIntersecting) { footer.classList.add('is-in'); io.disconnect(); } }), { threshold: 0.2 }).observe(wrap);
  })();

  /* ---------- Команда: по наведению открывается чистая карточка (не ссылка и не кнопка: текст можно выделить).
     На сенсорных экранах наведения нет — там карточку открывает касание. ---------- */
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
  const teamCards = $$('.team-card');
  teamCards.forEach(card => {
    card.addEventListener('mouseenter', () => { if (canHover.matches) card.classList.add('is-open'); });
    card.addEventListener('mouseleave', () => { if (canHover.matches) card.classList.remove('is-open'); });
    card.addEventListener('click', () => {
      if (canHover.matches) return;
      const open = !card.classList.contains('is-open');
      teamCards.forEach(c => c.classList.remove('is-open'));
      card.classList.toggle('is-open', open);
    });
  });

  /* ---------- Снаружи / Внутри ---------- */
  $$('[data-photo-toggle]').forEach(box => {
    const cap = $('.photo-toggle__caption', box);
    $$('.segment__item', box).forEach(b => b.addEventListener('click', () => {
      const v = b.dataset.value;
      $$('.segment__item', box).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      $$('.photo-toggle__img', box).forEach(f => f.classList.toggle('is-active', f.dataset.value === v));
      cap.textContent = cap.dataset['caption' + (v === 'inside' ? 'Inside' : 'Outside')];
    }));
  });

  /* ---------- Аккордеон «Что входит» ---------- */
  $$('[data-accordion]').forEach(acc => {
    const btn = $('.round-toggle', acc);
    const body = document.getElementById(btn.getAttribute('aria-controls'));
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Свернуть' : 'Подробнее о стоимости');
      body.classList.toggle('is-open', open);
    });
  });

  /* ---------- Программа: карточки дней ---------- */
  const daysEl = $('[data-days]');
  daysEl.innerHTML = D.DAYS.map(d => {
    const metas = d.card.meta.map(([text, kind, tag]) => `<li class="meta-row"><span class="t-small">${text}</span>${
      kind === 'required' ? `<span class="tag tag--required">${tag}</span>` : kind === 'optional' ? `<span class="tag tag--optional">${tag}</span>` : kind === 'load' ? `<span class="tag tag--load">${tag}</span>` : icon(kind)}</li>`).join('');
    const w = d.walk ? `<div class="glass walk-load"><span class="t-caption">Нагрузка</span><span><span class="walk-load__type">${d.walk[0]}</span><span class="t-caption walk-load__details" style="display:block">${d.walk[1]}</span></span></div>` : '';
    return `<article class="day-card" id="day-${d.n}">
      <div class="day-card__content">
        <div class="day-card__top"><p class="t-label-sm day-card__eyebrow">День 0${d.n} / 05</p><h3 class="t-section-sm">${d.card.title.replace('|', '<br>')}</h3></div>
        <ul class="day-card__meta">${metas}</ul>
        <button class="btn btn--secondary btn--split" type="button" data-open-day="${d.n}">Расписание дня ${icon('arrow-right')}</button>
      </div>
      <div class="day-card__photo ph">${img('day-' + d.n, d.alt)}${w}</div>
    </article>`;
  }).join('') + `<article class="note-card"><p class="t-label-sm note-card__eyebrow">После поездки</p><h3 class="t-section italic note-card__title">Личный лист</h3><p class="t-body-lg">При желании вы уедете с личным листом: важная тема → направление → первый шаг → дата возвращения к вопросу. Можно просто дать себе время.</p></article>`;

  /* ---------- Модальные окна: общий механизм ---------- */
  let lastFocus = null;
  function openModal(el) {
    if (!el.hidden) return;
    lastFocus = document.activeElement;
    $$('.modal').forEach(m => { if (m !== el) m.hidden = true; });
    el.hidden = false;
    document.body.classList.add('has-modal');
    if (lenis) lenis.stop();
    el.scrollTop = 0;
    const panel = $('.modal__panel', el);
    setTimeout(() => panel.focus({ preventScroll: true }), 0);
  }
  function closeModal(el) {
    el.hidden = true;
    if (!$$('.modal').some(m => !m.hidden)) { document.body.classList.remove('has-modal'); if (lenis) lenis.start(); }
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    if (location.hash.startsWith('#legal-') || location.hash.startsWith('#day-')) history.replaceState(null, '', location.pathname);
  }
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-close]');
    if (c) closeModal(c.closest('.modal'));
  });
  document.addEventListener('keydown', e => {
    const open = $$('.modal').find(m => !m.hidden);
    if (!open) return;
    if (e.key === 'Escape') closeModal(open);
    if (e.key === 'Tab') { // ловушка фокуса
      const f = $$('a[href], button:not([disabled]), input, textarea, [tabindex]:not([tabindex="-1"])', open).filter(x => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- Окно дня ---------- */
  const dayModal = $('#day-modal');
  const dayPanel = $('[data-day-modal]');
  function renderDay(n, openDetails) {
    const d = D.DAYS[n - 1];
    dayPanel.dataset.day = n;
    const prev = D.DAYS[n - 2], next = D.DAYS[n];
    const moments = d.moments.map(m => `<div class="moment">
        <div class="moment__when"><span class="moment__part">${m.part}</span><span class="moment__time">${m.time}</span></div>
        <div class="moment__story"><h4 class="moment__title">${m.title}</h4><p class="t-body moment__text">${m.text}</p>
          <div class="moment__meta">${m.tag ? `<span class="tag ${m.tag === 'Для всех' ? 'tag--required' : 'tag--optional'}">${m.tag}</span>` : ''}${m.dur ? `<span class="moment__dur">${icon('clock', 'icon--16')}${m.dur}</span>` : ''}<span class="moment__facts">${m.facts}</span></div>
        </div></div>`).join('');
    const dishes = d.dishes.map(x => `<div class="dish"><div class="ph">${img('dish-' + x.img, x.name)}</div><div><p class="dish__name">${x.name}</p><p class="dish__desc">${x.desc}</p></div></div>`).join('');
    const schedule = d.moments.map(m => `<li><span>${m.time}</span><span>${m.title}</span><span>${m.tag ? `<span class="tag ${m.tag === 'Для всех' ? 'tag--required' : 'tag--optional'}">${m.tag}</span>` : ''}</span></li>`).join('');
    const w = d.walk ? `<div class="glass walk-load"><span class="t-caption">Нагрузка</span><span><span class="walk-load__type">${d.walk[0]}</span><span class="t-caption walk-load__details" style="display:block">${d.walk[1]}</span></span></div>` : '';
    dayPanel.innerHTML = `
      <div class="mosaic">
        <div class="ph">${img('day-' + n, d.alt)}${w}</div>
        <div class="ph">${img('day-' + n + '-b', '')}</div>
        <div class="ph">${img('day-' + n + '-c', '')}</div>
        <button class="mosaic__close" type="button" data-close aria-label="Закрыть окно дня">${icon('x', 'icon--20')}</button>
      </div>
      <header class="modal-header">
        <p class="t-label-sm modal-header__eyebrow">${d.eyebrow}</p>
        <h2 class="t-section-sm" id="day-modal-title">${d.title}</h2>
        <p class="t-body">${d.desc}</p>
      </header>
      <div class="day-story">
        <p class="day-story__lead">${d.lead}</p>
        <div class="moments">${moments}</div>
        <div class="food"><h4 class="food__title">На столе</h4><div class="dishes">${dishes}</div><p class="t-caption food__note">${d.foodNote}</p></div>
        <div class="disclosure">
          <button class="disclosure__head" type="button" aria-expanded="false" aria-controls="day-details">
            <span>${icon('backpack', 'icon--20')}Расписание по часам, нагрузка и что взять</span>
            <span class="icon-btn disclosure__toggle">${icon('plus', 'icon--24 icon-plus')}${icon('minus', 'icon--24 icon-minus')}</span>
          </button>
          <div class="collapse" id="day-details"><div><div class="disclosure__body">
            ${d.walk ? `<p class="t-body"><b>Нагрузка:</b> ${d.walk[0].toLowerCase()}, ${d.walk[1]}.</p>` : ''}
            <ul class="schedule">${schedule}</ul>
            ${d.bridge ? `<p class="bridge-note">${icon('triangle-alert', 'icon--16')}${D.BRIDGE_NOTE}</p>` : ''}
            <div class="packing"><h4>Что взять на прогулку</h4><ul>${D.PACKING.map(p => `<li>${icon('check', 'icon--16')}${p}</li>`).join('')}</ul><p class="t-caption" style="margin-top:8px;color:var(--color-text-tertiary)">${D.PACKING_NOTE}</p></div>
          </div></div></div>
        </div>
      </div>
      <footer class="modal-footer">
        ${prev ? `<button class="day-nav" type="button" data-goto-day="${prev.n}">${icon('arrow-left', 'icon--20')}<span><small>День ${prev.n}</small><b>${prev.title}</b></span></button>` : ''}
        ${next ? `<button class="day-nav day-nav--next" type="button" data-goto-day="${next.n}"><span><small>День ${next.n}</small><b>${next.title}</b></span>${icon('arrow-right', 'icon--20')}</button>` : `<button class="btn btn--primary day-nav--next" type="button" data-open-booking>Оставить заявку ${icon('arrow-right')}</button>`}
      </footer>`;
    $$('img', dayPanel).forEach(i => i.addEventListener('error', () => i.remove(), { once: true }));
    const dh = $('.disclosure__head', dayPanel);
    dh.addEventListener('click', () => {
      const open = dh.getAttribute('aria-expanded') !== 'true';
      dh.setAttribute('aria-expanded', String(open));
      $('#day-details').classList.toggle('is-open', open);
    });
    if (openDetails) { dh.click(); }
    dayModal.scrollTop = 0;
  }
  document.addEventListener('click', e => {
    const o = e.target.closest('[data-open-day]');
    if (o) { e.preventDefault(); renderDay(+o.dataset.openDay, o.hasAttribute('data-open-details')); openModal(dayModal); if (o.hasAttribute('data-open-details')) setTimeout(() => $('.disclosure', dayPanel).scrollIntoView({ block: 'start' }), 50); return; }
    const g = e.target.closest('[data-goto-day]');
    if (g) switchDay(+g.dataset.gotoDay);
  });
  // Плавная смена дня: текущий день уходит в сторону и гаснет, новый проявляется с другой стороны.
  // Пока окно скрыто, подгружаем фото нового дня и возвращаемся к началу окна.
  let switching = false;
  function preloadDay(n) {
    const srcs = ['day-' + n, 'day-' + n + '-b', 'day-' + n + '-c'].map(k => 'assets/img/' + k + '.jpg');
    const loads = srcs.map(src => { const im = new Image(); im.src = src; return im.decode ? im.decode().catch(() => {}) : Promise.resolve(); });
    return Promise.race([Promise.all(loads), new Promise(r => setTimeout(r, 500))]);
  }
  async function switchDay(n) {
    if (switching) return;
    const cur = +(dayPanel.dataset.day || 0);
    if (reduce || !dayPanel.animate) { renderDay(n); dayPanel.focus({ preventScroll: true }); return; }
    switching = true;
    const dir = n > cur ? 1 : -1;
    const ready = preloadDay(n);
    const out = dayPanel.animate(
      [{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: `translateX(${-24 * dir}px)` }],
      { duration: 220, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' });
    await Promise.all([out.finished.catch(() => {}), ready]);
    renderDay(n);
    dayPanel.focus({ preventScroll: true });
    out.cancel();
    await dayPanel.animate(
      [{ opacity: 0, transform: `translateX(${24 * dir}px)` }, { opacity: 1, transform: 'translateX(0)' }],
      { duration: 380, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }).finished.catch(() => {});
    switching = false;
  }

  /* ---------- Схема маршрута ---------- */
  const legend = $('[data-legend]');
  legend.innerHTML = D.LEGEND.map(([t, s], i) => `<li class="legend__item" data-step="${i}">
      <div class="legend__marker-col"><span class="marker">${D.PLACES[i].id}</span>${i < 4 ? '<span class="legend__connector"></span>' : ''}</div>
      <button class="legend__btn legend__text" type="button" data-select-place="${i}"><span class="legend__title">${t}</span><span class="legend__desc">${s}</span></button>
    </li>`).join('');
  const pts = $('[data-map-points]');
  pts.innerHTML = D.PLACES.map((p, i) => `<button class="map-point${p.left ? ' map-point--left' : ''}" type="button" style="left:${(p.x / 7.76).toFixed(3)}%;top:${(p.y / 8.2).toFixed(3)}%" data-select-place="${i}" aria-pressed="false" aria-label="${esc(p.name + ' ' + p.sub)}">
      <span class="map-point__hit"></span><span class="marker">${p.id}</span><span class="map-point__label"><b>${p.name}</b><span>${p.sub}</span></span></button>`).join('');
  const stack = $('[data-place-stack]');
  function cardHTML(c) {
    const link = c.day ? `<a class="text-link" href="#day-${c.day}" data-open-day="${c.day}"><span>${c.link}</span>${icon('arrow-right', 'icon--16')}</a>` : c.href ? `<a class="text-link" href="${c.href}"><span>${c.link}</span>${icon('arrow-right', 'icon--16')}</a>` : '';
    return `<div class="place-card" data-title="${esc(c.title)}"><div class="place-card__photo ph">${img(c.img, c.title)}</div><div class="place-card__body"><p class="place-card__meta">${c.meta}</p><p class="place-card__title">${c.title}</p>${link}</div></div>`;
  }
  // роли карточек: верхняя (front) и нижняя (back), которую можно вытянуть наверх
  function setRoles(frontEl, backEl) {
    frontEl.classList.remove('place-card--back'); frontEl.classList.add('place-card--front');
    frontEl.removeAttribute('role'); frontEl.removeAttribute('tabindex'); frontEl.removeAttribute('aria-label');
    backEl.classList.remove('place-card--front'); backEl.classList.add('place-card--back');
    backEl.setAttribute('role', 'button'); backEl.setAttribute('tabindex', '0');
    backEl.setAttribute('aria-label', 'Показать: ' + backEl.dataset.title);
    // ссылка внутри нижней карточки недоступна, пока карточка не наверху (иначе кнопка внутри кнопки)
    $$('.place-card__body', backEl).forEach(l => { l.inert = true; });
    $$('.place-card__body', frontEl).forEach(l => { l.inert = false; });
  }
  // «Переложить» карточки, как в руках: нижнюю вытягиваем вверх-влево и кладём сверху,
  // верхняя в это время отъезжает вправо-вниз и ложится под неё
  let swapping = false;
  function swapCards() {
    const backEl = $('.place-card--back', stack), frontEl = $('.place-card--front', stack);
    if (!backEl || !frontEl || swapping) return;
    if (reduce || !backEl.animate) { setRoles(backEl, frontEl); return; }
    swapping = true;
    const FRONT = 'translate(20px, 36px) rotate(0deg)';
    // если курсор остаётся над стопкой, нижняя карточка должна прийти сразу в наклон «при наведении»
    const BACK = stack.matches(':hover') ? 'translate(0px, -8px) rotate(-5deg)' : 'translate(0px, 0px) rotate(0deg)';
    const startBack = getComputedStyle(backEl).transform; // учитывает наклон при наведении
    const opts = { duration: 700, easing: 'cubic-bezier(0.45, 0, 0.2, 1)' };
    const up = backEl.animate([
      { transform: startBack === 'none' ? BACK : startBack, zIndex: 1, boxShadow: '0 0 0 rgba(13,17,18,0)' },
      { offset: 0.45, transform: 'translate(-64px, -46px) rotate(-11deg)', zIndex: 1, boxShadow: '0 18px 40px rgba(13,17,18,0.28)' },
      { offset: 0.5, transform: 'translate(-62px, -44px) rotate(-10deg)', zIndex: 3, boxShadow: '0 18px 40px rgba(13,17,18,0.28)' },
      { transform: FRONT, zIndex: 3, boxShadow: '0 8px 24px rgba(13,17,18,0.18)' },
    ], { ...opts, fill: 'forwards' });
    const down = frontEl.animate([
      { transform: FRONT, zIndex: 2, boxShadow: '0 8px 24px rgba(13,17,18,0.18)' },
      { offset: 0.45, transform: 'translate(58px, 62px) rotate(7deg)', zIndex: 2, boxShadow: '0 12px 28px rgba(13,17,18,0.22)' },
      { offset: 0.5, transform: 'translate(56px, 60px) rotate(6deg)', zIndex: 1 },
      { transform: BACK, zIndex: 1, boxShadow: '0 0 0 rgba(13,17,18,0)' },
    ], { ...opts, fill: 'forwards' });
    stack.classList.add('is-swapping');
    up.finished.then(() => {
      // меняем роли без CSS-переходов, иначе карточка «доезжает» второй раз и мигает
      stack.classList.add('no-transition');
      setRoles(backEl, frontEl);
      stack.classList.remove('is-swapping');
      up.cancel(); down.cancel();
      void stack.offsetWidth;
      requestAnimationFrame(() => requestAnimationFrame(() => stack.classList.remove('no-transition')));
      swapping = false;
      if (document.activeElement === backEl || stack.contains(document.activeElement)) frontEl.focus({ preventScroll: true });
    }).catch(() => { swapping = false; });
  }
  stack.addEventListener('click', e => { if (e.target.closest('.place-card--back')) { e.preventDefault(); swapCards(); } });
  stack.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.place-card--back')) { e.preventDefault(); swapCards(); } });
  function selectPlace(i, animate = true) {
    const p = D.PLACES[i];
    $$('.map-point', pts).forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    const cs = p.cards;
    stack.classList.toggle('place-stack--single', cs.length === 1);
    stack.innerHTML = cs.length > 1 ? cardHTML(cs[1]) + cardHTML(cs[0]) : cardHTML(cs[0]);
    const cards = $$('.place-card', stack);
    if (cards.length > 1) setRoles(cards[1], cards[0]); else cards[0].classList.add('place-card--front');
    $$('img', stack).forEach(im => im.addEventListener('error', () => im.remove(), { once: true }));
    if (animate && !reduce) { stack.classList.remove('is-entering'); void stack.offsetWidth; stack.classList.add('is-entering'); }
    fitStack();
    $$('img', stack).forEach(im => { if (!im.complete) im.addEventListener('load', fitStack, { once: true }); });
  }
  // Стопка карточек не должна выходить за нижний край карты: если карточка выше обычного
  // (например, название в две строки), поднимаем стопку ровно настолько, насколько нужно
  const STACK_TOP = 527, STACK_GAP = 16;
  function fitStack() {
    const map = stack.offsetParent; if (!map) return;
    if (stack.classList.contains('place-stack--single')) { stack.style.top = ''; return; }
    const front = $('.place-card--front', stack), back = $('.place-card--back', stack);
    const need = Math.max(front ? front.offsetHeight + 36 : 0, back ? back.offsetHeight : 0);
    stack.style.top = Math.min(STACK_TOP, map.clientHeight - need - STACK_GAP) + 'px';
  }
  document.addEventListener('click', e => { const s = e.target.closest('[data-select-place]'); if (s) selectPlace(+s.dataset.selectPlace); });
  // на планшете и телефоне метки карты — только картинка: убираем их из клавиатурного обхода
  const staticMap = window.matchMedia('(max-width: 1100px)');
  const syncPoints = () => $$('.map-point', pts).forEach(b => { if (staticMap.matches) { b.tabIndex = -1; b.setAttribute('aria-hidden', 'true'); } else { b.removeAttribute('tabindex'); b.removeAttribute('aria-hidden'); } });
  syncPoints(); (staticMap.addEventListener ? staticMap.addEventListener('change', syncPoints) : staticMap.addListener(syncPoints));
  selectPlace(0, false);
  // прорисовка легенды и точек при скролле
  const routeEl = $('.stay__route');
  const legendItems = $$('.legend__item', legend);
  const mapPoints = $$('.map-point', pts);
  function routeProgress() {
    const r = routeEl.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height * 0.75)));
    const n = reduce ? 5 : Math.min(5, Math.max(1, Math.ceil(p * 5)));
    legendItems.forEach((li, k) => { li.classList.toggle('is-done', k < n - 1); li.classList.toggle('is-current', k === n - 1); });
    mapPoints.forEach((m, k) => m.classList.toggle('is-shown', k < n));
  }
  window.addEventListener('scroll', routeProgress, { passive: true }); routeProgress();

  /* ---------- Галерея проживания ---------- */
  const gal = $('[data-gallery]');
  const slides = $('[data-gallery-slides]', gal);
  let tab = 'rooms', idx = 0;
  function drawGallery() {
    const g = D.GALLERY[tab];
    const cap = k => (g.captions && g.captions[k]) || g.caption;
    slides.innerHTML = Array.from({ length: g.count }, (_, k) => `<figure class="ph gallery__slide${k === idx ? ' is-active' : ''}">${img(tab + '-' + (k + 1), (g.captions && g.captions[k]) ? cap(k) : g.alt + ', фото ' + (k + 1))}</figure>`).join('');
    $$('img', slides).forEach(im => im.addEventListener('error', () => im.remove(), { once: true }));
    update();
  }
  function update() {
    const g = D.GALLERY[tab];
    $$('.gallery__slide', slides).forEach((s, k) => s.classList.toggle('is-active', k === idx));
    $('[data-gallery-counter]', gal).textContent = String(idx + 1).padStart(2, '0') + ' / ' + String(g.count).padStart(2, '0');
    $('[data-gallery-caption]', gal).textContent = (g.captions && g.captions[idx]) || g.caption;
  }
  $('[data-gallery-prev]', gal).addEventListener('click', () => { idx = (idx - 1 + D.GALLERY[tab].count) % D.GALLERY[tab].count; update(); });
  $('[data-gallery-next]', gal).addEventListener('click', () => { idx = (idx + 1) % D.GALLERY[tab].count; update(); });
  $$('[data-tab]', gal).forEach(b => b.addEventListener('click', () => {
    tab = b.dataset.tab; idx = 0;
    $$('[data-tab]', gal).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    drawGallery();
  }));
  gal.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') $('[data-gallery-prev]', gal).click(); if (e.key === 'ArrowRight') $('[data-gallery-next]', gal).click(); });
  drawGallery();

  /* ---------- FAQ: один список без тем, первый вопрос открыт ---------- */
  const faq = $('[data-faq]');
  const faqItems = D.FAQ.flatMap((g, gi) => g.q.map(([q, a], qi) => ({ q, a, topic: g.t, first: qi === 0, id: `faq-a-${gi}-${qi}` })));
  $('[data-faq-items]', faq).innerHTML = faqItems.map((it, i) => `<div class="faq-item"${it.first ? ` data-topic-start="${esc(it.topic)}"` : ''}>
      <button class="faq-item__q" type="button" aria-expanded="${i === 0}" aria-controls="${it.id}"><span>${it.q}</span>${icon('chevron-down')}</button>
      <div class="collapse faq-item__a${i === 0 ? ' is-open' : ''}" id="${it.id}"><div><p>${it.a}</p></div></div>
    </div>`).join('');
  function toggleFaq(btn, open) {
    btn.setAttribute('aria-expanded', String(open));
    document.getElementById(btn.getAttribute('aria-controls')).classList.toggle('is-open', open);
  }
  faq.addEventListener('click', e => {
    const q = e.target.closest('.faq-item__q');
    if (q) toggleFaq(q, q.getAttribute('aria-expanded') !== 'true');
  });
  // ссылки из других блоков («подробнее в FAQ») ведут к первому вопросу нужной темы и раскрывают его
  document.addEventListener('click', e => {
    const j = e.target.closest('[data-faq-jump]');
    if (!j) return;
    e.preventDefault();
    const item = $$('[data-topic-start]', faq).find(x => x.dataset.topicStart === j.dataset.faqJump) || $('.faq-item', faq);
    $('[data-faq-items]', faq).classList.add('is-all'); const more = $('[data-faq-more]'); if (more) more.hidden = true;
    toggleFaq($('.faq-item__q', item), true);
    if (lenis) setTimeout(() => lenis.scrollTo(item, { offset: -Math.max(0, (innerHeight - item.offsetHeight) / 2), duration: 1.4 }), 60);
    else item.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  });

  /* ---------- Форма заявки (в секции и в окне) ---------- */
  const tpl = $('#apply-form-tpl');
  const CONTACT = {
    telegram: { label: 'Ник в Telegram или номер*', ph: '@username', type: 'text', ac: 'off', err: 'Укажите ник или номер', ok: v => /^@?[a-zA-Z0-9_]{5,32}$/.test(v) || /^\+?[\d\s()-]{10,18}$/.test(v) },
    phone: { label: 'Номер телефона*', ph: '+7 900 000-00-00', type: 'tel', ac: 'tel', err: 'Проверьте номер: +7 900 000-00-00', ok: v => v.replace(/\D/g, '').length >= 11 },
    email: { label: 'Email*', ph: 'name@example.ru', type: 'email', ac: 'email', err: 'Проверьте адрес почты', ok: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) },
  };
  $$('[data-form-slot]').forEach((slot, k) => {
    const id = slot.dataset.formSlot;
    slot.innerHTML = tpl.innerHTML.replaceAll('{id}', id);
    const form = $('[data-apply-form]', slot);
    const success = $('[data-apply-success]', slot);
    const contact = form.elements.contact;
    function setMethod(m) {
      const c = CONTACT[m];
      $('[data-contact-label]', form).textContent = c.label;
      contact.placeholder = c.ph; contact.type = c.type; contact.autocomplete = c.ac;
      $('[data-contact-error]', form).textContent = c.err;
    }
    $$('input[name="method"]', form).forEach(r => r.addEventListener('change', () => setMethod(r.value)));
    // Состав компании и размещение: варианты зависят от того, сколько человек едет.
    // Цена — за человека (одноместное дороже), итог = цена × число людей, с анимацией пересчёта.
    const BASE = 72000, SINGLE = 84000, MAX_GUESTS = 6;
    const PLACEMENT = {
      1: [{ v: 'share', t: 'Подселение к участнику', d: 'Своя кровать в номере на двоих, соседа согласуем заранее', p: BASE },
          { v: 'single', t: 'Отдельный номер', d: 'Весь номер только для вас', p: SINGLE }],
      2: [{ v: 'double', t: 'Одна большая кровать', d: 'Номер «Катунь»', p: BASE },
          { v: 'twin', t: 'Две отдельные кровати', d: 'Номер «Чемал» или «Ая»', p: BASE }],
      3: [{ v: 'double-single', t: 'Большая кровать и одна отдельная', d: 'Номер «Кедр»', p: BASE },
          { v: 'triple', t: 'Три отдельные кровати', d: 'Номер «Тайга»', p: BASE }],
      4: [{ v: 'family', t: 'Семейный номер на четверых', d: '«Белуха»: большая кровать и две отдельные', p: BASE },
          { v: 'two-rooms', t: 'Два номера по двое', d: 'Кровати в каждом подберём вместе с вами', p: BASE }],
      5: [{ v: 'pick', t: 'Подберите номера за нас', d: 'Предложим, как удобнее расселиться, когда свяжемся', p: BASE }],
      6: [{ v: 'pick', t: 'Подберите номера за нас', d: 'Предложим, как удобнее расселиться, когда свяжемся', p: BASE }],
    };
    const HINT = { 1: '', 2: 'Можно поменять при подтверждении брони.', 3: 'Можно поменять при подтверждении брони.', 4: 'Можно поменять при подтверждении брони.',
      5: 'В заезде до 10 человек — вы займёте половину группы. Пожелания по номерам напишите в вопросе.',
      6: 'Вас больше шести? Напишите в вопросе — обсудим отдельный заезд для вашей компании.' };
    const peopleWord = n => n === 1 ? 'человек' : n < 5 ? 'человека' : 'человек';
    const FOR = { 1: 'Итого за одного', 2: 'Итого за двоих', 3: 'Итого за троих', 4: 'Итого за четверых', 5: 'Итого за пятерых', 6: 'Итого за шестерых' };
    const priceEl = $('[data-form-price]', form);
    const priceBox = priceEl.closest('.form-price');
    const optsBox = $('[data-placement-options]', form);
    let guests = 1, shown = BASE, priceRaf = 0;
    const fmt = n => Math.round(n).toLocaleString('ru-RU').replace(/ | |,/g, ' ');
    function setPrice(to, animate = true) {
      cancelAnimationFrame(priceRaf);
      const from = shown;
      if (!animate || reduce || from === to) { shown = to; priceEl.textContent = fmt(to); priceBox.classList.remove('is-counting'); return; }
      const t0 = performance.now(), dur = 700;
      priceBox.classList.add('is-counting');
      const step = now => {
        const t = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - t, 3); // easeOutCubic
        shown = from + (to - from) * e;
        priceEl.textContent = fmt(Math.round(shown / 100) * 100);
        if (t < 1) priceRaf = requestAnimationFrame(step);
        else { shown = to; priceEl.textContent = fmt(to); priceBox.classList.remove('is-counting'); }
      };
      priceRaf = requestAnimationFrame(step);
    }
    function currentOption() {
      const v = form.elements.placement && form.elements.placement.value;
      return PLACEMENT[guests].find(o => o.v === v) || PLACEMENT[guests][0];
    }
    function updatePrice(animate = true) {
      const o = currentOption();
      $('[data-price-for]', form).textContent = FOR[guests];
      $('[data-price-pp]', form).textContent = fmt(o.p) + ' ₽ за человека';
      setPrice(o.p * guests, animate);
    }
    function renderPlacement(animate = true) {
      optsBox.innerHTML = PLACEMENT[guests].map((o, k) => `<label class="radio-card radio-card--rich"><input type="radio" name="placement" value="${o.v}"${k === 0 ? ' checked' : ''}><span class="radio"></span><span class="radio-card__text"><span class="radio-card__title">${o.t}</span><span class="radio-card__desc">${o.d}${o.p !== BASE ? ' · ' + fmt(o.p) + ' ₽' : ''}</span></span></label>`).join('');
      $$('input', optsBox).forEach(r => r.addEventListener('change', () => updatePrice()));
      const hint = $('[data-placement-hint]', form); hint.textContent = HINT[guests]; hint.hidden = !HINT[guests];
      updatePrice(animate);
    }
    function setGuests(n, animate = true) {
      guests = Math.min(MAX_GUESTS, Math.max(1, n));
      form.elements.guests.value = guests;
      $('[data-guests-value]', form).textContent = guests + ' ' + peopleWord(guests);
      $$('[data-guests-step]', form).forEach(b => { b.disabled = (+b.dataset.guestsStep < 0 && guests === 1) || (+b.dataset.guestsStep > 0 && guests === MAX_GUESTS); });
      renderPlacement(animate);
    }
    $$('[data-guests-step]', form).forEach(b => b.addEventListener('click', () => setGuests(guests + +b.dataset.guestsStep)));
    form.addEventListener('reset', () => setTimeout(() => setGuests(1, false)));
    // Чтобы секция не «прыгала» при смене числа людей, блок размещения всегда занимает
    // высоту самого высокого из вариантов (меряем все варианты один раз и при изменении ширины)
    const placementField = $('[data-field="placement"]', form);
    function lockPlacementHeight() {
      if (!placementField.offsetWidth) return; // форма скрыта (окно закрыто) — измерим при открытии
      const keep = guests, keepV = form.elements.placement && form.elements.placement.value;
      placementField.style.minHeight = '';
      let max = 0;
      for (let n = 1; n <= MAX_GUESTS; n++) { guests = n; renderPlacement(false); max = Math.max(max, placementField.offsetHeight); }
      guests = keep; renderPlacement(false);
      const r = keepV && $(`input[value="${keepV}"]`, optsBox); if (r) { r.checked = true; updatePrice(false); }
      placementField.style.minHeight = max + 'px';
    }
    setGuests(1, false);
    lockPlacementHeight();
    let lockT = 0;
    window.addEventListener('resize', () => { clearTimeout(lockT); lockT = setTimeout(lockPlacementHeight, 150); });
    new ResizeObserver(() => { if (!placementField.style.minHeight) lockPlacementHeight(); }).observe(placementField);
    function fieldState(name, bad) {
      const f = $(`[data-field="${name}"]`, form);
      f.classList.toggle('is-error', bad);
      const er = $('.field__error', f); if (er) er.hidden = !bad;
      const inp = $('input, textarea', f); if (inp) inp.setAttribute('aria-invalid', String(bad));
    }
    function validate() {
      const m = form.elements.method.value;
      const errs = {
        name: !form.elements.name.value.trim(),
        contact: !CONTACT[m].ok(contact.value.trim()),
        consent: !form.elements.consent.checked,
      };
      Object.entries(errs).forEach(([n, b]) => fieldState(n, b));
      return errs;
    }
    $$('input, textarea', form).forEach(i => i.addEventListener('input', () => { if (form.classList.contains('was-validated')) validate(); }));
    form.addEventListener('submit', e => {
      e.preventDefault();
      form.classList.add('was-validated');
      const errs = validate();
      const bad = Object.keys(errs).filter(k => errs[k]);
      $('[data-form-error]', form).hidden = !bad.length;
      if (bad.length) { const first = $(`[data-field="${bad[0]}"] input`, form); first && first.focus(); return; }
      const btn = $('button[type="submit"]', form);
      btn.setAttribute('aria-busy', 'true'); btn.disabled = true;
      $('[data-submit-label]', btn).textContent = 'Отправляем…';
      setTimeout(() => { // демонстрация: данные никуда не отправляются
        btn.removeAttribute('aria-busy'); btn.disabled = false;
        $('[data-submit-label]', btn).textContent = 'Оставить заявку';
        form.hidden = true; success.hidden = false; success.focus();
      }, 900);
    });
    $('[data-apply-reset]', success).addEventListener('click', () => {
      form.reset(); setMethod('telegram'); form.classList.remove('was-validated');
      ['name', 'contact', 'consent'].forEach(n => fieldState(n, false));
      $('[data-form-error]', form).hidden = true;
      success.hidden = true; form.hidden = false; form.elements.name.focus();
    });
  });
  const bookingModal = $('#booking-modal');
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-open-booking]')) return;
    e.preventDefault();
    if (mobile.matches) { $$('.modal').forEach(m => { if (!m.hidden) closeModal(m); }); goTo('#booking'); return; }
    openModal(bookingModal);
    setTimeout(() => { const n = $('input[name="name"]', bookingModal); n && n.focus(); }, 50);
  });

  /* ---------- Документы ---------- */
  const legalModal = $('#legal-modal');
  const legalEl = $('[data-legal]');
  function para(t) { return t.split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>').replace(/\[([^\]]+)\]/g, '<mark style="background:var(--color-surface-warm);padding:0 2px">[$1]</mark>')}</p>`).join(''); }
  function openLegal(key) {
    const doc = D.LEGAL[key]; if (!doc) return;
    const [title, meta, note] = doc.intro;
    legalEl.innerHTML = `<header class="legal-modal__head"><div><h2 class="t-section-sm" id="legal-title">${title}</h2><p class="t-small">${meta}</p><p class="t-small">${note}</p></div>
      <button class="icon-btn" type="button" data-close aria-label="Закрыть">${icon('x', 'icon--24')}</button></header>
      <div class="legal-modal__body">${doc.secs.map(([q, a], i) => `<div class="legal-sec"><button class="legal-sec__q" type="button" aria-expanded="${i === 0}" aria-controls="lg-${i}"><span>${q}</span>${icon('chevron-down')}</button>
        <div class="collapse legal-sec__a${i === 0 ? ' is-open' : ''}" id="lg-${i}"><div><div>${para(a)}</div></div></div></div>`).join('')}
        ${key === 'cookie' ? `<div class="legal-modal__actions"><button class="btn btn--secondary" type="button" data-cookie-choice="necessary">Только обязательные</button><button class="btn btn--primary" type="button" data-cookie-choice="all">Принять все</button></div><p class="t-small" style="margin-top:12px;color:var(--color-text-tertiary)" data-cookie-state></p>` : ''}
      </div>`;
    if (key === 'cookie') showCookieState();
    openModal(legalModal);
  }
  legalEl.addEventListener('click', e => {
    const q = e.target.closest('.legal-sec__q'); if (!q) return;
    const open = q.getAttribute('aria-expanded') !== 'true';
    q.setAttribute('aria-expanded', String(open));
    document.getElementById(q.getAttribute('aria-controls')).classList.toggle('is-open', open);
  });
  document.addEventListener('click', e => { const l = e.target.closest('[data-open-legal]'); if (l) { e.preventDefault(); openLegal(l.dataset.openLegal); } });

  /* ---------- Cookie ---------- */
  const cookie = $('[data-cookie]');
  function showCookieState() {
    const s = $('[data-cookie-state]'); if (!s) return;
    const v = store.get('altai_consent');
    s.textContent = v === 'all' ? 'Сейчас: приняты все cookie.' : v === 'necessary' ? 'Сейчас: только обязательные cookie.' : 'Выбор ещё не сделан.';
  }
  if (!store.get('altai_consent')) setTimeout(() => { cookie.hidden = false; }, 1200);
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-cookie-choice]'); if (!c) return;
    store.set('altai_consent', c.dataset.cookieChoice);
    cookie.hidden = true; showCookieState();
  });

  /* ---------- Телефон: меню, липкая плашка, свайп-ленты ---------- */
  function goTo(sel) {
    const el = typeof sel === 'string' ? $(sel) : sel; if (!el) return;
    if (lenis) lenis.scrollTo(el, { duration: 1.2 }); else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }
  // Меню
  const mnav = $('#mnav'), burger = $('[data-menu-open]');
  function menu(open) {
    if (open === !mnav.hidden) return;
    mnav.hidden = !open;
    burger.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('has-menu', open);
    if (lenis) open ? lenis.stop() : lenis.start();
    if (open) $('[data-menu-close]', mnav).focus(); else burger.focus({ preventScroll: true });
  }
  burger.addEventListener('click', () => menu(true));
  mnav.addEventListener('click', e => { if (e.target.closest('[data-menu-close]')) menu(false); });
  // ссылки меню и плашки: закрыть меню, затем плавно к разделу (сами, чтобы Lenis не был остановлен)
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-menu-link]'); if (!a) return;
    e.preventDefault(); e.stopPropagation();
    menu(false); goTo(a.getAttribute('href'));
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !mnav.hidden) menu(false); });
  touch.addEventListener('change', () => { if (!touch.matches) menu(false); });

  // Липкая плашка: после hero, прячется над формой, в подвале и при открытой клавиатуре
  const bar = $('[data-stickybar]');
  const zones = new Map();
  function barUpdate() {
    const past = window.scrollY > hero.offsetHeight * 0.8;
    const hidden = [...zones.values()].some(Boolean);
    const typing = document.activeElement && document.activeElement.matches('input, textarea, select');
    const show = mobile.matches && past && !hidden && !typing;
    bar.classList.toggle('is-shown', show);
    bar.setAttribute('aria-hidden', String(!show));
    $('a', bar).tabIndex = show ? 0 : -1;
  }
  const barIO = new IntersectionObserver(es => { es.forEach(e => zones.set(e.target, e.isIntersecting)); barUpdate(); });
  [$('#booking'), $('[data-footer-reveal]')].forEach(el => el && barIO.observe(el));
  window.addEventListener('scroll', barUpdate, { passive: true });
  document.addEventListener('focusin', barUpdate); document.addEventListener('focusout', () => setTimeout(barUpdate, 50));
  mobile.addEventListener('change', barUpdate); barUpdate();

  // Свайп-ленты: счётчик «1 / N», полоска прогресса и подсказка-жест на первой карточке
  function swipe(track, { onIndex, label } = {}) {
    const box = document.createElement('div'); box.className = 'swipe';
    track.parentNode.insertBefore(box, track); box.appendChild(track);
    track.classList.add('swipe__track');
    const meta = document.createElement('div'); meta.className = 'swipe__meta';
    meta.innerHTML = '<div class="swipe__bar" aria-hidden="true"></div><p class="swipe__count t-label-strong" aria-live="polite"></p>';
    box.appendChild(meta);
    const hint = document.createElement('span'); hint.className = 'swipe__hint'; hint.setAttribute('aria-hidden', 'true');
    hint.innerHTML = icon('chevrons-left', 'icon--16') + icon('pointer', 'icon--24');
    box.appendChild(hint);
    let i = -1;
    const items = () => Array.from(track.children).filter(c => getComputedStyle(c).display !== 'none');
    function sync(force) {
      const list = items(); if (!list.length) return;
      const step = list.length > 1 ? list[1].offsetLeft - list[0].offsetLeft : 1;
      const max = track.scrollWidth - track.clientWidth;
      let k = Math.round(track.scrollLeft / step);
      if (track.scrollLeft >= max - 4) k = list.length - 1;
      k = Math.max(0, Math.min(list.length - 1, k));
      const bars = $('.swipe__bar', meta);
      if (force || bars.children.length !== list.length) bars.innerHTML = list.map(() => '<span></span>').join('');
      if (k === i && !force) return;
      i = k;
      Array.from(bars.children).forEach((b, n) => b.classList.toggle('is-on', n === k));
      $('.swipe__count', meta).textContent = `${k + 1} / ${list.length}`;
      if (onIndex) onIndex(k);
    }
    let raf = 0;
    track.addEventListener('scroll', () => {
      box.classList.add('is-touched');
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; sync(); });
    }, { passive: true });
    new MutationObserver(() => { track.scrollLeft = 0; i = -1; sync(true); }).observe(track, { childList: true });
    touch.addEventListener('change', () => sync(true));
    window.addEventListener('resize', () => sync(true));
    sync(true);
    return { sync };
  }
  swipe($('.team__cards'));
  // Программа: «Личный лист» на телефоне стоит после ленты дней
  const note = $('.note-card', daysEl);
  const noteHome = document.createElement('div'); noteHome.className = 'program__note';
  daysEl.parentNode.appendChild(noteHome);
  swipe(daysEl);
  function placeNote() { (touch.matches ? noteHome : daysEl).appendChild(note); }
  touch.addEventListener('change', placeNote); placeNote();
  // Галерея проживания: на телефоне листается свайпом, подпись под фото
  swipe(slides, { onIndex: k => { if (touch.matches && k !== idx) { idx = k; update(); } } });

  // «Проживание»: короткие пункты на телефоне сворачиваются
  $$('.base-facts .info-col').forEach((col, n) => {
    const t = $('.info-col__title', col), body = $('p.t-body', col);
    const id = 'fact-' + n; body.id = id;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'info-col__toggle'; btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', id);
    btn.innerHTML = t.innerHTML + icon('chevron-down', 'info-col__chev');
    t.after(btn);
    btn.addEventListener('click', () => { const o = btn.getAttribute('aria-expanded') !== 'true'; btn.setAttribute('aria-expanded', String(o)); col.classList.toggle('is-open', o); });
  });

  // FAQ: на телефоне сначала 7 вопросов (как в макете)
  (function () {
    const list = $('[data-faq-items]', faq);
    const rest = $$('.faq-item', list).length - 7; if (rest <= 0) return;
    const more = document.createElement('button');
    more.type = 'button'; more.className = 'btn btn--secondary btn--block faq__more'; more.dataset.faqMore = '';
    const word = n => (n % 10 === 1 && n % 100 !== 11) ? 'вопрос' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) ? 'вопроса' : 'вопросов';
    more.innerHTML = `Показать ещё ${rest} ${word(rest)} ${icon('chevron-down')}`;
    list.after(more);
    more.addEventListener('click', () => { list.classList.add('is-all'); more.hidden = true; });
  })();

  // «Что будет после заявки» под формой (телефон)
  $$('[data-after-apply]').forEach(b => b.addEventListener('click', () => {
    const o = b.getAttribute('aria-expanded') !== 'true';
    b.setAttribute('aria-expanded', String(o)); b.closest('.after-apply').classList.toggle('is-open', o);
    document.getElementById(b.getAttribute('aria-controls')).hidden = !o;
  }));

  // ленты, которые листаются свайпом, доступны и с клавиатуры (стрелками после Tab)
  [['.reel__strip', 'Фотографии поездки'], ['.gallery__slides', 'Фотографии базы']].forEach(([sel, label]) => $$(sel).forEach(el => {
    el.tabIndex = 0; el.setAttribute('role', 'region'); el.setAttribute('aria-label', label);
  }));

  /* ---------- Ссылки на документы и дни из адреса ---------- */
  const h = location.hash;
  if (h.startsWith('#legal-')) openLegal(h.slice(7));
  const dm = /^#day-([1-5])$/.exec(h);
  if (dm) { renderDay(+dm[1], false); openModal(dayModal); }
})();
