/* ==========================================================================
   Admin login
   sign in → check admin → dashboard.   Also: first-time setup, Google,
   password reset, "signed in but not admin", fail-closed offline screen.
   ========================================================================== */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const states = ['Loading', 'Form', 'Denied', 'Success', 'Offline', 'Demo'];
  const show = (name) => states.forEach((s) => { $('#state' + s).hidden = s !== name; });
  const DASH = 'admin.html';

  function whenReady() {
    return new Promise((resolve) => {
      if (window.__tbhkFirebaseReady) return resolve();
      window.addEventListener('tbhk-firebase-ready', () => resolve(), { once: true });
    });
  }

  const msgBox = $('#alMsg');
  function msg(text, kind) {
    msgBox.textContent = text || '';
    msgBox.className = 'al-msg' + (text ? ' show ' + kind : '');
  }
  function friendly(err) {
    const map = {
      'auth/invalid-email': "That email address doesn't look right.",
      'auth/user-not-found': 'No account with that email. Use “First-time setup” to create the admin account.',
      'auth/wrong-password': 'Incorrect password. Try again or use “Forgot password?”.',
      'auth/invalid-credential': 'Incorrect email or password. If this is your first time, use “First-time setup”.',
      'auth/email-already-in-use': 'This admin account already exists — use the “Sign in” tab (or “Forgot password?”).',
      'auth/weak-password': 'Choose a stronger password (at least 6 characters).',
      'auth/too-many-requests': 'Too many attempts. Wait a few minutes or reset your password.',
      'auth/popup-closed-by-user': 'The Google window was closed before finishing.',
      'auth/popup-blocked': 'Your browser blocked the Google pop-up — allow pop-ups and try again.',
      'auth/network-request-failed': 'Network error — check your connection.',
      'auth/operation-not-allowed': 'This sign-in method is switched off in the Firebase console (Authentication → Sign-in method).',
      'auth/unauthorized-domain': 'This website address isn’t authorised in Firebase (Authentication → Settings → Authorized domains).'
    };
    return map[err && err.code] || (err && err.message ? err.message.replace('Firebase: ', '') : 'Something went wrong. Please try again.');
  }

  /* ------------------------------------------------------------------ boot */
  async function boot() {
    await whenReady();
    const fb = window.tbhkFirebase;
    if (!fb || !fb.auth) {                                   // Firebase not live
      show(window.__tbhkConfigured ? 'Offline' : 'Demo');    // keys present but failed → locked; no keys → demo
      return;
    }
    const { auth, fns, googleProvider } = fb;
    const admins = (fb.ADMIN_EMAILS || []).map((e) => String(e).toLowerCase());
    const isAdminEmail = (e) => !!e && admins.includes(String(e).toLowerCase());

    $('#modeBadge').innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Live · Firebase connected';

    function enter(user) {
      const name = user.displayName || (user.email || 'admin').split('@')[0];
      $('#welcomeText').textContent = 'Welcome back, ' + name.split(' ')[0];
      localStorage.setItem('tbhk-session', JSON.stringify({ uid: user.uid, name, email: user.email || '', phone: '', provider: 'password' }));
      show('Success');
      setTimeout(() => { location.href = DASH; }, 1100);
    }
    function denied(user) {
      $('#deniedText').textContent = (user.email || 'This account') + " is signed in, but it isn't on the admin list. Sign in with an admin account to continue.";
      show('Denied');
    }

    /* already signed in? */
    let handled = false;
    fns.onAuthStateChanged(auth, (user) => {
      if (handled) return; handled = true;
      if (!user || user.isAnonymous) return show('Form');    // guests / signed out → show the form
      isAdminEmail(user.email) ? enter(user) : denied(user);
    });
    setTimeout(() => { if (!handled) { handled = true; show('Form'); } }, 4500);

    $('#deniedSwitch').onclick = async () => { await fns.signOut(auth); localStorage.removeItem('tbhk-session'); show('Form'); };

    /* tabs: sign in / first-time setup */
    let mode = 'login';
    document.querySelectorAll('.al-tabs button').forEach((b) => b.addEventListener('click', () => {
      mode = b.dataset.tab; msg('');
      document.querySelectorAll('.al-tabs button').forEach((x) => x.classList.toggle('on', x === b));
      $('#nameField').hidden = mode !== 'setup';
      $('#alPass').autocomplete = mode === 'setup' ? 'new-password' : 'current-password';
      $('#alSubmit span').textContent = mode === 'setup' ? 'Create admin account' : 'Sign in to dashboard';
      $('#alSubmit i').className = mode === 'setup' ? 'fa-solid fa-user-shield' : 'fa-solid fa-right-to-bracket';
      $('.al-card h1').textContent = mode === 'setup' ? 'Create admin account' : 'Admin sign in';
      $('#stateForm .al-sub').textContent = mode === 'setup'
        ? 'One-time setup for an email on the admin list.' : 'Sign in to open your dashboard.';
    }));

    /* show / hide password */
    $('#alEye').onclick = () => {
      const p = $('#alPass'), on = p.type === 'password';
      p.type = on ? 'text' : 'password';
      $('#alEye i').className = on ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
    };

    // Slow down guessing: after 5 wrong attempts, wait 30 seconds (Firebase also rate-limits on its side)
    let fails = 0, lockUntil = 0;
    const locked = () => { const s = Math.ceil((lockUntil - Date.now()) / 1000); return s > 0 ? s : 0; };
    const noteFail = () => { if (++fails >= 5) { lockUntil = Date.now() + 30000; fails = 0; } };

    const busy = (btn, v, label) => { btn.disabled = v; if (label) btn.querySelector('span').textContent = label; };

    /* email + password */
    $('#loginForm').addEventListener('submit', async (e) => {
      e.preventDefault(); msg('');
      const email = $('#alEmail').value.trim(), pass = $('#alPass').value, name = $('#alName').value.trim();
      const btn = $('#alSubmit'), idle = mode === 'setup' ? 'Create admin account' : 'Sign in to dashboard';
      if (locked()) return msg('Too many attempts — please wait ' + locked() + ' seconds.', 'err');
      if (!email || !pass) return msg('Enter your admin email and password.', 'err');
      if (mode === 'setup') {
        if (!isAdminEmail(email)) return msg("That email isn't on the admin list. Add it to ADMIN_EMAILS in js/firebase-config.js (and in the Firestore rules) first.", 'err');
        if (pass.length < 6) return msg('Choose a password with at least 6 characters.', 'err');
      }
      busy(btn, true, mode === 'setup' ? 'Creating…' : 'Signing in…');
      try {
        let cred;
        if (mode === 'setup') {
          cred = await fns.createUserWithEmailAndPassword(auth, email, pass);
          if (name) { try { await fns.updateProfile(cred.user, { displayName: name }); } catch (e2) {} }
        } else {
          cred = await fns.signInWithEmailAndPassword(auth, email, pass);
        }
        if (!isAdminEmail(cred.user.email)) {                // a normal customer account tried the admin door
          await fns.signOut(auth); localStorage.removeItem('tbhk-session');
          busy(btn, false, idle);
          return msg("That account isn't an admin. Customers can sign in from the main website.", 'err');
        }
        enter(cred.user);
      } catch (err) {
        busy(btn, false, idle); noteFail(); msg(friendly(err), 'err');
      }
    });

    /* Google */
    $('#alGoogle').addEventListener('click', async () => {
      msg(''); const g = $('#alGoogle'); g.disabled = true;
      try {
        const cred = await fns.signInWithPopup(auth, googleProvider);
        if (!isAdminEmail(cred.user.email)) {
          await fns.signOut(auth); localStorage.removeItem('tbhk-session');
          return msg("That Google account isn't on the admin list.", 'err');
        }
        enter(cred.user);
      } catch (err) { msg(friendly(err), 'err'); }
      finally { g.disabled = false; }
    });

    /* forgot password */
    $('#alForgot').addEventListener('click', async () => {
      const email = $('#alEmail').value.trim();
      if (!email) return msg('Type your admin email above first, then press “Forgot password?”.', 'err');
      try { await fns.sendPasswordResetEmail(auth, email); } catch (e) { /* never reveal whether the account exists */ }
      msg('If an account exists for that email, a reset link is on its way.', 'ok');
    });
  }

  boot();
})();
