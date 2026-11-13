/* ==========================================================================
   Turtle Beach Huts Karachi — shared site behavior
   ========================================================================== */
(function () {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ---------- Load screen ---------- */
  window.addEventListener("load", () => {
    const ls = $("#loadScreen");
    if (ls) setTimeout(() => ls.classList.add("hide"), 350);
  });

  /* ---------- Theme toggle ---------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    $$(".theme-toggle i").forEach((i) => {
      i.className = theme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
    });
  }
  const savedTheme = localStorage.getItem("tbhk-theme") || "light";
  applyTheme(savedTheme);
  $$(".theme-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      localStorage.setItem("tbhk-theme", next);
      applyTheme(next);
    });
  });

  /* ---------- Nav scroll state ---------- */
  const nav = $(".tbhk-nav");
  function onScroll() {
    if (!nav) return;
    if (window.scrollY > 40) nav.classList.add("scrolled");
    else if (!nav.dataset.forceScrolled) nav.classList.remove("scrolled");
    const top = $(".fab-top");
    if (top) top.classList.toggle("show", window.scrollY > 500);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Active nav link ---------- */
  const here = location.pathname.split("/").pop() || "home.html";
  $$(".tbhk-nav .nav-link").forEach((a) => {
    const href = a.getAttribute("href");
    if (href === here) a.classList.add("active");
  });

  /* ---------- Back to top ---------- */
  $("#topFab, .fab-top")?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  /* ---------- FAQ accordion ---------- */
  $$(".faq-item").forEach((item) => {
    const q = item.querySelector(".faq-q");
    q?.addEventListener("click", () => item.classList.toggle("open"));
  });

  /* ---------- Counters ---------- */
  const counters = $$(".counter-num");
  if (counters.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const target = parseFloat(el.dataset.count || "0");
          const suffix = el.dataset.suffix || "";
          const dur = 1400;
          const start = performance.now();
          function tick(now) {
            const p = Math.min(1, (now - start) / dur);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.round(target * eased) + suffix;
            if (p < 1) requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
          io.unobserve(el);
        });
      },
      { threshold: 0.5 }
    );
    counters.forEach((c) => io.observe(c));
  }

  /* ---------- Sunset countdown ring (home hero) ---------- */
  const ring = $(".sun-ring");
  if (ring) {
    const prog = ring.querySelector(".prog");
    const t = ring.querySelector(".t");
    // Approximate Karachi sunset (local time, illustrative only).
    const now = new Date();
    const sunset = new Date(now);
    sunset.setHours(19, 15, 0, 0); // ~7:15 PM, Karachi coastal average
    let diffMs = sunset - now;
    if (diffMs < 0) { sunset.setDate(sunset.getDate() + 1); diffMs = sunset - now; }
    const totalDayMs = 13 * 60 * 60 * 1000; // ~13hr daylight window used for ring scale
    const remainingRatio = Math.max(0, Math.min(1, diffMs / totalDayMs));
    const circumference = 402;
    if (prog) prog.style.strokeDashoffset = String(circumference * (1 - remainingRatio));
    const hrs = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    if (t) t.textContent = diffMs > 0 ? `${hrs}h ${mins}m` : "—";
  }

  /* ---------- Newsletter form ---------- */
  $$("form").forEach((form) => {
    const emailInput = form.querySelector('input[type="email"]');
    const isNewsletter = emailInput && form.querySelectorAll("input").length === 1 && /subscribe/i.test(form.textContent);
    if (isNewsletter) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = form.querySelector("button");
        const original = btn.textContent;
        btn.textContent = "Subscribing…";
        try {
          if (window.TBHKStore) await window.TBHKStore.addNewsletter(emailInput.value.trim());
          btn.textContent = "Subscribed ✓";
          form.reset();
        } catch (err) {
          btn.textContent = "Try again";
        }
        setTimeout(() => (btn.textContent = original), 2200);
      });
    }
  });

  /* ---------- Toast helper (shared) ---------- */
  window.tbhkToast = function (message, type = "info") {
    let stack = $(".tbhk-toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "tbhk-toast-stack";
      document.body.appendChild(stack);
    }
    const el = document.createElement("div");
    el.className = "tbhk-toast " + type;
    el.innerHTML = `<i class="fa-solid ${type === "success" ? "fa-circle-check" : type === "error" ? "fa-circle-exclamation" : "fa-bell"}"></i><span>${message}</span>`;
    stack.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateY(-8px)"; setTimeout(() => el.remove(), 300); }, 3200);
  };

  /* ==========================================================================
     Profile slot — renders Sign in link OR avatar + dropdown, on every page
     ========================================================================== */
  function initials(name) {
    if (!name) return "G";
    return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  }

  function renderSignedOut(slot) {
    slot.innerHTML = `<a href="auth.html" class="tbhk-signin-link"><i class="fa-regular fa-user"></i> Sign in</a>`;
  }

  function renderSignedIn(slot, profile, isAdmin) {
    const wrap = document.createElement("div");
    wrap.className = "tbhk-profile";
    wrap.innerHTML = `
      <button class="tbhk-profile-btn" type="button">
        <span class="tbhk-avatar">${initials(profile.name)}</span>
        <span class="d-none d-sm-inline">${(profile.name || "Guest").split(" ")[0]}</span>
        <i class="fa-solid fa-chevron-down" style="font-size:.65rem;"></i>
      </button>
      <div class="tbhk-dropdown">
        <div style="padding:.5rem .7rem;">
          <div style="font-weight:800;font-size:.85rem;">${profile.name || "Guest"}</div>
          <div style="font-size:.72rem;color:var(--ink-faint);">${profile.email || "Guest session"}</div>
        </div>
        <div class="divider"></div>
        <a href="booking.html"><i class="fa-regular fa-calendar-check"></i> My bookings</a>
        ${isAdmin ? '<a href="admin.html"><i class="fa-solid fa-gauge"></i> Admin dashboard</a>' : ""}
        <div class="divider"></div>
        <button type="button" data-logout><i class="fa-solid fa-arrow-right-from-bracket"></i> Sign out</button>
      </div>`;
    slot.innerHTML = "";
    slot.appendChild(wrap);

    const btn = wrap.querySelector(".tbhk-profile-btn");
    btn.addEventListener("click", (e) => { e.stopPropagation(); wrap.classList.toggle("open"); });
    document.addEventListener("click", () => wrap.classList.remove("open"));

    wrap.querySelector("[data-logout]").addEventListener("click", async () => {
      localStorage.removeItem("tbhk-session");
      try {
        if (window.tbhkFirebase && window.tbhkFirebase.auth) {
          await window.tbhkFirebase.fns.signOut(window.tbhkFirebase.auth);
        }
      } catch (e) {}
      window.tbhkToast && window.tbhkToast("Signed out. See you at the shore!", "success");
      setTimeout(() => (window.location.href = "home.html"), 500);
    });
  }

  function renderProfileSlots() {
    const slots = $$("[data-profile-slot]");
    if (!slots.length) return;

    function fromLocalSession() {
      try { return JSON.parse(localStorage.getItem("tbhk-session") || "null"); }
      catch (e) { return null; }
    }

    function paint(profile) {
      const admins = (window.tbhkFirebase && window.tbhkFirebase.ADMIN_EMAILS) || [];
      const isAdmin = !!(profile && profile.email && admins.includes(profile.email));
      slots.forEach((slot) => (profile ? renderSignedIn(slot, profile, isAdmin) : renderSignedOut(slot)));
    }

    if (window.__tbhkFirebaseReady) {
      wireLive();
    } else {
      paint(fromLocalSession());
      window.addEventListener("tbhk-firebase-ready", wireLive, { once: true });
    }

    function wireLive() {
      if (window.tbhkFirebase && window.tbhkFirebase.auth) {
        const { auth, fns } = window.tbhkFirebase;
        fns.onAuthStateChanged(auth, (user) => {
          if (user) {
            const profile = { uid: user.uid, name: user.displayName || (user.email ? user.email.split("@")[0] : "Guest"), email: user.email || "" };
            localStorage.setItem("tbhk-session", JSON.stringify(profile));
            paint(profile);
          } else {
            localStorage.removeItem("tbhk-session");
            paint(null);
          }
        });
      } else {
        paint(fromLocalSession());
      }
    }
  }

  document.addEventListener("DOMContentLoaded", renderProfileSlots);
})();
