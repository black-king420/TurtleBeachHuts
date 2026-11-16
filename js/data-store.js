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
    /** Bookings require a real account (guests must sign in or register first). */
    async addBooking(data) {
      await whenReady();
      const authErr = () => { const e = new Error("Please sign in or register to book."); e.code = "AUTH_REQUIRED"; return e; };
      if (isLive()) {
        const { auth, db, fns } = window.tbhkFirebase;
        const u = auth.currentUser;
        if (!u || u.isAnonymous) throw authErr();
        const payload = { ...data, status: "Pending", uid: u.uid, userEmail: u.email || "", userName: u.displayName || "" };
        const ref = await fns.addDoc(fns.collection(db, "bookings"), { ...payload, createdAt: fns.serverTimestamp() });
        return { id: ref.id, ...payload, createdAt: new Date().toISOString() };
      }
      const sess = (() => { try { return JSON.parse(localStorage.getItem("tbhk-session") || "null"); } catch (e) { return null; } })();
      if (!sess || sess.provider === "guest") throw authErr();
      const id = localId();
      const all = readLocal("tbhk-bookings");
      const record = { id, ...data, status: "Pending", uid: sess.uid, userEmail: sess.email || "", userName: sess.name || "", createdAt: new Date().toISOString() };
      all.unshift(record);
      writeLocal("tbhk-bookings", all);
      return record;
    },

    /** The signed-in member's own bookings (newest first). */
    async subscribeMyBookings(cb) {
      await whenReady();
      if (isLive()) {
        const { auth, db, fns } = window.tbhkFirebase;
        const u = auth.currentUser;
        if (!u || u.isAnonymous) { cb([]); return () => {}; }
        const q = fns.query(fns.collection(db, "bookings"), fns.where("uid", "==", u.uid));
        return fns.onSnapshot(q, (snap) => {
          const rows = snap.docs.map((d) => {
            const v = d.data();
            return { id: d.id, ...v, createdAt: v.createdAt && v.createdAt.toDate ? v.createdAt.toDate().toISOString() : v.createdAt };
          }).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
          cb(rows);
        }, () => cb([]));
      }
      const sess = (() => { try { return JSON.parse(localStorage.getItem("tbhk-session") || "null"); } catch (e) { return null; } })();
      const emit = () => cb(readLocal("tbhk-bookings").filter((b) => sess && b.uid && b.uid === sess.uid));
      emit();
      const handler = (e) => { if (e.detail.key === "tbhk-bookings") emit(); };
      window.addEventListener("tbhk-local-store-changed", handler);
      return () => window.removeEventListener("tbhk-local-store-changed", handler);
    },

    /** Registered accounts (admin only in live mode). */
    async subscribeUsers(cb) {
      await whenReady();
      if (isLive()) {
        const { db, fns } = window.tbhkFirebase;
        return fns.onSnapshot(fns.collection(db, "users"), (snap) => {
          cb(snap.docs.map((d) => {
            const v = d.data();
            const c = v.createdAt && v.createdAt.toDate ? v.createdAt.toDate().toISOString() : v.createdAt;
            return { id: d.id, ...v, createdAt: c };
          }));
        }, () => cb([]));
      }
      let map = {};
      try { map = JSON.parse(localStorage.getItem("tbhk-demo-users") || "{}"); } catch (e) {}
      cb(Object.keys(map).map((email) => ({ id: "demo-" + email, name: map[email].name, email, phone: map[email].phone || "", provider: "demo", role: "customer", createdAt: map[email].createdAt || "" })));
      return () => {};
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
