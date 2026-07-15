/* ═══════════════════════════════════════
   FLAMINGOS — SCRIPT.JS
   Replicates npconchain.xyz interactions
═══════════════════════════════════════ */

(function () {
  'use strict';

  document.documentElement.classList.add('motion-ready');

  // ── REFS ─────────────────────────────────
  const menuBtn = document.getElementById('menu-btn');
  const menuIcon = document.getElementById('menu-icon');
  const headerNav = document.getElementById('header-nav');
  const headerPill = document.querySelector('.header-pill');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const randomBtn = document.getElementById('random-btn');
  const downloadBtn = document.getElementById('download-btn');
  const viewerImg = document.getElementById('viewer-img');
  const dotsWrap = document.getElementById('viewer-dots');
  const scrollToFlock = document.getElementById('scroll-to-flock');
  const viewerSection = document.getElementById('viewer');

  scrollToFlock && scrollToFlock.addEventListener('click', () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    viewerSection.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });

    if (!reduceMotion) {
      window.setTimeout(() => {
        viewerSection.classList.remove('scroll-arrival');
        void viewerSection.offsetWidth;
        viewerSection.classList.add('scroll-arrival');
      }, 420);
    }
  });

  // ── COLLECTION IMAGES ─────────────────────
  const collectionImages = [
    'nft/8.png',
    'nft/12.png',
    'nft/13.png',
    'nft/18.png',
    'nft/19.png',
    'nft/20.png',
    'nft/21.png',
    'nft/22.png',
    'nft/23.png',
    'nft/24.png',
    'nft/25.png',
    'nft/46.png'
  ];
  const TOTAL_DOTS = collectionImages.length;
  let currentIndex = 0;
  let navOpen = false;

  collectionImages.forEach((src) => {
    const image = new Image();
    image.src = src;
  });

  // ── SCROLL REVEALS ────────────────────────
  const revealItems = document.querySelectorAll(
    '.viewer-title, .viewer-supply, .viewer-card, .viewer-controls, .viewer-dots, .site-footer'
  );

  revealItems.forEach((item, index) => {
    item.classList.add('reveal-item');
    item.style.setProperty('--reveal-delay', `${Math.min(index * 70, 280)}ms`);
  });

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -6% 0px' });

    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  // ── BUILD DOTS ───────────────────────────
  for (let i = 0; i < TOTAL_DOTS; i++) {
    const dot = document.createElement('button');
    dot.className = 'dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', 'Go to flamingo ' + (i + 1));
    dot.dataset.idx = i;
    dot.addEventListener('click', () => goTo(i));
    dotsWrap.appendChild(dot);
  }

  function updateDots(idx) {
    document.querySelectorAll('.dot').forEach((d, i) => {
      d.classList.toggle('active', i === idx);
    });
  }

  // ── VIEWER NAV ───────────────────────────
  function goTo(idx) {
    if (idx < 0) idx = TOTAL_DOTS - 1;
    if (idx >= TOTAL_DOTS) idx = 0;
    currentIndex = idx;

    viewerImg.classList.add('fading');
    setTimeout(() => {
      viewerImg.src = collectionImages[currentIndex];
      viewerImg.alt = 'Flamingo NFT ' + (currentIndex + 1);
      viewerImg.classList.remove('fading');
    }, 250);

    updateDots(currentIndex);
  }

  prevBtn && prevBtn.addEventListener('click', () => goTo(currentIndex - 1));
  nextBtn && nextBtn.addEventListener('click', () => goTo(currentIndex + 1));
  randomBtn && randomBtn.addEventListener('click', () => goTo(Math.floor(Math.random() * TOTAL_DOTS)));

  // ── DOWNLOAD ─────────────────────────────
  downloadBtn && downloadBtn.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = viewerImg.src;
    a.download = 'flamingo-' + (currentIndex + 1) + '.png';
    a.click();
  });

  // ── HAMBURGER MENU ───────────────────────
  function openMenu() {
    navOpen = true;
    headerNav.classList.add('open');
    menuIcon.innerHTML = '&#10005;'; // ✕
  }

  function closeMenu() {
    navOpen = false;
    headerNav.classList.remove('open');
    menuIcon.innerHTML = '&#9776;'; // ☰
  }

  menuBtn && menuBtn.addEventListener('click', () => {
    navOpen ? closeMenu() : openMenu();
  });

  // Close menu when a nav link is clicked
  headerNav && headerNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && navOpen) closeMenu();
  });

  // Close on click outside
  document.addEventListener('click', e => {
    if (navOpen && !document.getElementById('site-header').contains(e.target)) {
      closeMenu();
    }
  });

  // ── ARROW KEY VIEWER NAV ─────────────────
  document.addEventListener('keydown', e => {
    if (navOpen) return;
    if (e.key === 'ArrowLeft') goTo(currentIndex - 1);
    if (e.key === 'ArrowRight') goTo(currentIndex + 1);
  });

})();

