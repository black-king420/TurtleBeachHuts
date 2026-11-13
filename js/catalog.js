/* ==========================================================================
   Turtle Beach Huts Karachi — Catalog (huts / packages: name, price, picture)
   One source of truth used by the public pages AND the admin "Huts & Prices"
   manager. Storage: Firestore collection `catalog` when Firebase is
   configured, otherwise localStorage (demo mode, this device only).
   ========================================================================== */
(function () {
  'use strict';
  const LS_KEY = 'tbhk-catalog';
  const CACHE_KEY = 'tbhk-catalog-cache';

  const DEFAULTS = {
    settings: { fromPrice: 15000 },
    items: [
      { id: 'family', name: 'Family Package', price: 19000, priceNote: '', img: 'images/trutlebeach1.jpeg', tag: 'Popular', featured: true, home: true, desc: 'Full-day hut, BBQ setup, and beach games for up to 8 guests.' },
      { id: 'birthday', name: 'Birthday Package', price: 80000, priceNote: '', img: 'images/birthday 1.jfif', tag: 'Celebrate', featured: true, home: false, desc: 'Decor, cake table setup, and a dedicated photo corner.' },
      { id: 'corporate', name: 'Corporate Package', price: null, priceNote: 'Custom quote', img: 'images/corporate.jfif', tag: '', featured: false, home: false, desc: 'Multiple huts, catering coordination, shaded activity space.' },
      { id: 'bbq', name: 'BBQ Package', price: 22000, priceNote: '', img: 'images/BBQ.jfif', tag: 'Popular', featured: true, home: true, desc: 'Evening hut with grill station, bonfire, music-friendly deck.' },
      { id: 'photography', name: 'Photography Package', price: 20000, priceNote: '', img: 'images/sunset wwver 1.jfif', tag: '', featured: false, home: false, desc: 'Golden-hour access window plus reserved backdrop areas.' },
      { id: 'luxury', name: 'Luxury Package', price: 45000, priceNote: '', img: 'images/night lights.jfif', tag: 'Premium', featured: true, home: false, desc: 'Our top-tier hut with private chef option and premium furnishing.' },
      { id: 'weekend', name: 'Weekend Package', price: 55000, priceNote: '', img: 'images/Beach aesthetics.jfif', tag: '', featured: false, home: true, desc: 'Two-night stay across Friday–Sunday with all meals included.' },
      { id: 'holiday', name: 'Holiday Package', price: 65000, priceNote: '', img: 'images/drone view 1.jfif', tag: '', featured: false, home: false, desc: 'Extended multi-day stay for public holidays, priority booking.' },
      { id: 'custom', name: 'Custom Package', price: null, priceNote: "Let's talk", img: 'images/party.jfif', tag: '', featured: false, home: false, desc: "Tell us the occasion — we'll build a package around it." }
    ]
  };

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtNum = (n) => Number(n).toLocaleString('en-US');
  const fmtPrice = (it) => (it.price !== null && it.price !== '' && !isNaN(it.price) ? 'PKR ' + fmtNum(it.price) : (it.priceNote || 'Custom quote'));

  function whenReady() {
    return new Promise((resolve) => {
      if (window.__tbhkFirebaseReady) return resolve();
      window.addEventListener('tbhk-firebase-ready', () => resolve(), { once: true });
    });
  }
  const isLive = () => !!(window.tbhkFirebase && window.tbhkFirebase.db);

  function normalise(c) {
    const out = { settings: Object.assign({}, DEFAULTS.settings, (c && c.settings) || {}), items: [] };
    const items = c && Array.isArray(c.items) && c.items.length ? c.items : DEFAULTS.items;
    out.items = items.map((it, i) => ({
      id: it.id || 'item-' + Date.now().toString(36) + i,
      name: it.name || 'Untitled package',
      price: it.price === null || it.price === '' || it.price === undefined || isNaN(it.price) ? null : Number(it.price),
      priceNote: it.priceNote || '',
      img: it.img || 'images/logo.png',
      tag: it.tag || '',
      featured: !!it.featured,
      home: !!it.home,
      desc: it.desc || ''
    }));
    return out;
  }

  function readLocal() {
    try { const v = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if (v) return v; } catch (e) {}
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; }
  }

  let current = normalise(readLocal());
  const subs = new Set();
  let liveIds = [];
  let liveStarted = false;

  function emit() { subs.forEach((cb) => { try { cb(current); } catch (e) { console.error(e); } }); }

  function setCurrent(c, cache = true) {
    current = normalise(c);
    if (cache) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(current)); } catch (e) {} }
    emit();
  }

  async function startLive() {
    if (liveStarted) return;
    await whenReady();
    if (!isLive()) {
      window.addEventListener('storage', (e) => { if (e.key === LS_KEY) setCurrent(readLocal(), false); });
      window.addEventListener('tbhk-catalog-changed', () => setCurrent(readLocal(), false));
      return;
    }
    liveStarted = true;
    const { db, fns } = window.tbhkFirebase;
    fns.onSnapshot(fns.collection(db, 'catalog'), (snap) => {
      const items = [], settings = {};
      liveIds = [];
      snap.docs.forEach((d) => {
        if (d.id === '_settings') Object.assign(settings, d.data());
        else { items.push({ id: d.id, ...d.data() }); liveIds.push(d.id); }
      });
      items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      if (items.length) setCurrent({ settings, items });
    }, (err) => console.warn('Catalog listener:', err.message));
  }

  const Catalog = {
    DEFAULTS: clone(DEFAULTS),
    current: () => clone(current),
    fmtPrice,
    esc,
    subscribe(cb) { subs.add(cb); cb(current); startLive(); return () => subs.delete(cb); },

    async save(draft) {
      const c = normalise(draft);
      c.items.forEach((it, i) => { it.order = i; });
      await whenReady();
      if (isLive()) {
        const { db, fns } = window.tbhkFirebase;
        for (const it of c.items) await fns.setDoc(fns.doc(db, 'catalog', it.id), it);
        for (const id of liveIds) if (!c.items.some((it) => it.id === id)) await fns.deleteDoc(fns.doc(db, 'catalog', id));
        await fns.setDoc(fns.doc(db, 'catalog', '_settings'), c.settings);
        liveIds = c.items.map((it) => it.id);
        setCurrent(c);
        return { live: true };
      }
      localStorage.setItem(LS_KEY, JSON.stringify(c)); // throws on quota → caller shows error
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (e) {}
      window.dispatchEvent(new CustomEvent('tbhk-catalog-changed'));
      setCurrent(c, false);
      return { live: false };
    },

    async reset() {
      await whenReady();
      if (isLive()) {
        const { db, fns } = window.tbhkFirebase;
        for (const id of liveIds) await fns.deleteDoc(fns.doc(db, 'catalog', id));
        await fns.deleteDoc(fns.doc(db, 'catalog', '_settings')).catch(() => {});
        liveIds = [];
      }
      localStorage.removeItem(LS_KEY); localStorage.removeItem(CACHE_KEY);
      window.dispatchEvent(new CustomEvent('tbhk-catalog-changed'));
      setCurrent(DEFAULTS, false);
    },

    /** Resize + compress a picked file to a JPEG data URL (keeps storage small). */
    fileToDataURL(file, max = 1000, quality = 0.8) {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          const s = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          resolve(c.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image')); };
        img.src = url;
      });
    }
  };
  window.TBHKCatalog = Catalog;

  /* ------------------------------------------------------------------
     Public-page rendering (runs only where the target elements exist)
     ------------------------------------------------------------------ */
  const $ = (s) => document.querySelector(s);

  function cardHTML(p, delay) {
    return `
    <div class="col-md-6 col-lg-4" data-aos="fade-up" data-aos-delay="${delay}">
      <div class="card-tbhk h-100 position-relative">
        ${p.tag ? `<div class="ribbon">${esc(p.tag)}</div>` : ''}
        <div class="ratio ratio-4x3"><img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy" decoding="async" style="object-fit:cover;width:100%;height:100%;"></div>
        <div class="p-4">
          <h5>${esc(p.name)}</h5>
          <p style="font-size:.85rem;color:rgba(16,48,47,.7);">${esc(p.desc)}</p>
          <div class="d-flex justify-content-between align-items-center mt-3">
            <span class="badge-soft">${esc(fmtPrice(p))}</span>
            <a href="booking.html" class="btn-tbhk btn-sunset" style="padding:.5rem 1rem;">Book</a>
          </div>
        </div>
      </div>
    </div>`;
  }

  function offerHTML(p) {
    return `
      <div class="swiper-slide"><a class="offer-card" href="booking.html"><img src="${esc(p.img)}" alt="${esc(p.name)}">
        <div class="offer-body">${p.tag ? `<span class="offer-tag">${esc(p.tag)}</span>` : ''}<h3>${esc(p.name)}</h3><p>${esc(p.desc)}</p>
        <div class="offer-foot"><b>${esc(fmtPrice(p))}</b><span class="offer-cta">Book now <i class="fa-solid fa-arrow-right"></i></span></div></div></a></div>`;
  }

  let lastSig = '';
  function render(c) {
    const sig = JSON.stringify(c);
    if (sig === lastSig) return; lastSig = sig;
    let dirty = false;

    const grid = $('#packagesGrid');
    if (grid) { grid.innerHTML = c.items.map((p, i) => cardHTML(p, (i % 3) * 100)).join(''); dirty = true; }

    const homeGrid = $('#homePackages');
    if (homeGrid) {
      const list = c.items.filter((p) => p.home).slice(0, 6);
      if (list.length) { homeGrid.innerHTML = list.map((p, i) => cardHTML(p, i * 100).replace('col-md-6 col-lg-4', 'col-md-4')).join(''); dirty = true; }
    }

    const wrap = $('.offersSwiper .swiper-wrapper');
    if (wrap) {
      const list = c.items.filter((p) => p.featured);
      const section = $('.offers-section');
      if (section) section.style.display = list.length ? '' : 'none';
      wrap.innerHTML = list.map(offerHTML).join('');
      const el = $('.offersSwiper');
      if (window.Swiper && el) {
        if (el.swiper) el.swiper.destroy(true, true);
        new window.Swiper(el, {
          slidesPerView: 1.15, spaceBetween: 16, loop: list.length > 3, grabCursor: true,
          autoplay: { delay: 4200, disableOnInteraction: false, pauseOnMouseEnter: true },
          pagination: { el: '.offers-pagination', clickable: true },
          navigation: { nextEl: '.offers-next', prevEl: '.offers-prev' },
          breakpoints: { 640: { slidesPerView: 2.1 }, 992: { slidesPerView: 3.1, spaceBetween: 22 } }
        });
      }
    }

    document.querySelectorAll('select[data-catalog-select]').forEach((sel) => {
      const keep = sel.value;
      const limit = Number(sel.dataset.catalogSelect) || 0;
      const list = limit ? c.items.slice(0, limit) : c.items;
      sel.innerHTML = list.map((p) => `<option>${esc(p.name)}</option>`).join('');
      if (keep && list.some((p) => p.name === keep)) sel.value = keep;
    });

    document.querySelectorAll('[data-from-price]').forEach((el) => { el.textContent = 'From PKR ' + fmtNum(c.settings.fromPrice); });

    if (dirty && window.AOS) setTimeout(() => window.AOS.refreshHard && window.AOS.refreshHard(), 50);
  }

  function boot() { Catalog.subscribe(render); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
