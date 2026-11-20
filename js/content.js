/* ==========================================================================
   TBHK Content — admin-editable collections shown on the public website
     • huts     (Beach Huts page)   • gallery  (Gallery page)
   The ORIGINAL huts and photos are built in as defaults and always remain
   unless an admin deliberately removes them; admin additions are added next
   to them. Storage: Firestore collection <name> (live) or localStorage (demo).
   ========================================================================== */
(function () {
  'use strict';
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function whenReady() {
    return new Promise((resolve) => {
      if (window.__tbhkFirebaseReady) return resolve();
      window.addEventListener('tbhk-firebase-ready', () => resolve(), { once: true });
    });
  }
  const isLive = () => !!(window.tbhkFirebase && window.tbhkFirebase.db);

  function make(name, defaults, normalise) {
    const LS = 'tbhk-' + name, CACHE = 'tbhk-' + name + '-cache';
    const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
    const norm = (items) => (Array.isArray(items) && items.length ? items : defaults).map((it, i) => normalise(it, i));

    let current = norm(read(LS) || read(CACHE));
    const subs = new Set();
    let liveIds = [], started = false;
    const emit = () => subs.forEach((cb) => { try { cb(clone(current)); } catch (e) { console.error(e); } });
    function set(items, cache = true) {
      current = norm(items);
      if (cache) { try { localStorage.setItem(CACHE, JSON.stringify(current)); } catch (e) {} }
      emit();
    }

    async function start() {
      if (started) return; started = true;
      await whenReady();
      if (!isLive()) {
        const reload = () => set(read(LS), false);
        window.addEventListener('storage', (e) => e.key === LS && reload());
        window.addEventListener('tbhk-' + name + '-changed', reload);
        return;
      }
      const { db, fns } = window.tbhkFirebase;
      fns.onSnapshot(fns.collection(db, name), (snap) => {
        liveIds = snap.docs.map((d) => d.id);
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        // Until an admin has saved something, the built-in defaults stay visible (old huts / photos never vanish)
        if (items.length) set(items);
      }, (err) => console.warn(name + ' listener:', err.message));
    }

    return {
      DEFAULTS: clone(defaults),
      current: () => clone(current),
      subscribe(cb) { subs.add(cb); cb(clone(current)); start(); return () => subs.delete(cb); },
      async save(items) {
        const list = norm(items).map((it, i) => ({ ...it, order: i }));
        await whenReady();
        if (isLive()) {
          const { db, fns } = window.tbhkFirebase;
          for (const it of list) await fns.setDoc(fns.doc(db, name, it.id), it);
          for (const id of liveIds) if (!list.some((it) => it.id === id)) await fns.deleteDoc(fns.doc(db, name, id));
          liveIds = list.map((it) => it.id);
          set(list);
          return { live: true };
        }
        localStorage.setItem(LS, JSON.stringify(list)); // may throw on quota → caller reports
        try { localStorage.setItem(CACHE, JSON.stringify(list)); } catch (e) {}
        window.dispatchEvent(new CustomEvent('tbhk-' + name + '-changed'));
        set(list, false);
        return { live: false };
      },
      async reset() {
        await whenReady();
        if (isLive()) {
          const { db, fns } = window.tbhkFirebase;
          for (const id of liveIds) await fns.deleteDoc(fns.doc(db, name, id));
          liveIds = [];
        }
        localStorage.removeItem(LS); localStorage.removeItem(CACHE);
        window.dispatchEvent(new CustomEvent('tbhk-' + name + '-changed'));
        set(defaults, false);
      }
    };
  }

  /* ----------------------------- HUTS ----------------------------- */
  const HUT_DEFAULTS = [{
    id: 'classic', name: 'Classic Beach Hut', tag: 'Signature',
    desc: 'Our original two-room beach hut — private deck, full kitchen and BBQ area, steps from the water.',
    capacity: 12, rooms: 2, washrooms: 2, price: 15000,
    amenities: 'Private deck, Kitchen, BBQ area, Generator backup, 24/7 security, On-site parking',
    images: ['images/trutlebeach1.jpeg', 'images/trutle beach 2.jpeg', 'images/trutle beach 3.jpeg'], visible: true
  }, {
    // New huts — worded only from details already on this site (package descriptions + site-wide amenities).
    // No price/room counts are invented: add them from Admin → Huts when you're ready.
    id: 'family-hut', name: 'Family Hut', tag: 'Popular',
    desc: 'A full-day family hut with a BBQ setup and beach games — comfortable for up to 8 guests.',
    capacity: 8, rooms: 0, washrooms: 0, price: null,
    amenities: 'BBQ setup, Beach games, Private washrooms, Generator backup, 24/7 security',
    images: ['images/family.jfif', 'images/family 2.jfif'], visible: true
  }, {
    id: 'bbq-deck-hut', name: 'BBQ Deck Hut', tag: 'Evenings',
    desc: 'An evening hut built around the grill station and bonfire, with a music-friendly deck.',
    capacity: 0, rooms: 0, washrooms: 0, price: null,
    amenities: 'Grill station, Bonfire, Music-friendly deck, Private washrooms, Generator backup',
    images: ['images/BBQ.jfif', 'images/night.jfif'], visible: true
  }, {
    id: 'luxury-hut', name: 'Luxury Hut', tag: 'Premium',
    desc: 'Our top-tier hut with premium furnishing and a private chef option.',
    capacity: 0, rooms: 0, washrooms: 0, price: null,
    amenities: 'Premium furnishing, Private chef option, Private washrooms, Generator backup, 24/7 security',
    images: ['images/night lights.jfif'], visible: true
  }];
  const huts = make('huts', HUT_DEFAULTS, (h, i) => ({
    id: h.id || 'hut-' + Date.now().toString(36) + i,
    name: h.name || 'New hut', tag: h.tag || '', desc: h.desc || '',
    capacity: Number(h.capacity) || 0, rooms: Number(h.rooms) || 0, washrooms: Number(h.washrooms) || 0,
    price: h.price === null || h.price === '' || h.price === undefined || isNaN(h.price) ? null : Number(h.price),
    amenities: h.amenities || '',
    images: (Array.isArray(h.images) ? h.images : h.img ? [h.img] : []).filter(Boolean).slice(0, 6),
    visible: h.visible !== false
  }));

  /* --------------------------- GALLERY ---------------------------- */
  const GAL_CATS = { drone: 'Drone', sunset: 'Sunset', events: 'Events', night: 'Night', palms: 'Palm Trees' };
  const GAL_DEFAULTS = [
    ['g1', 'images/Beach aesthetics.jfif', 'drone', 'Drone view of coastline'], ['g2', 'images/palm 2.jfif', 'sunset', 'Sunset behind palm trees'],
    ['g3', 'images/family.jfif', 'events', 'Family event'], ['g4', 'images/night.jfif', 'night', 'Night BBQ'],
    ['g5', 'images/palm walkway.jfif', 'palms', 'Palm walkway'], ['g6', 'images/drone view 1.jfif', 'drone', 'Drone view of huts'],
    ['g7', 'images/sunset wwver 1.jfif', 'sunset', 'Sunset over jetty'], ['g8', 'images/birthday 1.jfif', 'events', 'Birthday setup'],
    ['g9', 'images/night lights.jfif', 'night', 'Night lights on deck'], ['g10', 'images/party.jfif', 'palms', 'Palm silhouette']
  ].map(([id, img, cat, caption]) => ({ id, img, cat, caption }));
  const gallery = make('gallery', GAL_DEFAULTS, (g, i) => ({
    id: g.id || 'pic-' + Date.now().toString(36) + i,
    img: g.img || 'images/logo.png',
    cat: GAL_CATS[g.cat] ? g.cat : 'events',
    caption: g.caption || ''
  }));

  /** Resize + compress a picked file to a JPEG data URL (keeps Firestore documents small). */
  function fileToDataURL(file, max = 1100, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
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

  window.TBHKContent = { huts, gallery, GAL_CATS, fileToDataURL, esc };

  /* ----------------------- public-page rendering ------------------- */
  const fmtNum = (n) => Number(n).toLocaleString('en-US');
  function hutCard(h, i) {
    const chips = h.amenities.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 8).map((a) => `<span class="hut-chip">${esc(a)}</span>`).join('');
    const imgs = h.images.length ? h.images : ['images/logo.png'];
    const thumbs = imgs.length > 1 ? `<div class="hut-thumbs">${imgs.slice(0, 5).map((u, k) => `<button type="button" class="${k ? '' : 'on'}" data-hut-img="${esc(u)}" aria-label="Photo ${k + 1}"><img src="${esc(u)}" alt="" loading="lazy"></button>`).join('')}</div>` : '';
    return `
    <div class="col-md-6 col-xl-4" data-aos="fade-up" data-aos-delay="${(i % 3) * 100}">
      <article class="card-tbhk hut-card h-100">
        ${h.tag ? `<div class="ribbon">${esc(h.tag)}</div>` : ''}
        <div class="hut-photo ratio ratio-4x3"><img src="${esc(imgs[0])}" alt="${esc(h.name)}" loading="lazy" decoding="async"></div>
        ${thumbs}
        <div class="p-4">
          <h4 class="mb-1">${esc(h.name)}</h4>
          <p class="hut-desc">${esc(h.desc)}</p>
          <div class="hut-specs">
            ${h.capacity ? `<span><i class="fa-solid fa-users"></i> Up to ${h.capacity}</span>` : ''}
            ${h.rooms ? `<span><i class="fa-solid fa-bed"></i> ${h.rooms} room${h.rooms > 1 ? 's' : ''}</span>` : ''}
            ${h.washrooms ? `<span><i class="fa-solid fa-shower"></i> ${h.washrooms} washroom${h.washrooms > 1 ? 's' : ''}</span>` : ''}
          </div>
          ${chips ? `<div class="hut-chips">${chips}</div>` : ''}
          <div class="d-flex justify-content-between align-items-center mt-3 gap-2">
            <div class="hut-price">${h.price !== null ? `<b>PKR ${fmtNum(h.price)}</b><small> / day</small>` : '<b>Ask for price</b>'}</div>
            <a href="booking.html?hut=${encodeURIComponent(h.name)}" class="btn-tbhk btn-sunset" style="padding:.5rem 1.1rem;">Book this hut</a>
          </div>
        </div>
      </article>
    </div>`;
  }

  let sigH = '', sigG = '';
  function renderHuts(list) {
    const grid = document.getElementById('hutsGrid'); if (!grid) return;
    const vis = list.filter((h) => h.visible);
    const sig = JSON.stringify(vis); if (sig === sigH) return; sigH = sig;
    grid.innerHTML = vis.map(hutCard).join('');
    if (window.AOS) setTimeout(() => window.AOS.refreshHard && window.AOS.refreshHard(), 50);
  }
  function renderGallery(list) {
    const grid = document.getElementById('masonryGrid'); if (!grid) return;
    const sig = JSON.stringify(list); if (sig === sigG) return; sigG = sig;
    grid.innerHTML = list.map((g) => `<div class="item" data-cat="${esc(g.cat)}"><img src="${esc(g.img)}" alt="${esc(g.caption || 'Gallery photo')}" loading="lazy" decoding="async"></div>`).join('');
    const active = document.querySelector('#filterBar .filter-btn.active');
    if (active && active.dataset.filter !== 'all') grid.querySelectorAll('.item').forEach((it) => { it.style.display = it.dataset.cat === active.dataset.filter ? '' : 'none'; });
  }
  const UPDATES_MAX = 8;
  let sigU = '';
  function renderUpdates(list) {
    const wrap = document.getElementById('updatesWrapper'); if (!wrap) return;
    const pics = list.slice(0, UPDATES_MAX);                 // newest first (new uploads are added to the front)
    const sig = JSON.stringify(pics); if (sig === sigU) return; sigU = sig;
    const section = document.getElementById('updatesSection');
    if (section) section.style.display = pics.length ? '' : 'none';
    wrap.innerHTML = pics.map((g, i) => `
      <div class="swiper-slide"><a class="upd-card" href="gallery.html" aria-label="${esc(g.caption || 'Open gallery')}">
        <img src="${esc(g.img)}" alt="${esc(g.caption || 'Beach photo')}" ${i < 2 ? '' : 'loading="lazy"'} decoding="async">
        <span class="upd-cat">${esc(GAL_CATS[g.cat] || '')}</span>
        ${i < 3 ? '<span class="upd-new">New</span>' : ''}
        <div class="upd-cap"><b>${esc(g.caption || GAL_CATS[g.cat] || 'Turtle Beach Huts')}</b><span>View in gallery <i class="fa-solid fa-arrow-right"></i></span></div>
      </a></div>`).join('');
    const el = document.querySelector('.updatesSwiper');
    if (window.Swiper && el) {
      if (el.swiper) el.swiper.destroy(true, true);
      new window.Swiper(el, {
        centeredSlides: true, slidesPerView: 1.15, spaceBetween: 14, loop: pics.length >= 5, grabCursor: true, speed: 650,
        autoplay: { delay: 3800, disableOnInteraction: false, pauseOnMouseEnter: true },
        pagination: { el: '.upd-pagination', clickable: true },
        navigation: { nextEl: '.upd-next', prevEl: '.upd-prev' },
        breakpoints: { 700: { slidesPerView: 1.7, spaceBetween: 18 }, 1100: { slidesPerView: 2.3, spaceBetween: 22 } }
      });
    }
  }
  document.addEventListener('click', (e) => {            // hut photo thumbnails
    const b = e.target.closest('[data-hut-img]'); if (!b) return;
    const card = b.closest('.hut-card'); card.querySelector('.hut-photo img').src = b.dataset.hutImg;
    card.querySelectorAll('.hut-thumbs button').forEach((x) => x.classList.toggle('on', x === b));
  });
  function boot() {
    if (document.getElementById('hutsGrid')) huts.subscribe(renderHuts);
    if (document.getElementById('masonryGrid')) gallery.subscribe(renderGallery);
    if (document.getElementById('updatesWrapper')) gallery.subscribe(renderUpdates);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
