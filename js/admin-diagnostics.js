/* ==========================================================================
   Admin — permissions help + "Run check"
   When Firebase answers "Missing or insufficient permissions", explain why and
   how to fix it, and let the admin test their access without guessing.
   ========================================================================== */
(function () {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fb = () => window.tbhkFirebase;

  const isPermission = (err) => !!err && (err.code === 'permission-denied' || /insufficient permissions|permission[- ]denied/i.test(err.message || ''));
  function who() {
    const u = fb() && fb().auth && fb().auth.currentUser;
    return { email: (u && u.email) || '', uid: (u && u.uid) || '', live: !!(fb() && fb().db) };
  }

  /** Tries a harmless admin-only write. Resolves {ok, message}. */
  async function check() {
    const w = who();
    if (!w.live) return { ok: true, message: 'Demo mode — no Firebase rules are involved here.' };
    if (!w.uid) return { ok: false, message: 'You are not signed in to Firebase.' };
    const { db, fns } = fb();
    try {
      await fns.setDoc(fns.doc(db, 'diagnostics', w.uid), { email: w.email || '', checkedAt: fns.serverTimestamp() });
      return { ok: true, message: 'Firebase recognises you as an admin — saving huts, gallery and prices is allowed.' };
    } catch (e) {
      return { ok: false, permission: isPermission(e), message: isPermission(e)
        ? 'Firebase refused: the published security rules don\'t recognise this account as an admin (or are an older version).'
        : 'Check failed: ' + (e.message || e) };
    }
  }

  /* ------------------------------------------------------------- help dialog */
  const overlay = document.createElement('div');
  overlay.className = 'diag-overlay';
  document.body.appendChild(overlay);

  function paintResult(box, r) {
    box.className = 'diag-result show ' + (r.ok ? 'ok' : 'err');
    box.innerHTML = `<i class="fa-solid ${r.ok ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i> ${esc(r.message)}`;
  }

  function showHelp() {
    const w = who();
    const listed = ((fb() && fb().ADMIN_EMAILS) || []).join(', ') || '—';
    overlay.innerHTML = `
      <div class="diag-box" role="dialog" aria-label="Fix Firebase permissions">
        <button class="icon-btn diag-x" data-d="close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
        <div class="diag-ico"><i class="fa-solid fa-shield-halved"></i></div>
        <h3>Firebase blocked this change</h3>
        <p>You're signed in as <b>${esc(w.email || 'unknown')}</b>, but the security rules published in your Firebase project didn't accept this account as an admin. This almost always means <b>the latest rules haven't been published yet</b>.</p>
        <ol class="diag-steps">
          <li>Open <b>Firebase console → Firestore Database → Rules</b>.</li>
          <li>Replace everything with the contents of <code>firebase/firestore.rules</code> from your project, then press <b>Publish</b>.</li>
          <li>Make sure <b>${esc(w.email || 'your email')}</b> is in the rules' admin list (the site config currently lists: <code>${esc(listed)}</code>).</li>
          <li>Come back here and press <b>Run check</b>.</li>
        </ol>
        <details class="diag-alt"><summary>Prefer not to edit the rules list? Grant access by ID instead</summary>
          <p>In Firestore, create a collection <code>admins</code> with a document whose ID is your user ID below (add any field, e.g. <code>ok: true</code>). No rules change needed.</p>
          <div class="diag-copy"><code id="diagUid">${esc(w.uid || '—')}</code><button class="btn-sm-tbhk" data-d="copy"><i class="fa-regular fa-copy"></i> Copy ID</button></div>
        </details>
        <div class="diag-result" id="diagRes"></div>
        <div class="diag-actions">
          <button class="btn-tbhk btn-sunset" data-d="run"><i class="fa-solid fa-stethoscope"></i> Run check</button>
          <button class="btn-tbhk btn-outline-tbhk" data-d="close">Close</button>
        </div>
      </div>`;
    overlay.classList.add('open');
  }
  overlay.addEventListener('click', async (e) => {
    if (e.target === overlay) return overlay.classList.remove('open');
    const b = e.target.closest('[data-d]'); if (!b) return;
    if (b.dataset.d === 'close') overlay.classList.remove('open');
    else if (b.dataset.d === 'copy') { try { await navigator.clipboard.writeText($('#diagUid', overlay).textContent); window.tbhkToast && window.tbhkToast('User ID copied'); } catch (x) {} }
    else if (b.dataset.d === 'run') { b.disabled = true; const r = await check(); paintResult($('#diagRes', overlay), r); b.disabled = false; }
  });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && overlay.classList.remove('open'));

  /* ------------------------------------------------- Settings → check card */
  function wireSettings() {
    const btn = $('#permCheckBtn'); if (!btn) return;
    const out = $('#permCheckOut'), me = $('#permWho');
    const paintWho = () => { const w = who(); if (me) me.innerHTML = w.live ? `Signed in as <b>${esc(w.email || '—')}</b><br><span class="sub-id">User ID: ${esc(w.uid)}</span>` : 'Demo mode (no Firebase).'; };
    paintWho(); document.addEventListener('tbhk-admin-data', paintWho, { once: true });
    btn.addEventListener('click', async () => {
      btn.disabled = true; out.className = 'diag-result show'; out.textContent = 'Checking…';
      const r = await check(); paintResult(out, r); btn.disabled = false;
      if (!r.ok && r.permission) showHelp();
    });
  }
  wireSettings();

  window.TBHKDiag = { isPermission, showHelp, check };
})();
