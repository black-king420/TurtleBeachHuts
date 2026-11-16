/* ==========================================================================
   TBHK Session helper
   - guest   = anonymous visitor (can browse the whole website)
   - member  = registered / signed-in account (required to BOOK)
   ========================================================================== */
(function () {
  'use strict';
  const KEY = 'tbhk-session';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };

  function whenReady() {
    return new Promise((resolve) => {
      if (window.__tbhkFirebaseReady) return resolve();
      window.addEventListener('tbhk-firebase-ready', () => resolve(), { once: true });
    });
  }

  const Session = {
    get: read,
    isGuest: (p = read()) => !!p && p.provider === 'guest',
    isMember: (p = read()) => !!p && p.provider !== 'guest',

    /** Resolves with the real, current profile (or null) once Firebase auth has settled. */
    async ready() {
      await whenReady();
      const fb = window.tbhkFirebase;
      if (!fb || !fb.auth) return read();                  // demo mode → localStorage session
      const { auth, fns } = fb;
      const user = await new Promise((resolve) => {
        let done = false;
        const off = fns.onAuthStateChanged(auth, (u) => { if (!done) { done = true; off(); resolve(u); } });
        setTimeout(() => { if (!done) { done = true; resolve(auth.currentUser); } }, 4000);
      });
      if (!user) { localStorage.removeItem(KEY); return null; }
      const prev = read(), same = prev && prev.uid === user.uid;
      const profile = {
        uid: user.uid,
        name: user.displayName || (user.email ? user.email.split('@')[0] : 'Guest'),
        email: user.email || '',
        phone: same ? prev.phone || '' : '',
        provider: user.isAnonymous ? 'guest' : (same && prev.provider && prev.provider !== 'guest' ? prev.provider : 'password')
      };
      localStorage.setItem(KEY, JSON.stringify(profile));
      return profile;
    },

    /** Only same-site page names are allowed as post-login destinations (blocks open-redirect / javascript: URLs). */
    safeRedirect(dest, fallback = 'home.html') {
      if (!dest) return fallback;
      if (dest === 'admin') return 'admin.html';
      return /^[a-z0-9_-]+\.html(\?[a-z0-9_=&%.-]*)?(#[a-z0-9_-]*)?$/i.test(dest) ? dest : fallback;
    },

    loginUrl(next, tab) {
      const q = new URLSearchParams();
      if (next) q.set('redirect', next);
      if (tab) q.set('tab', tab);
      return 'auth.html' + (q.toString() ? '?' + q : '');
    }
  };
  window.TBHKSession = Session;
})();
