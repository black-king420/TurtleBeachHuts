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
      // Zero-setup preview: let anyone in, clearly labelled as demo.
      revealDashboard({ name: "Demo Admin", email: "ali4@gmail.com" });
      return;
    }

    const { auth, fns } = window.tbhkFirebase;
    fns.onAuthStateChanged(auth, (user) => {
      const admins = window.tbhkFirebase.ADMIN_EMAILS || [];
      if (!user) {
        window.location.href = "auth.html?redirect=admin";
        return;
      }
      if (!admins.includes(user.email)) {
        showDenied(user.email);
        return;
      }
      revealDashboard({ name: user.displayName || user.email, email: user.email });
    });
  }

  function showDenied(email) {
    $("#adminGuardScreen").innerHTML = `
      <div>
        <i class="fa-solid fa-lock" style="font-size:2.4rem;color:var(--gold);"></i>
        <h2 class="mt-3" style="color:#fff;">Access restricted</h2>
        <p style="color:rgba(255,255,255,.75);max-width:420px;margin:.6rem auto 0;">
          ${email} isn't on the admin allow-list. Add it to <code>ADMIN_EMAILS</code> in
          <code>js/firebase-config.js</code> to grant dashboard access.
        </p>
        <a href="home.html" class="btn-tbhk btn-sunset mt-4">Back to site</a>
      </div>`;
    $("#adminGuardScreen").classList.remove("d-none");
    $("#adminApp").classList.add("d-none");
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
    window.TBHKStore.subscribeBookings((rows) => { bookings = rows; renderBookings(); renderStats(); renderChart(); });
    window.TBHKStore.subscribeMessages((rows) => { messages = rows; renderMessages(); renderStats(); });
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return iso;
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
      .reduce((sum, b) => sum + (PACKAGE_PRICE[b.package] || 0), 0);
    const unread = messages.filter((m) => !m.read).length;

    $("#statTotal").textContent = total;
    $("#statPending").textContent = pending;
    $("#statConfirmed").textContent = confirmed;
    $("#statCancelled").textContent = cancelled;
    $("#statRevenue").textContent = "PKR " + revenue.toLocaleString();
    $("#statMessages").textContent = messages.length;
    $("#statUnread").textContent = unread + " unread";
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
        const status = b.status || "Pending";
        const cls = status.toLowerCase();
        return `<tr>
          <td><strong>${b.name || "—"}</strong><div style="font-size:.72rem;color:var(--ink-faint);">${b.id}</div></td>
          <td>${b.phone || "—"}${b.whatsapp ? `<div style="font-size:.72rem;color:var(--ink-faint);">WA: ${b.whatsapp}</div>` : ""}</td>
          <td>${b.email || "—"}</td>
          <td>${b.package || "—"}</td>
          <td>${b.date || "—"}${b.time ? " · " + b.time : ""}</td>
          <td>${b.adults || 0} adults, ${b.children || 0} kids</td>
          <td><span class="status-pill ${cls}">${status}</span></td>
          <td>${fmtDate(b.createdAt)}</td>
          <td>
            <div class="row-actions">
              <button title="Confirm" data-action="confirm" data-id="${b.id}"><i class="fa-solid fa-check"></i></button>
              <button title="Cancel" data-action="cancel" data-id="${b.id}"><i class="fa-solid fa-ban"></i></button>
              <button title="Delete" class="del" data-action="delete" data-id="${b.id}"><i class="fa-solid fa-trash"></i></button>
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
          <td><strong>${m.name || "—"}</strong>${!m.read ? ' <span class="status-pill pending">New</span>' : ""}</td>
          <td>${m.email || "—"}</td>
          <td>${m.phone || "—"}</td>
          <td>${m.subject || "—"}</td>
          <td style="max-width:280px;white-space:normal;">${(m.message || "").slice(0, 140)}${(m.message || "").length > 140 ? "…" : ""}</td>
          <td>
            <div class="row-actions">
              <button title="Mark read" data-action="read" data-id="${m.id}"><i class="fa-solid fa-envelope-open"></i></button>
              <button title="Delete" class="del" data-action="delmsg" data-id="${m.id}"><i class="fa-solid fa-trash"></i></button>
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
  function renderChart() {
    const canvas = $("#packageChart");
    if (!canvas || !window.Chart) return;
    const counts = {};
    bookings.forEach((b) => { const p = b.package || "Other"; counts[p] = (counts[p] || 0) + 1; });
    const labels = Object.keys(counts);
    const data = Object.values(counts);
    if (chart) { chart.data.labels = labels; chart.data.datasets[0].data = data; chart.update(); return; }
    chart = new window.Chart(canvas, {
      type: "bar",
      data: { labels, datasets: [{ label: "Bookings", data, backgroundColor: "#E8722C", borderRadius: 8, maxBarThickness: 34 }] },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
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
    $("#sidebarToggle")?.addEventListener("click", () => $("#adminSidebar").classList.toggle("open"));
    $("#bookingSearch")?.addEventListener("input", renderBookings);
    $("#bookingStatusFilter")?.addEventListener("change", renderBookings);
    $("#exportBookingsBtn")?.addEventListener("click", exportBookings);
    $("#exportMessagesBtn")?.addEventListener("click", exportMessages);
    $("#exportAllBtn")?.addEventListener("click", exportAll);
    $("#adminLogout")?.addEventListener("click", async () => {
      localStorage.removeItem("tbhk-session");
      try { if (window.tbhkFirebase?.auth) await window.tbhkFirebase.fns.signOut(window.tbhkFirebase.auth); } catch (e) {}
      window.location.href = "auth.html";
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    wireChrome();
    guard();
  });
})();
