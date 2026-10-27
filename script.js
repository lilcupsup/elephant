(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const recorder = new URLSearchParams(location.search).get('rec') === '1';
  const reducedMotion = !recorder && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const page = $('#page');
  const hero = $('.hero');
  const stage = $('.hero-stage');
  const melt = $('.hero-melt');
  const photoLayer = $('.photo-layer');
  const cutoutLayer = $('.cutout-layer');
  const portraitParallax = $('.portrait-parallax');
  const portrait = $('.portrait');
  const timeline = [];
  let origin = 0;
  let recorderAnimation;
  let framePending = false;
  let lastScroll = -1;
  let lastViewport = 0;

  // No fetch(), modules, dependencies or server: this also runs from file://.
  $$('[data-split]').forEach(element => {
    const words = element.textContent.trim().split(/\s+/);
    const fragments = words.flatMap((word, index) => {
      const wrapper = document.createElement('span');
      wrapper.className = 'word';
      for (const character of word) {
        const letter = document.createElement('span');
        letter.className = 'letter';
        letter.textContent = character;
        wrapper.append(letter);
      }
      return index ? [document.createTextNode(' '), wrapper] : [wrapper];
    });
    element.replaceChildren(...fragments);
  });

  // The badge has exactly 48 individually drawn radial ticks.
  const ring = $('.tick-ring');
  for (let index = 0; index < 48; index++) {
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tick.setAttribute('x1', '50');
    tick.setAttribute('y1', index % 4 === 0 ? '3' : '6');
    tick.setAttribute('x2', '50');
    tick.setAttribute('y2', '12');
    tick.setAttribute('transform', `rotate(${index * 7.5} 50 50)`);
    ring.append(tick);
  }

  function animate(element, keyframes, options = {}, at = 0) {
    if (!element) return;
    const animation = element.animate(keyframes, {
      duration: 1000,
      fill: 'both',
      easing: 'cubic-bezier(.22,1,.36,1)',
      ...options,
      ...(reducedMotion ? { duration: 1, delay: 0 } : {})
    });
    animation.startTime = origin + (reducedMotion ? 0 : at);
    timeline.push({ animation, at: reducedMotion ? 0 : at });
    return animation;
  }

  function fadeUp(element, at, delay = 0, distance = 22, duration = 1000) {
    return animate(element, [
      { opacity: 0, transform: `translateY(${distance}px)` },
      { opacity: 1, transform: 'translateY(0)' }
    ], { delay, duration }, at);
  }

  function revealLetters(selector, at, stagger) {
    $$(selector).forEach((letter, index) => animate(letter, [
      { opacity: 0, transform: 'translateY(.55em) rotate(4deg)' },
      { opacity: 1, transform: 'translateY(0) rotate(0deg)' }
    ], { duration: 850, delay: 120 + index * stagger }, at));
  }

  function revealHero() {
    [photoLayer, cutoutLayer].forEach(layer => animate(layer,
      [{ transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 2200 }));
    animate($('.navigation'), [
      { opacity: 0, translate: '0 -14px' }, { opacity: 1, translate: '0 0' }
    ], { duration: 1200, delay: 100 });
    animate($('.hero-eyebrow'), [
      { opacity: 0, transform: 'translateY(-12px)' }, { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 1100, delay: 200 });
    $$('[data-split="hero"] .letter').forEach((letter, index) => animate(letter, [
      { opacity: 0, transform: 'translateY(.18em)', filter: 'blur(10px)' },
      { opacity: 1, transform: 'translateY(0)', filter: 'blur(0px)' }
    ], { duration: 1250, delay: 350 + index * 95 }));
    animate($('.map-pill'), [
      { opacity: 0, transform: 'translate(-50%,22px)' },
      { opacity: 1, transform: 'translate(-50%,0)' }
    ], { delay: 1050, duration: 1100 });
    [$('.hero-edition'), $('.scroll-cue')].forEach(element => fadeUp(element, 0, 1200, 10));
  }

  function revealStatement(at) {
    fadeUp($('.statement-content>.section-label'), at, 0, 14);
    revealLetters('[data-split="statement"] .letter', at, 26);
    let readingIndex = 0;
    $$('.statement-title .letter, .statement-title .photo-pill').forEach(element => {
      if (element.classList.contains('letter')) {
        readingIndex++;
        return;
      }
      const delay = 200 + readingIndex * 26;
      animate(element, [
        { opacity: 0, transform: 'scale(0)' },
        { opacity: 1, transform: 'scale(1.09)', offset: .72 },
        { opacity: 1, transform: 'scale(1)' }
      ], { duration: 1050, delay, easing: 'cubic-bezier(.2,.8,.25,1)' }, at);
      animate($('img', element), [{ transform: 'scale(1.5)' }, { transform: 'scale(1)' }], { duration: 1600, delay }, at);
    });
    animate($('.emblem'), [
      { opacity: 0, transform: 'rotate(-90deg) scale(.6)' },
      { opacity: 1, transform: 'rotate(0deg) scale(1)' }
    ], { delay: 450, duration: 1500 }, at);
  }

  function revealFacts(at) {
    fadeUp($('.facts-heading-column>.section-label'), at, 0, 14);
    revealLetters('[data-split="facts"] .letter', at, 30);
    fadeUp($('.play-button'), at, 580, 14);
    fadeUp($('.facts-intro'), at, 200);
    fadeUp($('.facts-table'), at, 350);
    $$('.fact-row').forEach((row, index) => fadeUp(row, at, 500 + index * 130, 10, 800));
    fadeUp($('.field-note'), at, 950, 12);
    animate(portrait, [
      { opacity: 1, clipPath: 'inset(100% 0 0 0)' },
      { opacity: 1, clipPath: 'inset(0% 0 0 0)' }
    ], { duration: 1200, delay: 150 }, at);
    animate($('.portrait img'), [
      { transform: 'scale(1.25)' }, { transform: 'scale(1)' }
    ], { duration: 1800, delay: 150 }, at);
  }

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

  function getScrollPosition() {
    if (!recorder) return window.scrollY;
    // Read the rendered WAAPI transform, not elapsed wall-clock time. Scrubbing
    // the animation therefore also scrubs every scroll-linked visual effect.
    const transform = getComputedStyle(page).transform;
    return transform === 'none' ? 0 : -new DOMMatrixReadOnly(transform).m42;
  }

  function updateScrollEffects(force = false) {
    const y = getScrollPosition();
    const viewport = hero.clientHeight;
    if (!force && y === lastScroll && viewport === lastViewport) return;
    lastScroll = y;
    lastViewport = viewport;
    const progress = clamp(y / (viewport * .6));
    stage.style.translate = `0 ${reducedMotion ? 0 : y * .32}px`;
    melt.style.height = `${34 + progress * 66}%`;
    melt.style.opacity = `${.18 + progress * .82}`;
    // A fully opaque paper cap lets the photograph truly disappear at 60vh.
    melt.style.background = `linear-gradient(to bottom,rgba(236,227,209,${progress}) 0%,rgba(236,227,209,${.38 + progress * .62}) 35%,#ECE3D1 100%)`;
    photoLayer.style.filter = cutoutLayer.style.filter = `blur(${reducedMotion ? 0 : progress * 6}px)`;
    const rect = portrait.getBoundingClientRect();
    const travel = clamp((innerHeight - rect.top) / (innerHeight + rect.height));
    portraitParallax.style.transform = `translateY(${reducedMotion ? 0 : (travel * 2 - 1) * 7}%)`;
  }

  function scheduleScrollEffects() {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(() => {
      updateScrollEffects();
      framePending = false;
    });
  }

  function setupRecorder() {
    window.scrollTo(0, 0);
    const second = $('#statement').offsetTop;
    const third = $('#facts').offsetTop;
    recorderAnimation = animate(page, [
      { transform: 'translate3d(0,0,0)', offset: 0 },
      { transform: 'translate3d(0,0,0)', offset: 1950 / 6500, easing: 'cubic-bezier(.65,0,.35,1)' },
      { transform: `translate3d(0,${-second}px,0)`, offset: 3350 / 6500 },
      { transform: `translate3d(0,${-second}px,0)`, offset: 4250 / 6500, easing: 'cubic-bezier(.65,0,.35,1)' },
      { transform: `translate3d(0,${-third}px,0)`, offset: 5550 / 6500 },
      { transform: `translate3d(0,${-third}px,0)`, offset: 1 }
    ], { duration: 6500, easing: 'linear' });
    revealStatement(2650);
    revealFacts(4850);
    function recorderFrame() {
      updateScrollEffects();
      requestAnimationFrame(recorderFrame);
    }
    requestAnimationFrame(recorderFrame);
    // Small recorder API for exact, repeatable captures. All animations share
    // one origin, including the 16-second tick ring.
    window.tanaRecorder = Object.freeze({
      duration: 6500,
      seek(milliseconds) {
        const time = clamp(milliseconds, 0, 6500);
        timeline.forEach(({ animation, at }) => { animation.pause(); animation.currentTime = time - at; });
        updateScrollEffects(true);
      },
      play() {
        const time = recorderAnimation.currentTime || 0;
        origin = document.timeline.currentTime - time;
        timeline.forEach(({ animation, at }) => { animation.play(); animation.startTime = origin + at; });
      }
    });
  }

  async function start() {
    await Promise.all([
      document.fonts.ready,
      ...$$('main img').map(image => image.decode().catch(() => {}))
    ]);
    origin = document.timeline.currentTime;
    revealHero();
    if (!reducedMotion) animate(ring, [
      { transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }
    ], { duration: 16000, iterations: Infinity, easing: 'linear' });
    if (recorder) setupRecorder();
    else {
      [$('#statement'), $('#facts')].forEach(section => {
        // Long, stacked phone sections can exceed a viewport. Use 35% of
        // the smaller visible area so landscape phones can also reveal them.
        const threshold = Math.min(.35, innerHeight * .35 / section.offsetHeight);
        const observer = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            if (!entry.isIntersecting || entry.intersectionRatio < threshold) return;
            const at = document.timeline.currentTime - origin;
            if (entry.target.id === 'statement') revealStatement(at);
            else revealFacts(at);
            observer.unobserve(entry.target);
          });
        }, { threshold });
        observer.observe(section);
      });
      addEventListener('scroll', scheduleScrollEffects, { passive: true });
    }
    addEventListener('resize', () => updateScrollEffects(true), { passive: true });
    updateScrollEffects(true);
    document.documentElement.dataset.ready = 'true';
  }

  // Native dialogs provide Escape dismissal, keyboard focus containment and
  // focus restoration; every displayed navigation item has a real destination.
  let activeOpener;
  let savedOverflow = '';
  function openDialog(dialog, opener) {
    activeOpener = opener;
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    if (dialog.id === 'search-dialog') { renderSearch(''); $('#guide-search').focus(); }
    if (dialog.id === 'film-dialog') startFilm();
  }
  $$('[data-dialog]').forEach(button => button.addEventListener('click', () => openDialog(document.getElementById(button.dataset.dialog), button)));
  $$('dialog').forEach(dialog => {
    $('.dialog-close', dialog).addEventListener('click', () => dialog.close());
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dialog.close();
      }
    }, { capture: true });
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
    dialog.addEventListener('close', () => {
      document.body.style.overflow = savedOverflow;
      if (dialog.id === 'film-dialog') stopFilm();
      activeOpener?.focus({ preventScroll: true });
    });
    $$('a[href^="#"]', dialog).forEach(link => link.addEventListener('click', () => dialog.close()));
  });

  const searchEntries = [
    { title: 'Meet the African bush elephant', text: 'Elephant · Loxodonta africana · The largest land animal on the planet.', target: '#statement' },
    { title: 'Habitat', text: 'Woodland and savanna. Explore the landscapes of the African bush.', target: '#facts' },
    { title: 'Scientific name', text: 'Loxodonta africana — the African bush elephant.', target: '#facts' },
    { title: 'Adult weight', text: '2,000 – 6,300 kg.', target: '#facts' },
    { title: 'IUCN status', text: 'Vulnerable.', target: '#facts' },
    { title: 'A keystone species', text: 'Pathways, seeds and waterholes: an elephant shapes an entire ecosystem.', target: '#facts' }
  ];
  function renderSearch(query) {
    const search = query.trim().toLowerCase();
    const matches = searchEntries.filter(entry => `${entry.title} ${entry.text}`.toLowerCase().includes(search));
    const results = $('#search-results');
    results.replaceChildren();
    if (!matches.length) {
      const message = document.createElement('p');
      message.textContent = 'No field notes found. Try “habitat”, “weight” or “elephant”.';
      results.append(message);
    }
    matches.forEach(entry => {
      const link = document.createElement('a');
      const title = document.createElement('strong');
      const text = document.createElement('p');
      link.href = entry.target;
      title.textContent = entry.title;
      text.textContent = entry.text;
      link.append(title, text);
      link.addEventListener('click', () => $('#search-dialog').close());
      results.append(link);
    });
  }
  $('#guide-search').addEventListener('input', event => renderSearch(event.target.value));

  // The supplied stills form a local seven-minute, silent visual journal.
  // It is a real timed photo sequence, with pause and seek, rather than a
  // placeholder video control or a dependency on an unavailable video service.
  const chapters = [
    { at: 0, image: 'hero.jpg', title: 'In the elephant’s footsteps', caption: 'Take a moment. Let the landscape come to you.', alt: 'An elephant walking through golden savanna.' },
    { at: 84, image: 'savanna.jpg', title: 'A landscape, connected', caption: 'Grassland gives way to woodland. The elephant makes a path between them.', alt: 'An elephant in an open savanna beneath acacia trees.' },
    { at: 168, image: 'portrait.jpg', title: 'Written in the skin', caption: 'An ancient presence. A quiet intelligence. A life in close detail.', alt: 'A close profile of an elephant against green foliage.' },
    { at: 252, image: 'family.jpg', title: 'Never walking alone', caption: 'Across generations, the journey continues.', alt: 'A mother elephant and calf silhouetted at sunset.' },
    { at: 336, image: 'hero.jpg', title: 'Leave room for the wild', caption: 'A keystone species. An entire world in its footsteps.', alt: 'A long-tusked elephant moving through the African bush.' }
  ];
  let filmTime = 0;
  let filmPlaying = false;
  let filmFrame = 0;
  let filmLastTime = 0;
  let filmChapter = -1;

  function drawFilm() {
    const chapterIndex = chapters.findLastIndex(chapter => filmTime >= chapter.at);
    const chapter = chapters[chapterIndex];
    if (chapterIndex !== filmChapter) {
      filmChapter = chapterIndex;
      $('.film-image').src = `assets/${chapter.image}`;
      $('.film-image').alt = chapter.alt;
      $('#film-title').textContent = chapter.title;
      $('#film-caption').textContent = chapter.caption;
    }
    $('#film-progress').value = Math.floor(filmTime);
    $('#film-time').textContent = `${Math.floor(filmTime / 60)}:${String(Math.floor(filmTime % 60)).padStart(2, '0')} / 7:00`;
    $('#film-toggle').textContent = filmPlaying ? 'Pause' : filmTime >= 420 ? 'Replay' : 'Play';
    $('#film-dialog').classList.toggle('is-paused', !filmPlaying);
  }
  function filmTick(timestamp) {
    if (filmPlaying && filmLastTime) filmTime = Math.min(420, filmTime + (timestamp - filmLastTime) / 1000);
    filmLastTime = timestamp;
    if (filmTime >= 420) filmPlaying = false;
    drawFilm();
    filmFrame = requestAnimationFrame(filmTick);
  }
  function startFilm() {
    filmTime = 0; filmLastTime = 0; filmChapter = -1; filmPlaying = true;
    drawFilm();
    filmFrame = requestAnimationFrame(filmTick);
  }
  function stopFilm() { cancelAnimationFrame(filmFrame); filmPlaying = false; drawFilm(); }
  $('#film-toggle').addEventListener('click', () => {
    if (filmTime >= 420) filmTime = 0;
    filmPlaying = !filmPlaying; filmLastTime = 0; drawFilm();
  });
  $('#film-progress').addEventListener('input', event => { filmTime = Number(event.target.value); filmLastTime = 0; drawFilm(); });

  start().catch(error => {
    // Keep the entire journal readable even if a browser lacks an animation API.
    console.error('The journal animation could not start:', error);
    document.documentElement.classList.remove('js', 'rec');
  });
})();
