/* ==========================================================================
   Admin — "Huts & Prices" manager (edit name, price, picture, order, visibility)
   ========================================================================== */
(function () {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const esc = (s) => window.TBHKCatalog.esc(s);
  const Cat = window.TBHKCatalog;
  let draft = null, dirty = false, loadedOnce = false;

  const grid = $('#catGrid'), saveBtn = $('#catSave'), status = $('#catStatus');

  function setDirty(v) {
    dirty = v;
    saveBtn.classList.toggle('pulse', v);
    saveBtn.disabled = !v;
    status.textContent = v ? 'Unsaved changes' : '';
    status.className = 'cat-status' + (v ? ' warn' : '');
  }
  function flash(msg, ok = true) {
    status.textContent = msg; status.className = 'cat-status ' + (ok ? 'ok' : 'err');
    if (ok) setTimeout(() => { if (!dirty) status.textContent = ''; }, 3500);
  }
  const uid = () => 'pkg-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  function cardHTML(it, i, n) {
    return `
    <article class="cat-card" data-i="${i}">
      <div class="cat-img">
        <img src="${esc(it.img)}" alt="" onerror="this.src='images/logo.png'">
        <label class="cat-pick"><i class="fa-solid fa-camera"></i> Change picture
          <input type="file" accept="image/*" data-act="file" hidden></label>
        ${it.tag ? `<span class="cat-ribbon">${esc(it.tag)}</span>` : ''}
        <span class="cat-index">#${i + 1}</span>
      </div>
      <div class="cat-body">
        <label>Name<input type="text" data-f="name" value="${esc(it.name)}"></label>
        <div class="cat-row">
          <label>Price (PKR)<input type="number" min="0" step="500" data-f="price" value="${it.price === null ? '' : it.price}" placeholder="e.g. 19000"></label>
          <label>If no price, show<input type="text" data-f="priceNote" value="${esc(it.priceNote)}" placeholder="Custom quote"></label>
        </div>
        <label>Ribbon tag <small>(Popular, Premium… optional)</small><input type="text" data-f="tag" value="${esc(it.tag)}" maxlength="18"></label>
        <label>Description<textarea rows="3" data-f="desc">${esc(it.desc)}</textarea></label>
        <div class="cat-checks">
          <label><input type="checkbox" data-f="featured" ${it.featured ? 'checked' : ''}> Featured carousel</label>
          <label><input type="checkbox" data-f="home" ${it.home ? 'checked' : ''}> Home packages row</label>
        </div>
        <div class="cat-actions">
          <button type="button" class="btn-sm-tbhk" data-act="up" ${i === 0 ? 'disabled' : ''} title="Move earlier"><i class="fa-solid fa-arrow-up"></i></button>
          <button type="button" class="btn-sm-tbhk" data-act="down" ${i === n - 1 ? 'disabled' : ''} title="Move later"><i class="fa-solid fa-arrow-down"></i></button>
          <button type="button" class="btn-sm-tbhk" data-act="url"><i class="fa-solid fa-link"></i> Image URL</button>
          <button type="button" class="btn-sm-tbhk danger" data-act="del"><i class="fa-solid fa-trash"></i> Remove</button>
        </div>
      </div>
    </article>`;
  }

  function render() {
    grid.innerHTML = draft.items.map((it, i) => cardHTML(it, i, draft.items.length)).join('') ||
      '<div class="empty-state"><i class="fa-solid fa-box-open"></i>No packages yet — click “Add package”.</div>';
    $('#catFromPrice').value = draft.settings.fromPrice;
  }

  grid.addEventListener('input', (e) => {
    const card = e.target.closest('.cat-card'); if (!card) return;
    const it = draft.items[+card.dataset.i], f = e.target.dataset.f; if (!f) return;
    if (e.target.type === 'checkbox') it[f] = e.target.checked;
    else if (f === 'price') it.price = e.target.value === '' ? null : Number(e.target.value);
    else it[f] = e.target.value;
    if (f === 'tag') { const r = card.querySelector('.cat-ribbon'); if (r) r.textContent = it.tag; }
    setDirty(true);
  });

  grid.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]'); if (!btn || btn.dataset.act === 'file') return;
    const i = +btn.closest('.cat-card').dataset.i, items = draft.items;
    const act = btn.dataset.act;
    if (act === 'up' && i > 0) [items[i - 1], items[i]] = [items[i], items[i - 1]];
    else if (act === 'down' && i < items.length - 1) [items[i + 1], items[i]] = [items[i], items[i + 1]];
    else if (act === 'del') { if (!confirm(`Remove “${items[i].name}”? This takes effect when you press Save.`)) return; items.splice(i, 1); }
    else if (act === 'url') {
      const u = prompt('Paste an image link (https://…) or a site path like images/photo.jpg', items[i].img.startsWith('data:') ? '' : items[i].img);
      if (!u) return; items[i].img = u.trim();
    }
    setDirty(true); render();
  });

  grid.addEventListener('change', async (e) => {
    if (e.target.dataset.act !== 'file') return;
    const file = e.target.files[0]; if (!file) return;
    const i = +e.target.closest('.cat-card').dataset.i;
    try {
      flash('Processing picture…');
      draft.items[i].img = await Cat.fileToDataURL(file);
      setDirty(true); render();
    } catch (err) { flash(err.message, false); }
  });

  $('#catAdd').addEventListener('click', () => {
    draft.items.unshift({ id: uid(), name: 'New package', price: 0, priceNote: '', img: 'images/logo.png', tag: '', featured: false, home: false, desc: 'Describe this package.' });
    setDirty(true); render(); grid.firstElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  $('#catFromPrice').addEventListener('input', (e) => { draft.settings.fromPrice = Number(e.target.value) || 0; setDirty(true); });

  saveBtn.addEventListener('click', async () => {
    const names = draft.items.map((x) => x.name.trim().toLowerCase());
    if (names.some((n, i) => !n || names.indexOf(n) !== i)) return flash('Every package needs a unique name.', false);
    saveBtn.disabled = true; flash('Saving…');
    try {
      const r = await Cat.save(draft);
      draft = Cat.current(); setDirty(false); render();
      flash(r.live ? 'Saved — live for all visitors ✓' : 'Saved on this device ✓ (connect Firebase to publish to everyone)');
    } catch (err) {
      saveBtn.disabled = false;
      flash(/quota/i.test(err.message) ? 'Storage full — use smaller pictures or the “Image URL” option.' : 'Could not save: ' + err.message, false);
    }
  });

  $('#catReset').addEventListener('click', async () => {
    if (!confirm('Reset ALL packages, prices and pictures to the original defaults?')) return;
    await Cat.reset(); draft = Cat.current(); setDirty(false); render(); flash('Reset to defaults ✓');
  });

  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  Cat.subscribe((c) => {
    if (dirty) return;               // never overwrite what the admin is typing
    draft = JSON.parse(JSON.stringify(c)); render();
    if (!loadedOnce) { loadedOnce = true; setDirty(false); }
    const live = !!(window.tbhkFirebase && window.tbhkFirebase.db);
    $('#catMode').innerHTML = live
      ? '<i class="fa-solid fa-cloud"></i> Live — saved changes publish to all visitors instantly.'
      : '<i class="fa-solid fa-flask"></i> Demo mode — changes are saved on this device/browser only. Connect Firebase to publish to everyone.';
    $('#catMode').classList.toggle('live', live);
  });
})();
