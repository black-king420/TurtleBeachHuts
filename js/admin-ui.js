/* ==========================================================================
   Admin — UI shell: panel titles, mobile drawer + bottom tabs, badges, greeting
   ========================================================================== */
(function () {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  const META = {
    dashboard: ['Dashboard', 'Your business at a glance.', 'fa-gauge-high', 'Home'],
    bookings: ['Bookings', 'Search, confirm, cancel and export reservations.', 'fa-regular fa-calendar-check', 'Bookings'],
    calendar: ['Calendar', 'See every arrival on the month view.', 'fa-regular fa-calendar-days', 'Calendar'],
    catalog: ['Packages & Prices', 'Edit package names, prices and pictures shown across the site.', 'fa-solid fa-tags', 'Packages'],
    huts: ['Huts', 'Add hut details and photos — the website shows them on the Beach Huts page.', 'fa-solid fa-umbrella-beach', 'Huts'],
    gallery: ['Gallery', 'Add or remove pictures on the public Gallery page.', 'fa-regular fa-images', 'Gallery'],
    users: ['Users', 'Everyone who registered an account.', 'fa-solid fa-users', 'Users'],
    messages: ['Messages', 'Questions sent from the contact form.', 'fa-regular fa-envelope', 'Inbox'],
    settings: ['Settings', 'Connection, access and export help.', 'fa-solid fa-gear', 'Settings']
  };
  const iconCls = (k) => (META[k][2].includes(' ') ? META[k][2] : 'fa-solid ' + META[k][2]);

  const sidebar = $('#adminSidebar'), backdrop = $('#adminBackdrop');
  const openDrawer = (v) => { sidebar.classList.toggle('open', v); backdrop.classList.toggle('show', v); document.body.classList.toggle('drawer-open', v); };

  function show(panel) {
    const btn = $(`.admin-nav button[data-panel="${panel}"]`);
    if (btn) btn.click();
  }

  /* ---- title/sub follow the active panel; drawer closes ---- */
  $$('.admin-nav button[data-panel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const m = META[btn.dataset.panel];
      $('#panelTitle').textContent = m[0];
      $('#panelSub').textContent = m[1];
      openDrawer(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      syncTabs(btn.dataset.panel);
    });
  });
  $$('[data-jump]').forEach((b) => b.addEventListener('click', () => show(b.dataset.jump)));

  /* ---- drawer ---- */
  $('#sidebarToggle')?.addEventListener('click', () => openDrawer(!sidebar.classList.contains('open')));
  backdrop.addEventListener('click', () => openDrawer(false));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && openDrawer(false));
  let sx = null;
  sidebar.addEventListener('touchstart', (e) => (sx = e.touches[0].clientX), { passive: true });
  sidebar.addEventListener('touchend', (e) => { if (sx !== null && sx - e.changedTouches[0].clientX > 60) openDrawer(false); sx = null; });

  /* ---- bottom tab bar (phones/tablets) ---- */
  const bar = document.createElement('nav');
  bar.className = 'app-tabbar admin-tabbar';
  bar.setAttribute('aria-label', 'Admin quick navigation');
  bar.innerHTML = ['dashboard', 'bookings', 'calendar', 'messages'].map((k) =>
    `<button type="button" class="app-tab" data-tab="${k}"><i class="${iconCls(k)}"></i><span>${META[k][3]}</span><b class="tab-dot" data-dot="${k}" hidden></b></button>`).join('');
  bar.insertAdjacentHTML('beforeend', '<button type="button" class="app-tab" data-menu><i class="fa-solid fa-grip"></i><span>Menu</span></button>');
  document.body.appendChild(bar);
  bar.addEventListener('click', (e) => {
    if (e.target.closest('[data-menu]')) return openDrawer(true);
    const t = e.target.closest('[data-tab]'); if (t) show(t.dataset.tab);
  });
  function syncTabs(panel) {
    // admin.js toggles .active on the sidebar AFTER this runs, so trust the panel we were given
    const active = panel || $('.admin-nav button.active')?.dataset.panel;
    $$('.app-tab', bar).forEach((t) => t.classList.toggle('active', t.dataset.tab === active));
  }
  syncTabs();

  /* ---- badges (pending bookings / unread messages) ---- */
  function badge(el, n, dotKey) {
    el.textContent = n; el.hidden = !(n > 0);
    const d = $(`[data-dot="${dotKey}"]`, bar); if (d) d.hidden = !(n > 0);
  }
  function syncBadges() {
    badge($('#navPending'), parseInt($('#statPending').textContent, 10) || 0, 'bookings');
    badge($('#navUnread'), parseInt($('#statUnread').textContent, 10) || 0, 'messages');
  }
  ['#statPending', '#statUnread'].forEach((s) => new MutationObserver(syncBadges).observe($(s), { childList: true, characterData: true, subtree: true }));
  syncBadges();

  /* ---- greeting + avatar ---- */
  function greet() {
    const name = ($('#adminWhoami').textContent || '').trim();
    const first = name && name !== '—' ? name.split(/[\s@]/)[0] : '';
    const h = new Date().getHours();
    const part = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    $('#welcomeHello').textContent = first ? `${part}, ${first}` : part;
    $('#welcomeDate').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    $('#whoAvatar').textContent = (first || 'A').charAt(0).toUpperCase();
  }
  new MutationObserver(greet).observe($('#adminWhoami'), { childList: true, characterData: true, subtree: true });
  greet();

  /* ---- topbar elevation on scroll ---- */
  const top = $('.admin-topbar');
  addEventListener('scroll', () => top.classList.toggle('lifted', scrollY > 8), { passive: true });
})();

/* ==========================================================================
   Count-up animation for stat numbers + staggered entrance + panel transitions
   ========================================================================== */
(function () {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NUM = /(\d[\d,]*)/;

  function animate(el, from, to, prefix, suffix) {
    const t0 = performance.now(), dur = 900;
    el.dataset.anim = '1';
    (function tick(now) {
      const p = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + Math.round(from + (to - from) * e).toLocaleString('en-US') + suffix;
      if (p < 1) requestAnimationFrame(tick); else { el.textContent = prefix + to.toLocaleString('en-US') + suffix; delete el.dataset.anim; }
    })(t0);
  }

  document.querySelectorAll('.stat-card .val').forEach((el) => {
    let last = 0;
    new MutationObserver(() => {
      if (el.dataset.anim) return;                       // ignore our own writes
      const m = el.textContent.match(NUM); if (!m) return;
      const to = parseInt(m[1].replace(/,/g, ''), 10);
      if (reduce || to === last) return;
      const prefix = el.textContent.slice(0, m.index), suffix = el.textContent.slice(m.index + m[1].length);
      animate(el, last, to, prefix, suffix); last = to;
    }).observe(el, { childList: true, characterData: true, subtree: true });
  });

  // staggered entrance for cards inside whichever panel is shown
  const panels = document.querySelectorAll('.admin-view');
  function stagger(view) {
    view.querySelectorAll('.stat-card,.admin-panel-card,.welcome-card,.cat-card,.table-wrap').forEach((c, i) => {
      c.style.setProperty('--d', Math.min(i, 10) * 55 + 'ms');
    });
  }
  panels.forEach(stagger);
  document.querySelectorAll('.admin-nav button[data-panel]').forEach((b) => b.addEventListener('click', () => {
    const v = document.getElementById('view-' + b.dataset.panel); if (v) stagger(v);
  }));
})();
