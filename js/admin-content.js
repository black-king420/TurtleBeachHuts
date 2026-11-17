/* ==========================================================================
   Admin — Huts editor, Gallery editor, Users list
   ========================================================================== */
(function () {
  'use strict';
  const C = window.TBHKContent, A = window.TBHKAdmin;
  if (!C) return;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const esc = C.esc;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const uid = (p) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const modeText = () => (window.tbhkFirebase && window.tbhkFirebase.db)
    ? ['<i class="fa-solid fa-cloud"></i> Live — saved changes publish to every visitor instantly.', true]
    : ['<i class="fa-solid fa-flask"></i> Demo mode — saved on this device only. Connect Firebase to publish to everyone.', false];

  function status(el, msg, kind) {
    el.textContent = msg; el.className = 'cat-status ' + (kind || '');
    if (kind === 'ok') setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 3500);
  }
  const quotaMsg = (err) => {
    if (window.TBHKDiag && window.TBHKDiag.isPermission(err)) { setTimeout(() => window.TBHKDiag.showHelp(), 50); return 'Not saved — Firebase rules blocked this. See the fix panel.'; }
    return /quota/i.test(err.message) ? 'Storage full — use fewer/smaller pictures, or add them by link.' : 'Could not save: ' + err.message;
  };

  /* ====================================================================== HUTS */
  (function huts() {
    const grid = $('#hutGrid'); if (!grid) return;
    const saveBtn = $('#hutSave'), stat = $('#hutStatus');
    let draft = [], dirty = false;
    const setDirty = (v) => { dirty = v; saveBtn.disabled = !v; saveBtn.classList.toggle('pulse', v); if (v) status(stat, 'Unsaved changes', 'warn'); };

    function card(h, i, n) {
      const imgs = h.images.map((u, k) => `
        <div class="img-chip${k === 0 ? ' cover' : ''}" data-k="${k}">
          <img src="${esc(u)}" alt="" onerror="this.src='images/logo.png'">
          ${k === 0 ? '<span class="cover-tag">Cover</span>' : `<button type="button" class="chip-btn" data-act="cover" title="Make cover"><i class="fa-solid fa-star"></i></button>`}
          <button type="button" class="chip-btn del" data-act="rmimg" title="Remove photo"><i class="fa-solid fa-xmark"></i></button>
        </div>`).join('');
      return `
      <article class="cat-card hut-ed" data-i="${i}">
        <div class="hut-ed-imgs">
          <div class="img-strip">${imgs || '<div class="img-empty"><i class="fa-regular fa-image"></i> No photos yet</div>'}</div>
          <div class="img-add">
            <label class="btn-sm-tbhk"><i class="fa-solid fa-camera"></i> Add photos<input type="file" accept="image/*" multiple hidden data-act="files"></label>
            <button type="button" class="btn-sm-tbhk" data-act="imgurl"><i class="fa-solid fa-link"></i> Link</button>
            <small>${h.images.length}/6</small>
          </div>
        </div>
        <div class="cat-body">
          <label>Hut name<input type="text" data-f="name" value="${esc(h.name)}"></label>
          <div class="cat-row">
            <label>Price / day (PKR)<input type="number" min="0" step="500" data-f="price" value="${h.price === null ? '' : h.price}" placeholder="e.g. 15000"></label>
            <label>Ribbon tag<input type="text" data-f="tag" value="${esc(h.tag)}" maxlength="18" placeholder="Premium…"></label>
          </div>
          <div class="cat-row3">
            <label>Guests<input type="number" min="0" data-f="capacity" value="${h.capacity || ''}"></label>
            <label>Rooms<input type="number" min="0" data-f="rooms" value="${h.rooms || ''}"></label>
            <label>Washrooms<input type="number" min="0" data-f="washrooms" value="${h.washrooms || ''}"></label>
          </div>
          <label>Description<textarea rows="3" data-f="desc">${esc(h.desc)}</textarea></label>
          <label>Amenities <small>(comma separated)</small><input type="text" data-f="amenities" value="${esc(h.amenities)}" placeholder="Private deck, BBQ area, Kitchen"></label>
          <div class="cat-checks"><label><input type="checkbox" data-f="visible" ${h.visible ? 'checked' : ''}> Show on website</label>${h.id === 'classic' ? '<span class="soft-chip">Original hut</span>' : ''}</div>
          <div class="cat-actions">
            <button type="button" class="btn-sm-tbhk" data-act="up" ${i === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
            <button type="button" class="btn-sm-tbhk" data-act="down" ${i === n - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
            <button type="button" class="btn-sm-tbhk danger" data-act="del"><i class="fa-solid fa-trash"></i> Remove</button>
          </div>
        </div>
      </article>`;
    }
    const render = () => { grid.innerHTML = draft.map((h, i) => card(h, i, draft.length)).join('') || '<div class="empty-state"><i class="fa-solid fa-umbrella-beach"></i>No huts — click “Add hut”.</div>'; };

    grid.addEventListener('input', (e) => {
      const c = e.target.closest('.hut-ed'); if (!c || !e.target.dataset.f) return;
      const h = draft[+c.dataset.i], f = e.target.dataset.f;
      if (e.target.type === 'checkbox') h[f] = e.target.checked;
      else if (f === 'price') h.price = e.target.value === '' ? null : Number(e.target.value);
      else if (['capacity', 'rooms', 'washrooms'].includes(f)) h[f] = Number(e.target.value) || 0;
      else h[f] = e.target.value;
      setDirty(true);
    });
    grid.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b || b.dataset.act === 'files') return;
      const c = b.closest('.hut-ed'), i = +c.dataset.i, h = draft[i], act = b.dataset.act;
      if (act === 'up' && i > 0) [draft[i - 1], draft[i]] = [draft[i], draft[i - 1]];
      else if (act === 'down' && i < draft.length - 1) [draft[i + 1], draft[i]] = [draft[i], draft[i + 1]];
      else if (act === 'del') { if (!confirm(`Remove “${h.name}”${h.id === 'classic' ? ' — the ORIGINAL hut' : ''}? It disappears from the website after you press Save.`)) return; draft.splice(i, 1); }
      else if (act === 'rmimg') h.images.splice(+b.closest('.img-chip').dataset.k, 1);
      else if (act === 'cover') { const k = +b.closest('.img-chip').dataset.k; h.images.unshift(h.images.splice(k, 1)[0]); }
      else if (act === 'imgurl') { const u = prompt('Paste an image link (https://…) or a site path like images/hut.jpg'); if (!u) return; if (h.images.length >= 6) return status(stat, 'Max 6 photos per hut.', 'err'); h.images.push(u.trim()); }
      setDirty(true); render();
    });
    grid.addEventListener('change', async (e) => {
      if (e.target.dataset.act !== 'files') return;
      const h = draft[+e.target.closest('.hut-ed').dataset.i];
      const files = Array.from(e.target.files).slice(0, 6 - h.images.length);
      if (!files.length) return status(stat, 'Max 6 photos per hut.', 'err');
      try { status(stat, 'Processing pictures…'); for (const f of files) h.images.push(await C.fileToDataURL(f, 900, 0.72)); setDirty(true); render(); }
      catch (err) { status(stat, err.message, 'err'); }
    });
    $('#hutAdd').addEventListener('click', () => {
      draft.push({ id: uid('hut'), name: 'New hut', tag: '', desc: 'Describe this hut.', capacity: 0, rooms: 0, washrooms: 0, price: null, amenities: '', images: [], visible: true });
      setDirty(true); render(); grid.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    saveBtn.addEventListener('click', async () => {
      if (draft.some((h) => !h.name.trim())) return status(stat, 'Every hut needs a name.', 'err');
      const big = draft.find((h) => JSON.stringify(h).length > 900000);
      if (big) return status(stat, `“${big.name}” has too many/large photos for one record — remove one or use links.`, 'err');
      saveBtn.disabled = true; status(stat, 'Saving…');
      try { const r = await C.huts.save(draft); draft = C.huts.current(); dirty = false; saveBtn.classList.remove('pulse'); render(); status(stat, r.live ? 'Saved — live on the website ✓' : 'Saved on this device ✓', 'ok'); }
      catch (err) { saveBtn.disabled = false; status(stat, quotaMsg(err), 'err'); }
    });
    $('#hutReset').addEventListener('click', async () => {
      if (!confirm('Reset huts to the built-in set (original hut + the 3 starter huts)? Huts you added yourself will be removed.')) return;
      await C.huts.reset(); draft = C.huts.current(); dirty = false; saveBtn.disabled = true; render(); status(stat, 'Reset to the built-in huts ✓', 'ok');
    });
    C.huts.subscribe((list) => {
      if (dirty) return; draft = clone(list); render();
      const [t, live] = modeText(); const m = $('#hutMode'); m.innerHTML = t; m.classList.toggle('live', live);
    });
    window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  })();

  /* ================================================================== GALLERY */
  (function gallery() {
    const grid = $('#galGrid'); if (!grid) return;
    const saveBtn = $('#galSave'), stat = $('#galStatus'), newCat = $('#galNewCat'), filter = $('#galFilter');
    let draft = [], dirty = false, cat = 'all';
    newCat.innerHTML = Object.entries(C.GAL_CATS).map(([k, v]) => `<option value="${k}">Add to: ${v}</option>`).join('');
    const setDirty = (v) => { dirty = v; saveBtn.disabled = !v; saveBtn.classList.toggle('pulse', v); if (v) status(stat, 'Unsaved changes', 'warn'); };

    function renderFilter() {
      const cnt = (k) => (k === 'all' ? draft.length : draft.filter((g) => g.cat === k).length);
      filter.innerHTML = `<button type="button" class="${cat === 'all' ? 'active' : ''}" data-cat="all">All <b>${cnt('all')}</b></button>` +
        Object.entries(C.GAL_CATS).map(([k, v]) => `<button type="button" class="${cat === k ? 'active' : ''}" data-cat="${k}">${v} <b>${cnt(k)}</b></button>`).join('');
    }
    function render() {
      renderFilter();
      const rows = draft.map((g, i) => ({ g, i })).filter(({ g }) => cat === 'all' || g.cat === cat);
      grid.innerHTML = rows.map(({ g, i }) => `
        <figure class="gal-tile" data-i="${i}">
          <div class="gal-img"><img src="${esc(g.img)}" alt="" loading="lazy" onerror="this.src='images/logo.png'">
            <button type="button" class="chip-btn del" data-act="del" title="Delete picture"><i class="fa-solid fa-trash"></i></button>
            <span class="gal-pos">#${i + 1}</span></div>
          <figcaption>
            <input type="text" data-f="caption" value="${esc(g.caption)}" placeholder="Caption (optional)" maxlength="80">
            <div class="gal-row">
              <select data-f="cat">${Object.entries(C.GAL_CATS).map(([k, v]) => `<option value="${k}" ${g.cat === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
              <button type="button" class="btn-sm-tbhk" data-act="front" title="Move to front"><i class="fa-solid fa-angles-up"></i></button>
              <button type="button" class="btn-sm-tbhk" data-act="left" ${i === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-left"></i></button>
              <button type="button" class="btn-sm-tbhk" data-act="right" ${i === draft.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-right"></i></button>
            </div>
          </figcaption>
        </figure>`).join('') || '<div class="empty-state"><i class="fa-regular fa-images"></i>No pictures in this category.</div>';
    }
    filter.addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) { cat = b.dataset.cat; render(); } });
    grid.addEventListener('input', (e) => { const t = e.target.closest('.gal-tile'); if (!t || !e.target.dataset.f) return; draft[+t.dataset.i][e.target.dataset.f] = e.target.value; setDirty(true); if (e.target.dataset.f === 'cat') renderFilter(); });
    grid.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const i = +b.closest('.gal-tile').dataset.i, act = b.dataset.act;
      if (act === 'del') { if (!confirm('Delete this picture from the gallery? (after you press Save)')) return; draft.splice(i, 1); }
      else if (act === 'front') draft.unshift(draft.splice(i, 1)[0]);
      else if (act === 'left' && i > 0) [draft[i - 1], draft[i]] = [draft[i], draft[i - 1]];
      else if (act === 'right' && i < draft.length - 1) [draft[i + 1], draft[i]] = [draft[i], draft[i + 1]];
      setDirty(true); render();
    });
    $('#galFiles').addEventListener('change', async (e) => {
      const files = Array.from(e.target.files); e.target.value = ''; if (!files.length) return;
      try {
        let n = 0;
        for (const f of files) { status(stat, `Processing ${++n} of ${files.length}…`); draft.unshift({ id: uid('pic'), img: await C.fileToDataURL(f), cat: newCat.value, caption: '' }); }
        cat = 'all'; setDirty(true); render(); status(stat, `${files.length} picture${files.length > 1 ? 's' : ''} added — press Save to publish`, 'warn');
      } catch (err) { status(stat, err.message, 'err'); }
    });
    $('#galUrl').addEventListener('click', () => {
      const u = prompt('Paste an image link (https://…) or a site path like images/photo.jpg'); if (!u) return;
      draft.unshift({ id: uid('pic'), img: u.trim(), cat: newCat.value, caption: '' }); setDirty(true); render();
    });
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true; status(stat, 'Saving…');
      try { const r = await C.gallery.save(draft); draft = C.gallery.current(); dirty = false; saveBtn.classList.remove('pulse'); render(); status(stat, r.live ? 'Saved — live on the website ✓' : 'Saved on this device ✓', 'ok'); }
      catch (err) { saveBtn.disabled = false; status(stat, quotaMsg(err), 'err'); }
    });
    $('#galReset').addEventListener('click', async () => {
      if (!confirm('Reset the gallery to the original 10 pictures? Pictures you added will be removed.')) return;
      await C.gallery.reset(); draft = C.gallery.current(); dirty = false; saveBtn.disabled = true; render(); status(stat, 'Reset to the original pictures ✓', 'ok');
    });
    C.gallery.subscribe((list) => {
      if (dirty) return; draft = clone(list); render();
      const [t, live] = modeText(); const m = $('#galMode'); m.innerHTML = t; m.classList.toggle('live', live);
    });
    window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  })();

  /* ====================================================================== USERS */
  (function users() {
    const body = $('#usersTableBody'); if (!body || !window.TBHKStore) return;
    let rows = [];
    const fmt = (iso) => { const d = new Date(iso); return iso && !isNaN(d) ? d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; };
    const prov = { password: ['Email', 'fa-envelope'], 'google.com': ['Google', 'fa-google'], google: ['Google', 'fa-google'], facebook: ['Facebook', 'fa-facebook-f'], demo: ['Demo', 'fa-flask'] };
    function paint() {
      const q = ($('#userSearch').value || '').trim().toLowerCase();
      const bk = A ? A.bookings() : [];
      const list = rows.filter((u) => !q || [u.name, u.email, u.phone].join(' ').toLowerCase().includes(q))
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      $('#userCount').textContent = rows.length;
      const nav = $('#navUsers'); if (nav) { nav.textContent = rows.length; nav.hidden = !rows.length; }
      if (!list.length) { body.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa-solid fa-user-plus"></i>${rows.length ? 'No users match your search.' : 'No registered users yet.'}</div></td></tr>`; return; }
      body.innerHTML = list.map((u) => {
        const n = bk.filter((b) => (b.uid && b.uid === u.id) || (u.email && b.userEmail === u.email)).length;
        const p = prov[u.provider] || [u.provider || 'Email', 'fa-user'];
        const brand = p[1] === 'fa-google' || p[1] === 'fa-facebook-f';
        return `<tr>
          <td data-label="User"><div class="guest-cell"><span class="recent-avatar sm">${esc((u.name || u.email || '?').trim().charAt(0).toUpperCase())}</span><div><strong>${esc(u.name || '—')}</strong><div class="sub-id">${esc(u.role || 'customer')}</div></div></div></td>
          <td data-label="Email">${esc(u.email || '—')}</td>
          <td data-label="Phone">${esc(u.phone || '—')}</td>
          <td data-label="Sign-in"><span class="pkg-chip"><i class="fa-${brand ? 'brands' : 'solid'} ${p[1]}"></i> ${esc(p[0])}</span></td>
          <td data-label="Joined">${esc(fmt(u.createdAt))}</td>
          <td data-label="Bookings"><span class="guest-badge"><i class="fa-regular fa-calendar-check"></i> ${n}</span></td></tr>`;
      }).join('');
    }
    // Start only after the admin dashboard is revealed (Firestore needs the signed-in admin session)
    let started = false;
    function start() { if (started) return; started = true; window.TBHKStore.subscribeUsers((r) => { rows = r; paint(); }); }
    document.addEventListener('tbhk-admin-data', start, { once: true });
    $('.admin-nav button[data-panel="users"]')?.addEventListener('click', start);
    $('#userSearch').addEventListener('input', paint);
    document.addEventListener('tbhk-admin-data', paint);
  })();
})();
