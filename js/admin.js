/* ==========================================================================
   Turtle Beach Huts Karachi — Admin dashboard
   ========================================================================== */
(function () {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const PACKAGE_PRICE = {
    "Family Package": 19000, "Birthday Package": 24000, "Corporate Package": 0,
    "BBQ Package": 22000, "Photography Package": 20000, "Luxury Package": 45000,
    "Weekend Package": 55000, "Holiday Package": 65000, "Custom Package": 0,
  };

  function priceFor(name) {
    const c = window.TBHKCatalog && window.TBHKCatalog.current();
    const it = c && c.items.find((i) => i.name === name);
    return it ? Number(it.price) || 0 : PACKAGE_PRICE[name] || 0;
  }

  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  window.TBHKAdmin = { bookings: () => bookings, messages: () => messages, esc: (v) => esc(v) };
  let bookings = [];
  let messages = [];
  let chart = null;

  function whenReady() {
    return new Promise((resolve) => {
      if (window.__tbhkFirebaseReady) return resolve();
      window.addEventListener("tbhk-firebase-ready", () => resolve(), { once: true });
    });
  }

  /* ---------------- Auth guard ---------------- */
  async function guard() {
    await whenReady();
    const modeBadge = $("#modeBadge");
    const live = !!(window.tbhkFirebase && window.tbhkFirebase.auth);
    modeBadge.classList.toggle("live", live);
    modeBadge.innerHTML = live
      ? '<i class="fa-solid fa-satellite-dish"></i> Live · Firebase connected'
      : '<i class="fa-solid fa-flask"></i> Demo mode · local data';

    if (!live) {
      if (window.__tbhkConfigured) {
        // Keys exist but Firebase could not load (offline / blocked): fail CLOSED, never open the dashboard.
        $("#adminGuardScreen").innerHTML = `
          <div class="guard-box">
            <i class="fa-solid fa-plug-circle-exclamation guard-icon"></i>
            <h2>Can't reach the server</h2>
            <p>The admin sign-in service didn't load, so the dashboard stays locked. Check your internet connection and try again.</p>
            <button class="btn-tbhk btn-sunset" onclick="location.reload()"><i class="fa-solid fa-rotate"></i> Retry</button>
            <a href="home.html" class="btn-tbhk btn-ghost-light">Back to site</a>
          </div>`;
        return;
      }
      // Zero-setup preview (no Firebase keys at all): clearly labelled demo.
      revealDashboard({ name: "Demo Admin", email: "demo@local" });
      return;
    }

    const { auth, fns } = window.tbhkFirebase;
    fns.onAuthStateChanged(auth, (user) => {
      const admins = window.tbhkFirebase.ADMIN_EMAILS || [];
      if (!user || user.isAnonymous) {
        // signed out or just a guest → the dedicated admin sign-in page
        window.location.href = "admin-login.html";
        return;
      }
      if (!admins.map((e) => String(e).toLowerCase()).includes(String(user.email || "").toLowerCase())) {
        showDenied(user.email);
        return;
      }
      revealDashboard({ name: user.displayName || user.email, email: user.email });
    });
  }


  function showDenied(email) {
    $("#adminGuardScreen").innerHTML = `
      <div class="guard-box">
        <i class="fa-solid fa-lock guard-icon"></i>
        <h2>Access restricted</h2>
        <p>${esc(email)} is signed in, but it isn't an admin account.</p>
        <button class="btn-tbhk btn-sunset" id="dSwitch"><i class="fa-solid fa-right-left"></i> Sign out &amp; use another account</button>
        <a href="home.html" class="btn-tbhk btn-ghost-light">Back to site</a>
      </div>`;
    $("#adminGuardScreen").classList.remove("d-none");
    $("#adminApp").classList.add("d-none");
    const sw = $("#dSwitch");
    if (sw) sw.onclick = async () => {
      localStorage.removeItem("tbhk-session");
      try { await window.tbhkFirebase.fns.signOut(window.tbhkFirebase.auth); } catch (e) {}
      location.href = "admin-login.html";
    };
  }

  function revealDashboard(who) {
    $("#adminGuardScreen").classList.add("d-none");
    $("#adminApp").classList.remove("d-none");
    $("#adminWhoami").textContent = who.name || who.email;
    $("#adminWhoamiEmail").textContent = who.email || "";
    wireData();
  }

  /* ---------------- Data wiring ---------------- */
  function wireData() {
    window.TBHKStore.subscribeBookings((rows) => { bookings = rows; renderBookings(); renderStats(); renderChart(); document.dispatchEvent(new CustomEvent("tbhk-admin-data")); });
    window.TBHKStore.subscribeMessages((rows) => { messages = rows; renderMessages(); renderStats(); document.dispatchEvent(new CustomEvent("tbhk-admin-data")); });
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return esc(iso);
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  }

  /* ---------------- Stats ---------------- */
  function renderStats() {
    const total = bookings.length;
    const pending = bookings.filter((b) => (b.status || "Pending") === "Pending").length;
    const confirmed = bookings.filter((b) => b.status === "Confirmed").length;
    const cancelled = bookings.filter((b) => b.status === "Cancelled").length;
    const revenue = bookings
      .filter((b) => b.status !== "Cancelled")
      .reduce((sum, b) => sum + priceFor(b.package), 0);
    const unread = messages.filter((m) => !m.read).length;

    $("#statTotal").textContent = total;
    $("#statPending").textContent = pending;
    $("#statConfirmed").textContent = confirmed;
    $("#statCancelled").textContent = cancelled;
    $("#statRevenue").textContent = "PKR " + revenue.toLocaleString();
    $("#statMessages").textContent = messages.length;
    $("#statUnread").textContent = unread + " unread";
    renderRecent();
    renderUpcoming();
    renderTabCounts();
    renderChips(pending, unread);
  }

  function renderTabCounts() {
    const c = { all: bookings.length, Pending: 0, Confirmed: 0, Cancelled: 0 };
    bookings.forEach((b) => { const s = b.status || "Pending"; if (c[s] !== undefined) c[s]++; });
    Object.keys(c).forEach((k) => { const el = $(`[data-count="${k}"]`); if (el) el.textContent = c[k]; });
  }

  function todayISO() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

  function renderChips(pending, unread) {
    const box = $("#welcomeChips"); if (!box) return;
    const t = todayISO();
    const today = bookings.filter((b) => b.date === t && b.status !== "Cancelled").length;
    const chip = (ico, txt, panel) => `<button type="button" class="w-chip" data-jump="${panel}"><i class="${ico}"></i>${txt}</button>`;
    box.innerHTML =
      chip("fa-solid fa-plane-arrival", `${today} arrival${today === 1 ? "" : "s"} today`, "bookings") +
      chip("fa-solid fa-hourglass-half", `${pending} pending`, "bookings") +
      chip("fa-regular fa-envelope", `${unread} unread`, "messages");
    box.querySelectorAll("[data-jump]").forEach((b) => b.addEventListener("click", () => $(`.admin-nav button[data-panel="${b.dataset.jump}"]`).click()));
  }

  function renderUpcoming() {
    const box = $("#upcomingList"); if (!box) return;
    const t = todayISO();
    const rows = bookings.filter((b) => b.date && b.date >= t && b.status !== "Cancelled").sort((x, y) => (x.date > y.date ? 1 : -1)).slice(0, 5);
    $("#upcomingCount").textContent = rows.length + " coming";
    if (!rows.length) { box.innerHTML = `<div class="empty-state"><i class="fa-solid fa-umbrella-beach"></i>No upcoming arrivals yet.</div>`; return; }
    const mon = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    box.innerHTML = rows.map((b) => {
      const d = new Date(b.date + "T00:00:00");
      const day = isNaN(d) ? "—" : d.getDate(), m = isNaN(d) ? "" : mon[d.getMonth()];
      const guests = (Number(b.adults) || 0) + (Number(b.children) || 0);
      return `<div class="up-item row-click" data-open="${esc(b.id)}"><div class="up-date"><b>${esc(day)}</b><span>${esc(m)}</span></div>
        <div class="recent-main"><strong>${esc(b.name || "Guest")}</strong><span>${esc(b.package || "—")}${b.time ? " · " + esc(b.time) : ""}</span></div>
        <span class="guest-badge"><i class="fa-solid fa-user-group"></i> ${guests}</span></div>`;
    }).join("");
  }

  function renderRecent() {
    const box = $("#recentList");
    if (!box) return;
    const rows = bookings.slice(0, 5);
    if (!rows.length) {
      box.innerHTML = `<div class="empty-state"><i class="fa-regular fa-calendar"></i>No bookings yet — they'll appear here the moment a guest books.</div>`;
      return;
    }
    box.innerHTML = rows.map((b) => {
      const st = String(b.status || "Pending");
      const cls = ["pending", "confirmed", "cancelled"].includes(st.toLowerCase()) ? st.toLowerCase() : "pending";
      const initial = esc((b.name || "?").trim().charAt(0).toUpperCase() || "?");
      return `<div class="recent-item row-click" data-open="${esc(b.id)}">
        <span class="recent-avatar">${initial}</span>
        <div class="recent-main"><strong>${esc(b.name || "Guest")}</strong>
          <span>${esc(b.package || "—")} · ${esc(b.date || "no date")}${b.time ? " · " + esc(b.time) : ""}</span></div>
        <span class="status-pill ${cls}">${esc(st)}</span>
      </div>`;
    }).join("");
  }

  /* ---------------- Bookings table ---------------- */
  function filteredBookings() {
    const term = ($("#bookingSearch")?.value || "").toLowerCase();
    const status = $("#bookingStatusFilter")?.value || "all";
    return bookings.filter((b) => {
      const matchesTerm = !term || [b.name, b.phone, b.email, b.package].some((v) => (v || "").toLowerCase().includes(term));
      const matchesStatus = status === "all" || (b.status || "Pending") === status;
      return matchesTerm && matchesStatus;
    });
  }

  function renderBookings() {
    const rows = filteredBookings();
    const tbody = $("#bookingsTableBody");
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fa-regular fa-calendar"></i>No bookings match yet.</div></td></tr>`;
      return;
    }
    tbody.innerHTML = rows
      .map((b) => {
        const status = String(b.status || "Pending");
        const cls = ["pending", "confirmed", "cancelled"].includes(status.toLowerCase()) ? status.toLowerCase() : "pending";
        return `<tr class="row-click" data-open="${esc(b.id)}">
          <td data-label="Guest"><div class="guest-cell"><span class="recent-avatar sm">${esc((b.name || "?").trim().charAt(0).toUpperCase() || "?")}</span><div><strong>${esc(b.name || "—")}</strong><div class="sub-id">${esc(b.id)}</div></div></div></td>
          <td data-label="Contact">${esc(b.phone || "—")}${b.whatsapp ? `<div style="font-size:.72rem;color:var(--ink-faint);">WA: ${esc(b.whatsapp)}</div>` : ""}</td>
          <td data-label="Email">${esc(b.email || "—")}</td>
          <td data-label="Package"><span class="pkg-chip">${esc(b.package || "—")}</span></td>
          <td data-label="Date">${esc(b.date || "—")}${b.time ? " · " + esc(b.time) : ""}</td>
          <td data-label="Party">${esc(b.adults || 0)} adults, ${esc(b.children || 0)} kids</td>
          <td data-label="Status"><span class="status-pill ${cls}">${esc(status)}</span></td>
          <td data-label="Submitted">${fmtDate(b.createdAt)}</td>
          <td data-label="Actions">
            <div class="row-actions">
              <button title="Confirm" data-action="confirm" data-id="${esc(b.id)}"><i class="fa-solid fa-check"></i></button>
              <button title="Cancel" data-action="cancel" data-id="${esc(b.id)}"><i class="fa-solid fa-ban"></i></button>
              <button title="Delete" class="del" data-action="delete" data-id="${esc(b.id)}"><i class="fa-solid fa-trash"></i></button>
            </div>
          </td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll("button[data-action]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        try {
          if (action === "confirm") await window.TBHKStore.updateBookingStatus(id, "Confirmed");
          if (action === "cancel") await window.TBHKStore.updateBookingStatus(id, "Cancelled");
          if (action === "delete") { if (confirm("Delete this booking permanently?")) await window.TBHKStore.deleteBooking(id); }
          window.tbhkToast && window.tbhkToast("Booking updated", "success");
        } catch (e) {
          window.tbhkToast && window.tbhkToast("Couldn't update booking", "error");
        }
      });
    });
  }

  /* ---------------- Messages table ---------------- */
  function renderMessages() {
    const tbody = $("#messagesTableBody");
    if (!messages.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa-regular fa-envelope"></i>No messages yet.</div></td></tr>`;
      return;
    }
    tbody.innerHTML = messages
      .map(
        (m) => `<tr>
          <td data-label="Name"><div class="guest-cell"><span class="recent-avatar sm${!m.read ? " unread" : ""}">${esc((m.name || "?").trim().charAt(0).toUpperCase() || "?")}</span><div><strong>${esc(m.name || "—")}</strong>${!m.read ? ' <span class="status-pill pending">New</span>' : ""}</div></div></td>
          <td data-label="Email">${esc(m.email || "—")}</td>
          <td data-label="Phone">${esc(m.phone || "—")}</td>
          <td data-label="Subject">${esc(m.subject || "—")}</td>
          <td data-label="Message" style="max-width:280px;white-space:normal;">${esc((m.message || "").slice(0, 140))}${(m.message || "").length > 140 ? "…" : ""}</td>
          <td data-label="Actions">
            <div class="row-actions">
              <button title="Mark read" data-action="read" data-id="${esc(m.id)}"><i class="fa-solid fa-envelope-open"></i></button>
              <button title="Delete" class="del" data-action="delmsg" data-id="${esc(m.id)}"><i class="fa-solid fa-trash"></i></button>
            </div>
          </td>
        </tr>`
      )
      .join("");

    tbody.querySelectorAll("button[data-action]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (btn.dataset.action === "read") await window.TBHKStore.markMessageRead(id, true);
        if (btn.dataset.action === "delmsg") { if (confirm("Delete this message?")) await window.TBHKStore.deleteMessage(id); }
      });
    });
  }

  /* ---------------- Chart ---------------- */
  let donut = null;
  function renderDonut() {
    const canvas = $("#statusChart");
    if (!canvas || !window.Chart) return;
    const vals = ["Pending", "Confirmed", "Cancelled"].map((k) => bookings.filter((b) => (b.status || "Pending") === k).length);
    if (donut) { donut.data.datasets[0].data = vals; donut.update(); return; }
    const centre = {
      id: "centreText",
      afterDraw(c) {
        const { ctx, chartArea: ca } = c; const total = c.data.datasets[0].data.reduce((x, y) => x + y, 0);
        const cx = (ca.left + ca.right) / 2, cy = (ca.top + ca.bottom) / 2;
        const css = getComputedStyle(document.documentElement);
        ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = css.getPropertyValue("--ink").trim() || "#10302F"; ctx.font = "700 30px Fraunces, Georgia, serif"; ctx.fillText(total, cx, cy - 8);
        ctx.fillStyle = css.getPropertyValue("--ink-faint").trim() || "#6b7f7e"; ctx.font = "500 11px 'IBM Plex Mono', monospace"; ctx.fillText("BOOKINGS", cx, cy + 16); ctx.restore();
      },
    };
    donut = new window.Chart(canvas, {
      type: "doughnut",
      data: { labels: ["Pending", "Confirmed", "Cancelled"], datasets: [{ data: vals, backgroundColor: ["#F6C445", "#2E9E6C", "#D33B3B"], borderWidth: 0, hoverOffset: 8, spacing: 3, borderRadius: 8 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: "72%", plugins: { legend: { position: "bottom", labels: { usePointStyle: true, pointStyle: "circle", padding: 16, font: { family: "Manrope", weight: "600" } } } } },
      plugins: [centre],
    });
  }

  function renderChart() {
    renderDonut();
    const canvas = $("#packageChart");
    if (!canvas || !window.Chart) return;
    const counts = {};
    bookings.forEach((b) => { const p = b.package || "Other"; counts[p] = (counts[p] || 0) + 1; });
    const labels = Object.keys(counts);
    const data = Object.values(counts);
    if (chart) { chart.data.labels = labels; chart.data.datasets[0].data = data; chart.update(); return; }
    chart = new window.Chart(canvas, {
      type: "bar",
      data: { labels, datasets: [{ label: "Bookings", data, backgroundColor: (ctx) => {
          const { chart: c } = ctx; if (!c.chartArea) return "#E8722C";
          const g = c.ctx.createLinearGradient(0, c.chartArea.bottom, 0, c.chartArea.top);
          g.addColorStop(0, "#C1440E"); g.addColorStop(1, "#F6C445"); return g; }, borderRadius: 10, maxBarThickness: 38 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "rgba(16,48,47,.07)" } }, x: { grid: { display: false } } },
      },
    });
  }

  /* ---------------- Excel export ---------------- */
  function exportBookings() {
    if (!window.XLSX) return;
    const rows = filteredBookings().map((b) => ({
      "Booking ID": b.id, "Name": b.name, "Phone": b.phone, "WhatsApp": b.whatsapp, "Email": b.email,
      "Date": b.date, "Time": b.time, "Adults": b.adults, "Children": b.children, "Package": b.package,
      "Special Request": b.request, "Coupon": b.coupon, "Status": b.status || "Pending", "Created": fmtDate(b.createdAt),
    }));
    const ws = window.XLSX.utils.json_to_sheet(rows);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Bookings");
    window.XLSX.writeFile(wb, `TBHK-Bookings-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function exportMessages() {
    if (!window.XLSX) return;
    const rows = messages.map((m) => ({
      Name: m.name, Email: m.email, Phone: m.phone, Subject: m.subject, Message: m.message, Read: m.read ? "Yes" : "No", Created: fmtDate(m.createdAt),
    }));
    const ws = window.XLSX.utils.json_to_sheet(rows);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Messages");
    window.XLSX.writeFile(wb, `TBHK-Messages-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function exportAll() {
    if (!window.XLSX) return;
    const wb = window.XLSX.utils.book_new();
    const bookingRows = bookings.map((b) => ({
      "Booking ID": b.id, "Name": b.name, "Phone": b.phone, "WhatsApp": b.whatsapp, "Email": b.email,
      "Date": b.date, "Time": b.time, "Adults": b.adults, "Children": b.children, "Package": b.package,
      "Special Request": b.request, "Coupon": b.coupon, "Status": b.status || "Pending", "Created": fmtDate(b.createdAt),
    }));
    const messageRows = messages.map((m) => ({
      Name: m.name, Email: m.email, Phone: m.phone, Subject: m.subject, Message: m.message, Read: m.read ? "Yes" : "No", Created: fmtDate(m.createdAt),
    }));
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(bookingRows), "Bookings");
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(messageRows), "Messages");
    window.XLSX.writeFile(wb, `TBHK-All-Data-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  /* ---------------- Nav / misc ---------------- */
  function wireChrome() {
    $$(".admin-nav button[data-panel]").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$(".admin-nav button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        $$(".admin-view").forEach((v) => v.classList.add("d-none"));
        $("#view-" + btn.dataset.panel).classList.remove("d-none");
        $("#adminSidebar").classList.remove("open");
      });
    });
    $$("#statusTabs button").forEach((tab) => tab.addEventListener("click", () => {
      $$("#statusTabs button").forEach((t) => t.classList.toggle("active", t === tab));
      $("#bookingStatusFilter").value = tab.dataset.status; renderBookings();
    }));
    $("#bookingSearch")?.addEventListener("input", renderBookings);
    $("#bookingStatusFilter")?.addEventListener("change", renderBookings);
    $("#exportBookingsBtn")?.addEventListener("click", exportBookings);
    $("#exportMessagesBtn")?.addEventListener("click", exportMessages);
    $("#exportAllBtn")?.addEventListener("click", exportAll);
    $("#adminLogout")?.addEventListener("click", async () => {
      localStorage.removeItem("tbhk-session");
      try { if (window.tbhkFirebase?.auth) await window.tbhkFirebase.fns.signOut(window.tbhkFirebase.auth); } catch (e) {}
      window.location.href = window.tbhkFirebase?.auth ? "admin-login.html" : "home.html";
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    wireChrome();
    guard();
  });
})();