/* ═══════════════════════════════════════════════════════
   WHITELIST MODAL — WLModal module
   Self-contained; does not touch the viewer/menu code above.
═══════════════════════════════════════════════════════ */
(function WLModal() {
  'use strict';

  // ── EVM validation ──────────────────────────────────────
  const EVM_RE = /^0x[0-9a-fA-F]{40}$/;

  // ── State ───────────────────────────────────────────────
  let tasksDone = { follow: false, like: false, repost: false };
  let isSubmitting = false;
  let openedAt = 0;
  let submitted = false;
  let whitelistClosed = false;
  let dbLinks = { like: null, repost: null };

  // One shared deadline for every visitor: 15 July 2026, 16:27:25 Casablanca time.
  const WL_CLOSES_AT = Date.parse('2026-07-15T15:27:25Z');

  // ── DOM refs ─────────────────────────────────────────────
  const wlBtn = document.getElementById('wl-btn');
  const modal = document.getElementById('wl-modal');
  const card = document.getElementById('wl-card');
  const closeBtn = document.getElementById('wl-close');
  const formView = document.getElementById('wl-form-view');
  const successView = document.getElementById('wl-success-view');
  const btnFollow = document.getElementById('btn-follow');
  const btnLike = document.getElementById('btn-like');
  const btnRepost = document.getElementById('btn-repost');
  const walletInput = document.getElementById('wl-wallet');
  const walletError = document.getElementById('wl-wallet-error');
  const formError = document.getElementById('wl-form-error');
  const submitBtn = document.getElementById('wl-submit');
  const doneBtn = document.getElementById('wl-done-btn');
  const honeypot = document.getElementById('wl-honeypot');
  const countdown = document.getElementById('wl-countdown');
  const countdownLabel = document.getElementById('wl-countdown-label');
  const countdownTime = document.getElementById('wl-countdown-time');

  if (!window.WL_CONFIG) {
    console.error('[WLModal] WL_CONFIG not found. Make sure config.js is loaded before script.js.');
    return;
  }
  const CFG = window.WL_CONFIG;

  function closeWhitelist() {
    if (whitelistClosed) return;
    whitelistClosed = true;
    wlBtn.disabled = true;
    wlBtn.classList.add('is-closed');
    wlBtn.textContent = 'WL CLOSED';
    wlBtn.removeAttribute('aria-haspopup');
    countdown.classList.add('is-closed');
    countdownLabel.textContent = 'WHITELIST CLOSED';
    countdownTime.textContent = '00:00:00';
    submitBtn.disabled = true;
    if (!modal.hasAttribute('hidden')) closeModal(false);
  }

  function updateCountdown() {
    const remaining = Math.max(0, WL_CLOSES_AT - Date.now());
    if (remaining <= 0) {
      closeWhitelist();
      return;
    }

    const totalSeconds = Math.floor(remaining / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    countdownTime.textContent = [hours, minutes, seconds]
      .map(value => String(value).padStart(2, '0'))
      .join(':');
  }

  function openModal() {
    if (submitted || whitelistClosed) return;
    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    openedAt = Date.now();
    setTimeout(() => closeBtn.focus(), 50);
    trapFocus();
  }

  function closeModal(returnFocus = true) {
    modal.setAttribute('hidden', '');
    document.body.style.overflow = '';
    if (returnFocus) wlBtn.focus();
  }

  function trapFocus() {
    const focusable = () => Array.from(card.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), [tabindex="0"]'
    )).filter(el => !el.closest('[aria-hidden="true"]') && getComputedStyle(el).display !== 'none');

    card.addEventListener('keydown', function onKeyDown(e) {
      if (!modal.hasAttribute('hidden') && e.key === 'Tab') {
        const items = focusable();
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    });
  }

  function handleTaskClick(e) {
    const btn = e.currentTarget;
    const task = btn.dataset.task;
    let url = '';
    if (task === 'follow') {
      url = CFG.X_PROFILE_URL;
    } else if (task === 'like') {
      url = dbLinks.like || CFG.X_POST_URL;
    } else if (task === 'repost') {
      url = dbLinks.repost || CFG.X_POST_URL;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    tasksDone[task] = true;
    btn.classList.add('done');
    btn.closest('.wl-task').classList.add('done');
    btn.setAttribute('aria-label', btn.dataset.task + ' done');
    updateSubmitState();
  }

  function validateWallet() {
    const val = walletInput.value.trim();
    if (!val) return { ok: false, msg: 'Please enter a valid wallet address.' };
    if (!EVM_RE.test(val)) return { ok: false, msg: 'Please enter a valid EVM wallet address (0x…).' };
    return { ok: true, val };
  }

  function updateSubmitState() {
    const allTasks = tasksDone.follow && tasksDone.like && tasksDone.repost;
    const wallet = validateWallet();
    submitBtn.disabled = !(allTasks && wallet.ok && !isSubmitting && !whitelistClosed);
  }

  function showWalletError(msg) {
    walletError.textContent = msg;
    walletError.removeAttribute('hidden');
    walletInput.classList.add('error');
  }

  function clearWalletError() {
    walletError.setAttribute('hidden', '');
    walletInput.classList.remove('error');
  }

  function showFormError(msg) {
    formError.textContent = msg;
    formError.removeAttribute('hidden');
  }

  function clearFormError() {
    formError.setAttribute('hidden', '');
  }

  async function handleSubmit() {
    if (isSubmitting || whitelistClosed || Date.now() >= WL_CLOSES_AT) {
      closeWhitelist();
      return;
    }
    clearFormError();
    clearWalletError();
    const walletRes = validateWallet();
    if (!walletRes.ok) {
      showWalletError(walletRes.msg);
      return;
    }
    isSubmitting = true;
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    submitBtn.textContent = 'SUBMITTING…';
    const payload = {
      wallet_address: walletRes.val,
      x_profile_clicked: tasksDone.follow,
      x_like_clicked: tasksDone.like,
      x_repost_clicked: tasksDone.repost,
      elapsed_ms: Date.now() - openedAt,
      wl_confirm: honeypot ? honeypot.value : '',
    };
    try {
      const res = await fetch(CFG.EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        submitted = true;
        formView.setAttribute('hidden', '');
        successView.removeAttribute('hidden');
        document.getElementById('wl-modal-title').textContent = "You're on the list!";
        return;
      }
      const errType = data.error ?? 'server';
      const errMsg = data.message ?? 'Something went wrong. Please try again shortly.';
      if (errType === 'duplicate') {
        showFormError('Wallet already submitted');
      } else if (errType === 'captcha') {
        showFormError('Verification failed. Please try again.');
      } else if (errType === 'rate_limit') {
        showFormError('Too many attempts. Please wait and try again.');
      } else if (errType === 'wallet') {
        showWalletError(errMsg);
      } else {
        showFormError(errMsg);
      }
    } catch (err) {
      console.error('[WLModal] Fetch error:', err);
      showFormError('Something went wrong. Please try again shortly.');
    } finally {
      isSubmitting = false;
      submitBtn.classList.remove('loading');
      submitBtn.textContent = 'SUBMIT FOR WL';
      updateSubmitState();
    }
  }

  wlBtn && wlBtn.addEventListener('click', openModal);
  closeBtn && closeBtn.addEventListener('click', closeModal);
  doneBtn && doneBtn.addEventListener('click', closeModal);
  modal && modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hasAttribute('hidden')) closeModal();
  });
  btnFollow && btnFollow.addEventListener('click', handleTaskClick);
  btnLike && btnLike.addEventListener('click', handleTaskClick);
  btnRepost && btnRepost.addEventListener('click', handleTaskClick);
  walletInput && walletInput.addEventListener('input', function () {
    clearWalletError();
    updateSubmitState();
  });
  submitBtn && submitBtn.addEventListener('click', handleSubmit);

  async function fetchDbLinks() {
    try {
      const url = `${CFG.SUPABASE_URL}/rest/v1/settings?select=key,value`;
      const res = await fetch(url, {
        headers: {
          'apikey': CFG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CFG.SUPABASE_ANON_KEY}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        data.forEach(item => {
          if (item.key === 'like_link') {
            dbLinks.like = item.value;
          } else if (item.key === 'rt_link') {
            dbLinks.repost = item.value;
          }
        });
      }
    } catch (err) {
      console.error('[WLModal] Failed to fetch settings from DB:', err);
    }
  }

  fetchDbLinks();
  updateCountdown();
  const countdownTimer = window.setInterval(() => {
    updateCountdown();
    if (whitelistClosed) window.clearInterval(countdownTimer);
  }, 1000);

})();
