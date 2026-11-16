/* ==========================================================================
   Admin extras
   1. Booking detail slide-over (call / WhatsApp / email / status / copy / print)
   2. Calendar view
   3. 14-day activity trend chart
   4. Command palette (Ctrl/⌘ + K  or  /)
   5. Live "new booking" alerts + tab-title counter
   ========================================================================== */
(function () {
  'use strict';
  const A = window.TBHKAdmin;
  if (!A) return;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const esc = A.esc;
  const toast = (m, t = 'success') => window.tbhkToast && window.tbhkToast(m, t);
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const goPanel = (p) => $(`.admin-nav button[data-panel="${p}"]`)?.click();
  const byId = (id) => A.bookings().find((b) => String(b.id) === String(id));

  /* ---------------------------------------------------------------- helpers */
  function waNumber(raw) {
    let n = String(raw || '').replace(/[^\d+]/g, '');
    if (n.startsWith('+')) n = n.slice(1);
    else if (n.startsWith('00')) n = n.slice(2);
    else if (n.startsWith('0')) n = '92' + n.slice(1);
    return n.replace(/\D/g, '');
  }
  function priceOf(name) {
    const c = window.TBHKCatalog && window.TBHKCatalog.current();
    const it = c && c.items.find((i) => i.name === name);
    return it ? window.TBHKCatalog.fmtPrice(it) : '—';
  }
  function waText(b) {
    const st = (b.status || 'Pending').toLowerCase();
    const when = [b.date, b.time].filter(Boolean).join(' at ');
    const head = `Assalam o Alaikum ${b.name || ''}, this is Zeeshan from Turtle Beach Huts Karachi.`;
    if (st === 'confirmed') return `${head}\nYour *${b.package}* booking${when ? ' for ' + when : ''} is CONFIRMED ✅. We look forward to hosting you! Reply here if you need anything.`;
    if (st === 'cancelled') return `${head}\nYour *${b.package}* booking${when ? ' for ' + when : ''} has been cancelled. If you'd like to rebook, just reply here.`;
    return `${head}\nThank you for requesting the *${b.package}*${when ? ' for ' + when : ''}. We're checking availability and will confirm shortly.`;
  }
  const fmtLong = (d) => { const x = new Date(d + 'T00:00:00'); return isNaN(x) ? d : x.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); };

  /* ================================================== 1. DETAIL SLIDE-OVER */
  const drawer = document.createElement('aside');
  drawer.className = 'bk-drawer';
  drawer.setAttribute('role', 'dialog'); drawer.setAttribute('aria-label', 'Booking details');
  const dBack = document.createElement('div');
  dBack.className = 'bk-backdrop';
  document.body.append(dBack, drawer);
  let openId = null;

  function closeDrawer() { openId = null; drawer.classList.remove('open'); dBack.classList.remove('show'); document.body.classList.remove('bk-open'); }
  dBack.addEventListener('click', closeDrawer);

  function drawerHTML(b) {
    const st = String(b.status || 'Pending');
    const cls = ['pending', 'confirmed', 'cancelled'].includes(st.toLowerCase()) ? st.toLowerCase() : 'pending';
    const guests = (Number(b.adults) || 0) + (Number(b.children) || 0);
    const phone = b.phone || b.whatsapp || '';
    const wa = waNumber(b.whatsapp || b.phone);
    const row = (ico, label, val) => val ? `<div class="bk-row"><i class="${ico}"></i><div><span>${label}</span><b>${val}</b></div></div>` : '';
    return `
      <header class="bk-head">
        <button class="icon-btn bk-close" data-bk="close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
        <span class="recent-avatar lg">${esc((b.name || '?').trim().charAt(0).toUpperCase() || '?')}</span>
        <div class="bk-title"><h3>${esc(b.name || 'Guest')}</h3><span class="sub-id">${esc(b.id)}</span></div>
        <span class="status-pill ${cls}">${esc(st)}</span>
      </header>
      <div class="bk-body">
        <div class="bk-quick">
          ${phone ? `<a class="q-call" href="tel:${esc(String(phone).replace(/[^\d+]/g, ''))}"><i class="fa-solid fa-phone"></i>Call</a>` : ''}
          ${wa ? `<a class="q-wa" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(waText(b))}"><i class="fa-brands fa-whatsapp"></i>WhatsApp</a>` : ''}
          ${b.email ? `<a class="q-mail" href="mailto:${esc(b.email)}?subject=${encodeURIComponent('Your Turtle Beach Huts booking')}&body=${encodeURIComponent(waText(b))}"><i class="fa-regular fa-envelope"></i>Email</a>` : ''}
        </div>
        <div class="bk-card">
          ${row('fa-solid fa-umbrella-beach', 'Package', `${esc(b.package || '—')} <em>${esc(priceOf(b.package))}</em>`)}
          ${row('fa-regular fa-calendar', 'Date', esc(b.date ? fmtLong(b.date) : '—'))}
          ${row('fa-regular fa-clock', 'Time', esc(b.time || ''))}
          ${row('fa-solid fa-user-group', 'Party', `${esc(b.adults || 0)} adults, ${esc(b.children || 0)} children <em>${guests} guests</em>`)}
        </div>
        ${b.userEmail || b.userName ? `<div class="bk-card">${row('fa-solid fa-id-badge', 'Booked by account', `${esc(b.userName || '')} <em>${esc(b.userEmail || 'no email')}</em>`)}</div>` : ''}
        <div class="bk-card">
          ${row('fa-solid fa-phone', 'Phone', esc(b.phone || ''))}
          ${row('fa-brands fa-whatsapp', 'WhatsApp', esc(b.whatsapp || ''))}
          ${row('fa-regular fa-envelope', 'Email', esc(b.email || ''))}
        </div>
        ${b.request || b.coupon ? `<div class="bk-card">
          ${row('fa-regular fa-comment-dots', 'Special request', esc(b.request || ''))}
          ${row('fa-solid fa-ticket', 'Coupon', esc(b.coupon || ''))}</div>` : ''}
        <div class="bk-meta">Submitted ${esc(b.createdAt ? new Date(b.createdAt).toLocaleString() : '—')}</div>
      </div>
      <footer class="bk-foot">
        <div class="bk-status">
          <button class="btn-tbhk btn-sunset" data-bk="Confirmed" ${st === 'Confirmed' ? 'disabled' : ''}><i class="fa-solid fa-check"></i> Confirm</button>
          <button class="btn-tbhk btn-outline-tbhk" data-bk="Cancelled" ${st === 'Cancelled' ? 'disabled' : ''}><i class="fa-solid fa-ban"></i> Cancel</button>
        </div>
        <div class="bk-tools">
          <button class="btn-sm-tbhk" data-bk="copy"><i class="fa-regular fa-copy"></i> Copy</button>
          <button class="btn-sm-tbhk" data-bk="print"><i class="fa-solid fa-print"></i> Print</button>
          <button class="btn-sm-tbhk danger" data-bk="delete"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>
      </footer>`;
  }

  function openDrawer(id) {
    const b = byId(id); if (!b) return;
    openId = b.id; drawer.innerHTML = drawerHTML(b);
    drawer.classList.add('open'); dBack.classList.add('show'); document.body.classList.add('bk-open');
  }

  drawer.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-bk]'); if (!btn) return;
    const act = btn.dataset.bk, b = byId(openId);
    if (act === 'close') return closeDrawer();
    if (!b) return;
    try {
      if (act === 'Confirmed' || act === 'Cancelled') {
        btn.disabled = true; await window.TBHKStore.updateBookingStatus(b.id, act); toast(`Booking ${act.toLowerCase()}`);
      } else if (act === 'delete') {
        if (!confirm('Delete this booking permanently?')) return;
        await window.TBHKStore.deleteBooking(b.id); closeDrawer(); toast('Booking deleted');
      } else if (act === 'copy') {
        const t = [`Booking ${b.id}`, `Guest: ${b.name}`, `Package: ${b.package}`, `Date: ${b.date || '—'} ${b.time || ''}`, `Party: ${b.adults || 0} adults, ${b.children || 0} kids`,
          `Phone: ${b.phone || '—'}`, b.email ? `Email: ${b.email}` : '', b.request ? `Request: ${b.request}` : '', `Status: ${b.status || 'Pending'}`].filter(Boolean).join('\n');
        await navigator.clipboard.writeText(t); toast('Details copied');
      } else if (act === 'print') window.print();
    } catch (err) { toast("Couldn't complete that action", 'error'); btn.disabled = false; }
  });

  // open from any element carrying data-open
  document.addEventListener('click', (e) => {
    if (e.target.closest('button,a,select,input,label')) return;
    const t = e.target.closest('[data-open]'); if (t) openDrawer(t.dataset.open);
  });

  /* ======================================================== 2. CALENDAR VIEW */
  let cur = new Date(); cur.setDate(1);
  let selDay = iso(new Date());

  function renderCal() {
    const grid = $('#calGrid'); if (!grid) return;
    const y = cur.getFullYear(), m = cur.getMonth();
    $('#calTitle').textContent = cur.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const byDay = {};
    A.bookings().forEach((b) => { if (b.date) (byDay[b.date] = byDay[b.date] || []).push(b); });
    const first = new Date(y, m, 1).getDay(), dim = new Date(y, m + 1, 0).getDate(), today = iso(new Date());
    let html = '';
    for (let i = 0; i < first; i++) html += '<div class="cal-cell empty"></div>';
    for (let d = 1; d <= dim; d++) {
      const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const list = byDay[key] || [];
      const dots = list.slice(0, 4).map((b) => `<i class="dot ${({ confirmed: 'green', cancelled: 'red' })[String(b.status || '').toLowerCase()] || 'gold'}"></i>`).join('');
      html += `<button type="button" class="cal-cell${key === today ? ' today' : ''}${key === selDay ? ' sel' : ''}${list.length ? ' has' : ''}" data-day="${key}">
        <span class="n">${d}</span>${list.length ? `<span class="dots">${dots}${list.length > 4 ? `<small>+${list.length - 4}</small>` : ''}</span><span class="cnt">${list.length}</span>` : ''}</button>`;
    }
    grid.innerHTML = html;
    renderDay(byDay[selDay] || []);
  }
  function renderDay(list) {
    $('#calDayTitle').textContent = selDay ? fmtLong(selDay) : 'Select a day';
    const box = $('#calDayList');
    if (!list.length) { box.innerHTML = '<div class="empty-state"><i class="fa-solid fa-umbrella-beach"></i>No bookings on this day.</div>'; return; }
    box.innerHTML = list.map((b) => {
      const st = String(b.status || 'Pending'), cls = ['pending', 'confirmed', 'cancelled'].includes(st.toLowerCase()) ? st.toLowerCase() : 'pending';
      return `<div class="recent-item row-click" data-open="${esc(b.id)}"><span class="recent-avatar">${esc((b.name || '?').trim().charAt(0).toUpperCase() || '?')}</span>
        <div class="recent-main"><strong>${esc(b.name || 'Guest')}</strong><span>${esc(b.package || '—')}${b.time ? ' · ' + esc(b.time) : ''}</span></div>
        <span class="status-pill ${cls}">${esc(st)}</span></div>`;
    }).join('');
  }
  $('#calGrid')?.addEventListener('click', (e) => { const c = e.target.closest('[data-day]'); if (c) { selDay = c.dataset.day; renderCal(); } });
  $('#calPrev')?.addEventListener('click', () => { cur.setMonth(cur.getMonth() - 1); renderCal(); });
  $('#calNext')?.addEventListener('click', () => { cur.setMonth(cur.getMonth() + 1); renderCal(); });
  $('#calToday')?.addEventListener('click', () => { cur = new Date(); cur.setDate(1); selDay = iso(new Date()); renderCal(); });

  /* ========================================================== 3. TREND CHART */
  let trend = null;
  function renderTrend() {
    const canvas = $('#trendChart'); if (!canvas || !window.Chart) return;
    const days = [...Array(14)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (13 - i)); return d; });
    const keys = days.map(iso), counts = keys.map(() => 0);
    A.bookings().forEach((b) => { if (!b.createdAt) return; const k = iso(new Date(b.createdAt)); const i = keys.indexOf(k); if (i >= 0) counts[i]++; });
    $('#trendTotal').textContent = counts.reduce((a, c) => a + c, 0) + ' new';
    const labels = days.map((d) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }));
    if (trend) { trend.data.labels = labels; trend.data.datasets[0].data = counts; trend.update(); return; }
    trend = new window.Chart(canvas, {
      type: 'line',
      data: { labels, datasets: [{ label: 'New bookings', data: counts, tension: .4, borderColor: '#E8722C', borderWidth: 3, pointRadius: 4, pointBackgroundColor: '#fff', pointBorderColor: '#E8722C', pointBorderWidth: 2, pointHoverRadius: 7, fill: true,
        backgroundColor: (ctx) => { const c = ctx.chart; if (!c.chartArea) return 'rgba(232,114,44,.2)'; const g = c.ctx.createLinearGradient(0, c.chartArea.top, 0, c.chartArea.bottom); g.addColorStop(0, 'rgba(232,114,44,.40)'); g.addColorStop(1, 'rgba(246,196,69,0)'); return g; } }] },
      options: { responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: 'index' },
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: 'rgba(16,48,47,.07)' } }, x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 7 } } } }
    });
  }

  /* ======================================================= 5. LIVE ALERTS */
  let seen = null, t0 = 0, pendingN = 0;
  function onData() {
    const rows = A.bookings();
    if (seen === null) { seen = new Set(); t0 = Date.now(); }
    const fresh = rows.filter((b) => !seen.has(String(b.id)));
    fresh.forEach((b) => seen.add(String(b.id)));
    // only announce bookings that arrive after the initial load has settled
    if (fresh.length && Date.now() - t0 > 3000) {
      fresh.slice(0, 3).forEach((b) => toast(`New booking: ${b.name || 'Guest'} — ${b.package || ''}`, 'success'));
      $('.admin-nav [data-panel="bookings"]')?.classList.add('ping');
    }
    refresh();
  }
  function refresh() {
    renderCal(); renderTrend();
    pendingN = A.bookings().filter((b) => (b.status || 'Pending') === 'Pending').length;
    document.title = (pendingN ? `(${pendingN}) ` : '') + 'Admin — Turtle Beach Huts';
    if (openId) { const b = byId(openId); if (b) { const sc = $('.bk-body', drawer)?.scrollTop || 0; drawer.innerHTML = drawerHTML(b); const nb = $('.bk-body', drawer); if (nb) nb.scrollTop = sc; } else closeDrawer(); }
  }
  document.addEventListener('tbhk-admin-data', onData);
  $('.admin-nav [data-panel="bookings"]')?.addEventListener('click', (e) => e.currentTarget.classList.remove('ping'));
  renderCal();

  /* ===================================================== 4. COMMAND PALETTE */
  const pal = document.createElement('div');
  pal.className = 'cmd-overlay';
  pal.innerHTML = `<div class="cmd-box" role="dialog" aria-label="Command palette">
      <div class="cmd-input"><i class="fa-solid fa-magnifying-glass"></i><input id="cmdInput" type="text" placeholder="Search bookings, jump to a page, or run a command…" autocomplete="off"><kbd>Esc</kbd></div>
      <div class="cmd-list" id="cmdList"></div>
      <div class="cmd-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>Enter</kbd> select</span><span><kbd>Esc</kbd> close</span></div></div>`;
  document.body.appendChild(pal);
  const input = $('#cmdInput', pal), list = $('#cmdList', pal);
  let items = [], idx = 0;

  const PAGES = [['dashboard', 'Dashboard', 'fa-solid fa-gauge-high'], ['bookings', 'Bookings', 'fa-regular fa-calendar-check'], ['calendar', 'Calendar', 'fa-regular fa-calendar-days'],
    ['catalog', 'Packages & Prices', 'fa-solid fa-tags'], ['huts', 'Huts', 'fa-solid fa-umbrella-beach'], ['gallery', 'Gallery', 'fa-regular fa-images'], ['users', 'Users', 'fa-solid fa-users'], ['messages', 'Messages', 'fa-regular fa-envelope'], ['settings', 'Settings', 'fa-solid fa-gear']];
  function build(q) {
    q = q.trim().toLowerCase(); const out = [];
    PAGES.forEach(([p, label, ico]) => { if (!q || label.toLowerCase().includes(q) || ('go ' + label).toLowerCase().includes(q)) out.push({ g: 'Go to', ico, label, sub: 'Open page', run: () => goPanel(p) }); });
    const cmds = [
      ['fa-solid fa-plus', 'Add a new package', 'Packages', () => { goPanel('catalog'); setTimeout(() => $('#catAdd')?.click(), 250); }],
      ['fa-solid fa-file-excel', 'Export everything to Excel', 'Bookings + messages', () => $('#exportAllBtn')?.click()],
      ['fa-solid fa-circle-half-stroke', 'Toggle dark / light theme', 'Appearance', () => $('.theme-toggle')?.click()],
      ['fa-solid fa-arrow-up-right-from-square', 'View the website', 'Opens home page', () => { location.href = 'home.html'; }],
      ['fa-solid fa-arrow-right-from-bracket', 'Sign out', 'End session', () => $('#adminLogout')?.click()]];
    cmds.forEach(([ico, label, sub, run]) => { if (!q || label.toLowerCase().includes(q) || sub.toLowerCase().includes(q)) out.push({ g: 'Actions', ico, label, sub, run }); });
    if (q) A.bookings().filter((b) => [b.name, b.phone, b.email, b.package, b.id, b.date].join(' ').toLowerCase().includes(q)).slice(0, 6)
      .forEach((b) => out.push({ g: 'Bookings', ico: 'fa-regular fa-user', label: b.name || 'Guest', sub: `${b.package || ''} · ${b.date || 'no date'} · ${b.status || 'Pending'}`, run: () => openDrawer(b.id) }));
    return out;
  }
  function paint() {
    if (!items.length) { list.innerHTML = '<div class="cmd-empty">No results — try a guest name, phone number or page.</div>'; return; }
    let g = '';
    list.innerHTML = items.map((it, i) => {
      const head = it.g !== g ? `<div class="cmd-group">${it.g}</div>` : ''; g = it.g;
      return `${head}<button class="cmd-item${i === idx ? ' on' : ''}" data-i="${i}"><i class="${it.ico}"></i><span><b>${esc(it.label)}</b><small>${esc(it.sub)}</small></span></button>`;
    }).join('');
    list.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  }
  function openPal() { pal.classList.add('open'); input.value = ''; items = build(''); idx = 0; paint(); setTimeout(() => input.focus(), 30); }
  function closePal() { pal.classList.remove('open'); }
  function run(i) { const it = items[i]; if (!it) return; closePal(); setTimeout(it.run, 60); }
  input.addEventListener('input', () => { items = build(input.value); idx = 0; paint(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(idx + 1, items.length - 1); paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(idx - 1, 0); paint(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(idx); }
  });
  list.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) run(+b.dataset.i); });
  pal.addEventListener('click', (e) => { if (e.target === pal) closePal(); });
  $('#cmdBtn')?.addEventListener('click', openPal); $('#cmdIcon')?.addEventListener('click', openPal);

  document.addEventListener('keydown', (e) => {
    const typing = /input|textarea|select/i.test(e.target.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal.classList.contains('open') ? closePal() : openPal(); }
    else if (e.key === '/' && !typing) { e.preventDefault(); openPal(); }
    else if (e.key === 'Escape') { if (pal.classList.contains('open')) closePal(); else if (drawer.classList.contains('open')) closeDrawer(); }
  });
})();
