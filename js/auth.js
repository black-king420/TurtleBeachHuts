/* ==========================================================================
   Turtle Beach Huts Karachi — Auth logic
   Works standalone in demo mode (localStorage). The moment js/firebase-
   config.js has real keys, every call below transparently switches to
   real Firebase Authentication + Firestore. See firebase-config.js.
   ========================================================================== */
(function () {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  function whenReady() {
    return new Promise((resolve) => {
      if (window.__tbhkFirebaseReady) return resolve();
      window.addEventListener("tbhk-firebase-ready", () => resolve(), { once: true });
    });
  }
  function isLive() { return !!(window.tbhkFirebase && window.tbhkFirebase.auth); }

  function showPanel(id) {
    $$(".auth-panel").forEach((p) => p.classList.add("d-none"));
    const el = document.getElementById(id);
    if (el) el.classList.remove("d-none");
  }
  function setError(panel, msg) {
    let box = panel.querySelector(".auth-error");
    if (!box) {
      box = document.createElement("div");
      box.className = "auth-error";
      panel.querySelector("form")?.prepend(box);
    }
    if (!msg) { box.classList.remove("show"); box.textContent = ""; return; }
    box.textContent = msg;
    box.classList.add("show");
  }
  function friendlyError(err) {
    const code = err && err.code ? err.code : "";
    const map = {
      "auth/invalid-email": "That email address doesn't look right.",
      "auth/user-not-found": "No account found with that email.",
      "auth/wrong-password": "Incorrect password. Try again or reset it.",
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/email-already-in-use": "An account already exists with that email.",
      "auth/weak-password": "Choose a stronger password (6+ characters).",
      "auth/popup-closed-by-user": "Sign-in window closed before finishing.",
      "auth/network-request-failed": "Network error — check your connection.",
    };
    return map[code] || (err && err.message ? err.message.replace("Firebase: ", "") : "Something went wrong. Please try again.");
  }

  function setSession(profile) {
    localStorage.setItem("tbhk-session", JSON.stringify(profile));
  }

  // Demo mode only (no Firebase keys): never keep a readable password in localStorage — store a salted SHA-256 instead.
  async function hashPw(email, pw) {
    const bytes = new TextEncoder().encode("tbhk-demo|" + String(email).toLowerCase() + "|" + pw);
    const buf = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function upsertUserDoc(uid, data) {
    if (!isLive()) return;
    const { db, fns } = window.tbhkFirebase;
    await fns.setDoc(fns.doc(db, "users", uid), { ...data, updatedAt: fns.serverTimestamp() }, { merge: true });
  }

  function redirectAfterAuth(profile, forcedTarget) {
    const params = new URLSearchParams(location.search);
    // Only same-site page names are accepted (blocks open-redirect / javascript: links)
    const target = forcedTarget || (window.TBHKSession ? window.TBHKSession.safeRedirect(params.get("redirect")) : "home.html");
    document.querySelectorAll(".auth-panel").forEach((p) => p.classList.add("d-none"));
    showPanel("authSuccess");
    setTimeout(() => { window.location.href = target; }, 900);
  }

  document.addEventListener("DOMContentLoaded", () => {
    // ---- Tabs ----
    $$(".auth-tabs button[data-target]").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$(".auth-tabs button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        showPanel(btn.dataset.target);
      });
    });
    $$("[data-show-panel]").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        showPanel(link.dataset.showPanel);
        $$(".auth-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.target === link.dataset.showPanel));
      });
    });

    // ---- Password show/hide ----
    $$(".toggle-eye").forEach((btn) => {
      btn.addEventListener("click", () => {
        const input = btn.previousElementSibling;
        const icon = btn.querySelector("i");
        if (input.type === "password") { input.type = "text"; icon.classList.replace("fa-eye", "fa-eye-slash"); }
        else { input.type = "password"; icon.classList.replace("fa-eye-slash", "fa-eye"); }
      });
    });

    // ---- Password strength ----
    const regPass = $("#registerPassword");
    const bar = $("#strengthBar");
    const label = $("#strengthLabel");
    if (regPass) {
      regPass.addEventListener("input", () => {
        const v = regPass.value;
        let score = 0;
        if (v.length >= 6) score++;
        if (v.length >= 10) score++;
        if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
        if (/\d/.test(v)) score++;
        if (/[^A-Za-z0-9]/.test(v)) score++;
        const pct = [0, 20, 40, 65, 85, 100][score];
        const colors = ["#D33B3B", "#D33B3B", "#E8722C", "#F6C445", "#2E9E6C", "#2E9E6C"];
        const labels = ["Password strength", "Weak", "Fair", "Good", "Strong", "Very strong"];
        bar.style.width = pct + "%";
        bar.style.background = colors[score];
        label.textContent = v ? labels[score] : "Password strength";
      });
    }

    // ---- Login ----
    const loginForm = $("#loginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const panel = $("#panel-login");
        setError(panel, "");
        const email = $("#loginEmail").value.trim();
        const password = $("#loginPassword").value;
        const btn = $("#loginSubmit");
        btn.disabled = true; btn.textContent = "Signing in…";
        try {
          await whenReady();
          if (isLive()) {
            const { auth, fns } = window.tbhkFirebase;
            const cred = await fns.signInWithEmailAndPassword(auth, email, password);
            const profile = { uid: cred.user.uid, name: cred.user.displayName || email.split("@")[0], email, provider: "password" };
            setSession(profile);
            redirectAfterAuth(profile);
          } else {
            const users = JSON.parse(localStorage.getItem("tbhk-demo-users") || "{}");
            const rec = users[email];
            const h = await hashPw(email, password);
            // accepts the new hashed record, and upgrades any older plain-text demo record on first successful login
            if (!rec || !((rec.pwHash && rec.pwHash === h) || (rec.password && rec.password === password))) throw { code: "auth/invalid-credential" };
            if (rec.password) { delete rec.password; rec.pwHash = h; users[email] = rec; localStorage.setItem("tbhk-demo-users", JSON.stringify(users)); }
            const profile = { uid: "demo-" + email, name: rec.name, email, phone: rec.phone || "", provider: "demo" };
            setSession(profile);
            redirectAfterAuth(profile);
          }
        } catch (err) {
          setError(panel, friendlyError(err));
          btn.disabled = false; btn.textContent = "Sign in";
        }
      });
    }

    // ---- Register ----
    const registerForm = $("#registerForm");
    if (registerForm) {
      registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const panel = $("#panel-register");
        setError(panel, "");
        const name = $("#registerName").value.trim();
        const email = $("#registerEmail").value.trim();
        const password = $("#registerPassword").value;
        const adminList = ((window.tbhkFirebase && window.tbhkFirebase.ADMIN_EMAILS) || []).map((x) => String(x).toLowerCase());
        if (adminList.includes(email.toLowerCase())) { setError(panel, "That address is reserved for the site admin — use Admin sign in instead."); return; }
        const confirmEl = $("#registerConfirm");
        const btn = $("#registerSubmit");
        if (confirmEl && password !== confirmEl.value) { setError(panel, "Passwords don't match."); return; }
        if (password.length < 6) { setError(panel, "Password should be at least 6 characters."); return; }

        // ---- Phone capture + validation ----
        // Reads the validated E.164 number exposed by the inline country-code
        // script on auth.html (window.tbhkGetFullPhone).
        // Phone is optional here (it's collected again at booking). If typed, it must be valid.
        const rawPhone = ($("#registerPhone") && $("#registerPhone").value || "").trim();
        const phone = rawPhone ? (typeof window.tbhkGetFullPhone === "function" ? window.tbhkGetFullPhone() : rawPhone) : "";
        if (rawPhone && !phone) {
          setError(panel, "That phone number doesn't look right — fix it or leave it empty.");
          return;
        }

        btn.disabled = true; btn.textContent = "Creating account…";
        try {
          await whenReady();
          if (isLive()) {
            const { auth, fns } = window.tbhkFirebase;
            const cred = await fns.createUserWithEmailAndPassword(auth, email, password);
            await fns.updateProfile(cred.user, { displayName: name });
            await upsertUserDoc(cred.user.uid, { name, email, phone, role: "customer", createdAt: fns.serverTimestamp(), provider: "password" });
            try { await fns.sendEmailVerification(cred.user); } catch (e2) {}
            const profile = { uid: cred.user.uid, name, email, phone, provider: "password" };
            setSession(profile);
            redirectAfterAuth(profile);
          } else {
            const users = JSON.parse(localStorage.getItem("tbhk-demo-users") || "{}");
            if (users[email]) throw { code: "auth/email-already-in-use" };
            users[email] = { name, email, phone, pwHash: await hashPw(email, password), createdAt: new Date().toISOString() };
            localStorage.setItem("tbhk-demo-users", JSON.stringify(users));
            const profile = { uid: "demo-" + email, name, email, phone, provider: "demo" };
            setSession(profile);
            redirectAfterAuth(profile);
          }
        } catch (err) {
          setError(panel, friendlyError(err));
          btn.disabled = false; btn.textContent = "Create account";
        }
      });
    }

    // ---- Forgot password ----
    const forgotForm = $("#forgotForm");
    if (forgotForm) {
      forgotForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const panel = $("#panel-forgot");
        setError(panel, "");
        const email = $("#forgotEmail").value.trim();
        const btn = $("#forgotSubmit");
        btn.disabled = true; btn.textContent = "Sending…";
        try {
          await whenReady();
          if (isLive()) {
            const { auth, fns } = window.tbhkFirebase;
            await fns.sendPasswordResetEmail(auth, email);
          }
          btn.textContent = "Reset link sent ✓";
          setTimeout(() => {
            showPanel("panel-login");
            $$(".auth-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.target === "panel-login"));
            btn.disabled = false; btn.textContent = "Send reset link";
          }, 1600);
        } catch (err) {
          setError(panel, friendlyError(err));
          btn.disabled = false; btn.textContent = "Send reset link";
        }
      });
    }

    // ---- Social / guest ----
    async function socialSignIn(providerKey) {
      await whenReady();
      if (!isLive()) {
        const profile = { uid: "demo-" + providerKey, name: providerKey === "google" ? "Google Guest" : "Facebook Guest", email: providerKey + "@demo.tbhk", provider: providerKey };
        setSession(profile);
        redirectAfterAuth(profile);
        return;
      }
      const { auth, googleProvider, facebookProvider, fns } = window.tbhkFirebase;
      const provider = providerKey === "google" ? googleProvider : facebookProvider;
      const cred = await fns.signInWithPopup(auth, provider);
      await upsertUserDoc(cred.user.uid, { name: cred.user.displayName, email: cred.user.email, role: "customer", provider: providerKey, createdAt: fns.serverTimestamp() });
      const profile = { uid: cred.user.uid, name: cred.user.displayName, email: cred.user.email, provider: providerKey };
      setSession(profile);
      redirectAfterAuth(profile);
    }

    $("#googleBtn")?.addEventListener("click", () => socialSignIn("google").catch((err) => setError($("#panel-login"), friendlyError(err))));
    $("#facebookBtn")?.addEventListener("click", () => socialSignIn("facebook").catch((err) => setError($("#panel-login"), friendlyError(err))));

    $("#guestBtn")?.addEventListener("click", async () => {
      await whenReady();
      try {
        if (isLive()) {
          const { auth, fns } = window.tbhkFirebase;
          const cred = await fns.signInAnonymously(auth);
          const profile = { uid: cred.user.uid, name: "Guest", email: "", provider: "guest" };
          setSession(profile);
          redirectAfterAuth(profile, "home.html");
        } else {
          const profile = { uid: "demo-guest-" + Date.now(), name: "Guest", email: "", provider: "guest" };
          setSession(profile);
          redirectAfterAuth(profile, "home.html");
        }
      } catch (err) {
        // Anonymous sign-in may be switched off in the Firebase console — guests can still browse the whole site.
        const profile = { uid: "guest-" + Date.now(), name: "Guest", email: "", provider: "guest" };
        setSession(profile);
        redirectAfterAuth(profile, "home.html");
      }
    });

    // ?tab=register opens the Create-account tab; show a friendly note when arriving from the booking page
    const qp = new URLSearchParams(location.search);
    if (qp.get("tab") === "register") {
      const t = document.querySelector('.auth-tabs button[data-target="panel-register"]');
      t && t.click();
    }
    const note = $("#authNotice");
    if (note && /booking/.test(qp.get("redirect") || "")) note.classList.remove("d-none");
    const first = $("#loginEmail");
    first && !/Mobi|Android/i.test(navigator.userAgent) && first.focus();
  });
})();
