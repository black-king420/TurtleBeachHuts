/* ==========================================================================
   TBHK — App shell (PWA)
   Service worker + install prompt + mobile tab bar + "More" sheet +
   offline indicator + scroll/reveal/ripple polish.
   Safe to load on every page; it only adds, never replaces, existing behavior.
   ========================================================================== */
(function () {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const NO_TABBAR = ['index.html', 'auth.html', 'admin.html', 'offline.html', '404.html'];
  const isStandalone = () =>
    matchMedia('(display-mode: standalone)').matches ||
    matchMedia('(display-mode: window-controls-overlay)').matches ||
    window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  document.body.classList.add('app-ready');
  if (isStandalone()) document.documentElement.classList.add('is-app');

  /* ---------- Service worker + update prompt ---------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then(reg => {
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdateToast(nw);
          });
        });
      }).catch(() => {});
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return; reloaded = true; location.reload();
      });
    });
  }
  function showUpdateToast(worker) {
    const t = document.createElement('div');
    t.className = 'update-toast';
    t.innerHTML = '<span>A new version is ready</span><button type="button">Update</button>';
    t.querySelector('button').onclick = () => worker.postMessage('SKIP_WAITING');
    document.body.appendChild(t);
  }

  /* ---------- Install prompt (Android / desktop Chrome & Edge) ---------- */
  let deferredPrompt = null;
  const banner = document.createElement('div');
  banner.className = 'install-banner';
  banner.setAttribute('role', 'dialog');
  banner.innerHTML =
    '<img src="images/icons/icon-192.png" alt="">' +
    '<div class="txt"><strong>Install TBHK</strong><small data-msg>Add Turtle Beach Huts to your device for one-tap booking.</small></div>' +
    '<button class="btn-tbhk btn-sunset" type="button" data-install>Install</button>' +
    '<button class="x" type="button" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button>';
  document.body.appendChild(banner);

  const DISMISS_KEY = 'tbhk-install-dismissed';
  const dismissed = () => Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < 7 * 864e5;
  function showBanner(delay = 6000) {
    if (isStandalone() || dismissed()) return;
    setTimeout(() => banner.classList.add('show'), delay);
  }
  banner.querySelector('.x').onclick = () => {
    banner.classList.remove('show');
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };
  async function doInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      banner.classList.remove('show');
    } else if (isIOS) {
      banner.querySelector('[data-msg]').innerHTML = 'Tap <i class="fa-solid fa-arrow-up-from-bracket"></i> Share, then <b>Add to Home Screen</b>.';
      banner.querySelector('[data-install]').style.display = 'none';
      banner.classList.add('show');
    }
  }
  banner.querySelector('[data-install]').onclick = doInstall;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    $$('[data-install-btn]').forEach(b => (b.hidden = false));
    showBanner();
  });
  window.addEventListener('appinstalled', () => {
    banner.classList.remove('show');
    $$('[data-install-btn]').forEach(b => (b.hidden = true));
    deferredPrompt = null;
  });
  if (isIOS && !isStandalone()) { // iOS never fires beforeinstallprompt
    banner.querySelector('[data-msg]').innerHTML = 'Tap <i class="fa-solid fa-arrow-up-from-bracket"></i> Share, then <b>Add to Home Screen</b>.';
    banner.querySelector('[data-install]').style.display = 'none';
    showBanner(8000);
  }

  /* ---------- Mobile tab bar + More sheet ---------- */
  if (!NO_TABBAR.includes(page)) {
    const tabs = [
      { href: 'home.html', icon: 'fa-house', label: 'Home', match: ['home.html'] },
      { href: 'beach-hut.html', icon: 'fa-umbrella-beach', label: 'Huts', match: ['beach-hut.html'] },
      { href: 'booking.html', icon: 'fa-calendar-check', label: 'Book', match: ['booking.html'], fab: true },
      { href: 'packages.html', icon: 'fa-gift', label: 'Packages', match: ['packages.html'] }
    ];
    const bar = document.createElement('nav');
    bar.className = 'app-tabbar';
    bar.setAttribute('aria-label', 'App navigation');
    bar.innerHTML = tabs.map(t => {
      const on = t.match.includes(page) ? ' active' : '';
      return t.fab
        ? `<a class="app-tab app-tab-book${on}" href="${t.href}"><span class="tab-fab"><i class="fa-solid ${t.icon}"></i></span><span>${t.label}</span></a>`
        : `<a class="app-tab${on}" href="${t.href}"><i class="fa-solid ${t.icon}"></i><span>${t.label}</span></a>`;
    }).join('').replace(
      // keep the centre FAB in the middle slot (3rd of 5): add "More" last
      /$/, `<button class="app-tab${['gallery.html', 'contact.html'].includes(page) ? ' active' : ''}" type="button" data-more><i class="fa-solid fa-grip"></i><span>More</span></button>`
    );
    document.body.appendChild(bar);

    const back = document.createElement('div');
    back.className = 'app-sheet-backdrop';
    const sheet = document.createElement('div');
    sheet.className = 'app-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', 'More');
    sheet.innerHTML =
      '<div class="grab"></div><h3>Explore</h3><div class="sheet-grid">' +
      '<a class="sheet-item" href="gallery.html"><i class="fa-solid fa-images"></i>Gallery</a>' +
      '<a class="sheet-item" href="contact.html"><i class="fa-solid fa-envelope"></i>Contact</a>' +
      '<a class="sheet-item" href="auth.html"><i class="fa-solid fa-user"></i>Account</a>' +
      '<a class="sheet-item" href="tel:+923252282556"><i class="fa-solid fa-phone"></i>Call Zeeshan</a>' +
      '<a class="sheet-item" href="https://wa.me/923252282556" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i>WhatsApp Zeeshan</a>' +
      '<button class="sheet-item" type="button" data-theme-sheet><i class="fa-solid fa-circle-half-stroke"></i>Theme</button>' +
      '</div>' +
      '<button class="btn-tbhk btn-sunset sheet-install" type="button" data-install-btn hidden><i class="fa-solid fa-download"></i> Install app</button>';
    document.body.append(back, sheet);

    const open = v => { back.classList.toggle('open', v); sheet.classList.toggle('open', v); };
    $('[data-more]', bar).onclick = () => open(true);
    back.onclick = () => open(false);
    $('[data-theme-sheet]', sheet).onclick = () => { $('.theme-toggle')?.click(); };
    $('[data-install-btn]', sheet).onclick = () => { open(false); doInstall(); };
    if (isIOS && !isStandalone()) $('[data-install-btn]', sheet).hidden = false;
    if (deferredPrompt) $('[data-install-btn]', sheet).hidden = false;
    // swipe down to dismiss
    let sy = null;
    sheet.addEventListener('touchstart', e => (sy = e.touches[0].clientY), { passive: true });
    sheet.addEventListener('touchend', e => { if (sy !== null && e.changedTouches[0].clientY - sy > 60) open(false); sy = null; });
    document.addEventListener('keydown', e => e.key === 'Escape' && open(false));

    // hide tab bar while scrolling down, reveal on scroll up
    let lastY = scrollY;
    addEventListener('scroll', () => {
      const y = scrollY;
      if (Math.abs(y - lastY) < 8) return;
      bar.classList.toggle('hide', y > lastY && y > 240);
      lastY = y;
    }, { passive: true });
  }

  /* ---------- Inner pages have no dark hero: keep the nav in its readable (glass) state ---------- */
  const nav = $('.tbhk-nav');
  if (nav && !$('.hero')) { nav.classList.add('scrolled'); nav.dataset.forceScrolled = '1'; }

  /* ---------- Active state on desktop nav ---------- */
  $$('.tbhk-nav .nav-link').forEach(a => {
    if ((a.getAttribute('href') || '').toLowerCase() === page) a.classList.add('active');
  });

  /* ---------- Scroll progress ---------- */
  const prog = document.createElement('div');
  prog.className = 'tbhk-progress';
  document.body.appendChild(prog);
  const upd = () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    prog.style.transform = `scaleX(${h > 0 ? Math.min(scrollY / h, 1) : 0})`;
  };
  addEventListener('scroll', upd, { passive: true }); upd();

  /* ---------- Reveal on scroll (only for elements opted in; AOS handles the rest) ---------- */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: .12 });
    $$('.reveal').forEach(el => io.observe(el));
  } else $$('.reveal').forEach(el => el.classList.add('in'));

  /* ---------- Hero parallax + desktop card tilt ---------- */
  const heroBg = $('.hero-bg');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (heroBg && !reduce) {
    let tick = false;
    addEventListener('scroll', () => {
      if (tick) return; tick = true;
      requestAnimationFrame(() => { heroBg.style.setProperty('--py', Math.min(scrollY, 900) * 0.18 + 'px'); tick = false; });
    }, { passive: true });
  }
  if (matchMedia('(hover:hover) and (pointer:fine)').matches && !reduce) {
    $$('.card-tbhk, .offer-card, .zeeshan-card').forEach(el => {
      el.classList.add('tilt');
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        el.style.transform = `perspective(900px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg) translateY(-6px)`;
      });
      el.addEventListener('mouseleave', () => (el.style.transform = ''));
    });
  }

  /* ---------- Button ripple ---------- */
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest('.btn-tbhk');
    if (!b) return;
    const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height);
    const s = document.createElement('span');
    s.className = 'ripple';
    s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    b.appendChild(s);
    setTimeout(() => s.remove(), 650);
  });

  /* ---------- Online / offline indicator ---------- */
  const pill = document.createElement('div');
  pill.className = 'net-pill';
  pill.setAttribute('role', 'status');
  document.body.appendChild(pill);
  let pillTimer;
  function net(on) {
    pill.className = 'net-pill show ' + (on ? 'online' : 'offline');
    pill.textContent = on ? 'Back online' : 'You\'re offline — showing saved pages';
    clearTimeout(pillTimer);
    if (on) pillTimer = setTimeout(() => pill.classList.remove('show'), 2200);
  }
  addEventListener('offline', () => net(false));
  addEventListener('online', () => net(true));
  if (!navigator.onLine) net(false);

  /* ---------- Bubble loader shown while navigating between pages ---------- */
  const nb = document.createElement('div');
  nb.className = 'nav-bubbles';
  nb.innerHTML = '<div class="g-bubbles"><i></i><i></i><i></i><i></i></div>';
  document.body.appendChild(nb);

  /* ---------- Soft page-leave fade for in-app navigation ---------- */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
    const u = new URL(a.href, location.href);
    if (u.origin !== location.origin || u.pathname === location.pathname || /^(tel|mailto):/.test(a.getAttribute('href'))) return;
    if (!matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
    document.body.classList.add('leaving');
  });
  addEventListener('pageshow', () => document.body.classList.remove('leaving'));
})();
