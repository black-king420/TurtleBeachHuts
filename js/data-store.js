/* ==========================================================================
   Turtle Beach Huts Karachi — Data store
   Small abstraction so forms/admin work identically whether Firebase is
   configured (live Firestore) or not (localStorage demo mode).
   ========================================================================== */
(function () {
  function whenReady() {
    return new Promise((resolve) => {
      if (window.__tbhkFirebaseReady) return resolve();
      window.addEventListener("tbhk-firebase-ready", () => resolve(), { once: true });
    });
  }

  function isLive() {
    return !!(window.tbhkFirebase && window.tbhkFirebase.db);
  }

  function readLocal(key) {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); }
    catch (e) { return []; }
  }
  function writeLocal(key, arr) {
    localStorage.setItem(key, JSON.stringify(arr));
    window.dispatchEvent(new CustomEvent("tbhk-local-store-changed", { detail: { key } }));
  }
  function localId() {
    return "TBHK-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  const Store = {
    async addBooking(data) {
      await whenReady();
      const payload = { ...data, status: data.status || "Pending", createdAt: new Date().toISOString() };
      if (isLive()) {
        const { db, fns } = window.tbhkFirebase;
        const ref = await fns.addDoc(fns.collection(db, "bookings"), { ...payload, createdAt: fns.serverTimestamp() });
        return { id: ref.id, ...payload };
      }
      const id = localId();
      const all = readLocal("tbhk-bookings");
      const record = { id, ...payload };
      all.unshift(record);
      writeLocal("tbhk-bookings", all);
      return record;
    },

    async addMessage(data) {
      await whenReady();
      const payload = { ...data, read: false, createdAt: new Date().toISOString() };
      if (isLive()) {
        const { db, fns } = window.tbhkFirebase;
        const ref = await fns.addDoc(fns.collection(db, "messages"), { ...payload, createdAt: fns.serverTimestamp() });
        return { id: ref.id, ...payload };
      }
      const id = localId();
      const all = readLocal("tbhk-messages");
      const record = { id, ...payload };
      all.unshift(record);
      writeLocal("tbhk-messages", all);
      return record;
    },

    async addNewsletter(email) {
      await whenReady();
      const payload = { email, createdAt: new Date().toISOString() };
      if (isLive()) {
        const { db, fns } = window.tbhkFirebase;
        await fns.addDoc(fns.collection(db, "newsletter"), { ...payload, createdAt: fns.serverTimestamp() });
        return;
      }
      const all = readLocal("tbhk-newsletter");
      all.unshift(payload);
      writeLocal("tbhk-newsletter", all);
    },

    // cb receives an array of bookings, called immediately and whenever data changes
    async subscribeBookings(cb) {
      await whenReady();
      if (isLive()) {
        const { db, fns } = window.tbhkFirebase;
        const q = fns.query(fns.collection(db, "bookings"), fns.orderBy("createdAt", "desc"));
        return fns.onSnapshot(q, (snap) => {
          const rows = snap.docs.map((d) => {
            const v = d.data();
            return { id: d.id, ...v, createdAt: v.createdAt && v.createdAt.toDate ? v.createdAt.toDate().toISOString() : v.createdAt };
          });
          cb(rows);
        });
      }
      const emit = () => cb(readLocal("tbhk-bookings"));
      emit();
      const handler = (e) => { if (e.detail.key === "tbhk-bookings") emit(); };
      window.addEventListener("tbhk-local-store-changed", handler);
      return () => window.removeEventListener("tbhk-local-store-changed", handler);
    },

    async subscribeMessages(cb) {
      await whenReady();
      if (isLive()) {
        const { db, fns } = window.tbhkFirebase;
        const q = fns.query(fns.collection(db, "messages"), fns.orderBy("createdAt", "desc"));
        return fns.onSnapshot(q, (snap) => {
          const rows = snap.docs.map((d) => {
            const v = d.data();
            return { id: d.id, ...v, createdAt: v.createdAt && v.createdAt.toDate ? v.createdAt.toDate().toISOString() : v.createdAt };
          });
          cb(rows);
        });
      }
      const emit = () => cb(readLocal("tbhk-messages"));
      emit();
      const handler = (e) => { if (e.detail.key === "tbhk-messages") emit(); };
      window.addEventListener("tbhk-local-store-changed", handler);
      return () => window.removeEventListener("tbhk-local-store-changed", handler);
    },

    async updateBookingStatus(id, status) {
      await whenReady();
      if (isLive()) {
        const { db, fns } = window.tbhkFirebase;
        await fns.updateDoc(fns.doc(db, "bookings", id), { status });
        return;
      }
      const all = readLocal("tbhk-bookings").map((b) => (b.id === id ? { ...b, status } : b));
      writeLocal("tbhk-bookings", all);
    },

    async deleteBooking(id) {
      await whenReady();
      if (isLive()) {
        const { db, fns } = window.tbhkFirebase;
        await fns.deleteDoc(fns.doc(db, "bookings", id));
        return;
      }
      writeLocal("tbhk-bookings", readLocal("tbhk-bookings").filter((b) => b.id !== id));
    },

    async deleteMessage(id) {
      await whenReady();
      if (isLive()) {
        const { db, fns } = window.tbhkFirebase;
        await fns.deleteDoc(fns.doc(db, "messages", id));
        return;
      }
      writeLocal("tbhk-messages", readLocal("tbhk-messages").filter((m) => m.id !== id));
    },

    async markMessageRead(id, read = true) {
      await whenReady();
      if (isLive()) {
        const { db, fns } = window.tbhkFirebase;
        await fns.updateDoc(fns.doc(db, "messages", id), { read });
        return;
      }
      writeLocal("tbhk-messages", readLocal("tbhk-messages").map((m) => (m.id === id ? { ...m, read } : m)));
    },
  };

  window.TBHKStore = Store;
})();
