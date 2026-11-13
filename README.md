# Turtle Beach Huts Karachi — Website

Luxury beach-hut rental marketing site, built around the TBHK logo (sunset orange, island teal, sun gold, warm sand). This build adds real Firebase Authentication + Firestore wiring, a modernized navbar/footer sitewide, and a full admin dashboard with Excel export.

## What's in this build

**Public site**
- `index.html` — splash screen, routes to `auth.html` (new visitor) or `home.html` (returning, signed-in visitor)
- `auth.html` — Sign in / Register / Forgot password, glassmorphism UI, password strength meter, show/hide password, Google / Facebook / Guest sign-in. Works in **demo mode** out of the box; switches to real Firebase the moment you add project keys (see below) — nothing else to change.
- `home.html` — hero, quick-booking bar, features, gallery preview, packages preview, testimonials, FAQ, newsletter
- `beach-hut.html` — specs, amenities, house rules, pricing
- `gallery.html` — filterable masonry gallery with lightbox
- `packages.html` — all 9 package cards
- `booking.html` — booking form + live calendar (FullCalendar), booked dates now sync in real time from Firestore (or localStorage in demo mode)
- `contact.html` — contact form that writes to Firestore `messages` (or localStorage in demo mode)
- `404.html` — not-found page

**Admin**
- `admin.html` — protected dashboard: live stats, bookings table (search/filter/status/delete), messages table, a bookings-by-package chart, and **Export to Excel** buttons (real `.xlsx`, generated client-side with SheetJS)

**Shared code**
- `css/style.css` — full design system: colors, type, buttons, cards, the modernized floating/glass navbar, and the modernized footer (used on every page)
- `css/auth.css`, `css/admin.css` — page-specific styling
- `js/main.js` — nav scroll state, theme toggle, counters, FAQ accordion, toast helper, and the **profile slot** (avatar + dropdown when signed in, "Sign in" link otherwise) rendered on every page
- `js/auth.js` — all sign-in/up/out flows, demo-mode fallback
- `js/data-store.js` — one small data layer used by the booking form, contact form and admin dashboard, so they don't need to know whether Firebase is configured or not
- `js/admin.js` — admin auth guard, tables, chart, Excel export
- `js/firebase-config.js` — Firebase v10 modular SDK setup (see "Going live" below)
- `robots.txt`, `sitemap.xml`, `manifest.json`

Open `index.html` in a browser (ideally via a local server — see "Running it locally" below) and the entire splash → auth → home flow works immediately with **no setup**, using a local demo session + localStorage. Bookings, messages, and newsletter sign-ups are stored locally too, so you can exercise the whole flow — including the admin dashboard — before connecting Firebase.

## Running it locally

Because `js/firebase-config.js` is loaded as an ES module, opening the file directly from disk (`file://…`) will get blocked by some browsers' module CORS rules. Serve the folder instead:

```bash
# any of these work
python3 -m http.server 8000
# or
npx serve .
```

Then open `http://localhost:8000/index.html`.

## Going live with real accounts (Firebase)

1. Create a project at https://console.firebase.google.com
2. Project settings → General → "Your apps" → add a Web app → copy the config object
3. Paste those values into the `firebaseConfig` object at the top of `js/firebase-config.js` (replacing the `REPLACE_ME` placeholders)
4. Authentication → Sign-in method → enable **Email/Password**, **Google**, **Facebook** (optional), and **Anonymous** (used for "Continue as Guest")
5. Firestore Database → Create database (production mode)
6. Paste the security rules from the comment block at the bottom of `js/firebase-config.js` into Firestore → Rules
7. Add your admin email(s) to `ADMIN_EMAILS` near the top of `js/firebase-config.js` — this is what unlocks `/admin.html`, and it's mirrored in the Firestore rules' `isAdmin()` check, so update both together
8. Reload the site — `auth.js`, `main.js`, `data-store.js` and `admin.js` all detect a live Firebase connection automatically and switch off demo mode. Nothing else needs to change.

### User details in Firestore

On registration (email/password, Google or Facebook), a document is written to `users/{uid}` with `name`, `email`, `role` and `provider`. Use this collection if you want to look up customer details beyond what's captured on a booking.

## Admin dashboard

Visit `/admin.html`. In demo mode it's open for preview (clearly labelled "Demo mode" in the sidebar). Once Firebase is live, only the emails listed in `ADMIN_EMAILS` can get in — everyone else is signed in but shown an "access restricted" screen, and signed-out visitors are sent to `auth.html`.

From the dashboard you can:
- See booking/message stats and a bookings-by-package chart
- Search and filter bookings, confirm/cancel/delete them
- Read and delete contact messages
- **Export to Excel** — per-table (respects your current search/filter) or "Export all" for a single workbook with both tables as separate sheets

## Wiring notes

- `booking.html`'s calendar shades any date with a non-cancelled booking, live, via `TBHKStore.subscribeBookings`.
- `contact.html` and the newsletter forms (home page hero CTA + every page's footer) write to Firestore `messages` / `newsletter` (or localStorage) the same way.
- The navbar's profile slot (`<span data-profile-slot></span>`) already exists on every page — `main.js` listens for Firebase auth state (or the demo session) and paints either a "Sign in" link or an avatar + dropdown (Bookings, Admin dashboard link for admins, Sign out).

## Assets

Image references use descriptive placeholder filenames (e.g. `images/gallery-sunset-palms.jpg`, `images/package-bbq.jpg`, `images/logo.png`) — drop your real photos into `/images` with matching names.

## Tech used

Bootstrap 5, vanilla ES6, Firebase v10 (modular client SDK, loaded from `gstatic.com` — no build step needed), Swiper, AOS, FullCalendar, Chart.js, SheetJS (xlsx), Font Awesome, Google Fonts (Fraunces + Manrope + IBM Plex Mono).
# TurtleBeachHutsKarachi
# TurtleBeachHutsKarachi
<<<<<<< HEAD


## Huts & Prices (admin-editable catalog)

Admin → **Huts & Prices** lets you change every package's name, price (or a "Custom quote" label), picture
(upload, or paste an image link), ribbon tag, description, order, and where it appears (Featured carousel /
Home packages row), plus the Beach Huts "starting price". Changes appear on Packages, Home, Beach Huts and the
booking dropdown. Data lives in Firestore collection `catalog` (or localStorage in demo mode).

Add this to your Firestore rules so visitors can read it and only admins can edit it:

```
match /catalog/{itemId} {
  allow read: if true;
  allow create, update, delete: if isAdmin();
}
```
=======
>>>>>>> ba316d946e45150633c566b0a636963ef6c6d9fa
