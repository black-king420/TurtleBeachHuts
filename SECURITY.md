# Security notes — Turtle Beach Huts Karachi

## Fixed in the code
| Area | What was wrong / added |
|---|---|
| **HTML injection (XSS)** | The toast notification inserted its text as raw HTML, and the admin's "New booking: <name>" alert fed it a guest-supplied name. Toasts now use text nodes only. Every other template escapes guest data (re-audited). |
| **Open redirect** | Login redirects accept only same-site `*.html` names (`TBHKSession.safeRedirect`), blocking `javascript:` / external links. |
| **Third-party scripts** | Bootstrap, Font Awesome, Swiper, AOS, Chart.js, SheetJS and FullCalendar are now self-hosted in `/vendor` — no CDN can inject code into your pages or the admin. Only Google Fonts, the Maps embed and Firebase's SDK are external. |
| **Booking / admin access** | Bookings need a real account; guests cannot book. Admin pages fail **closed** when Firebase can't load; admin auto-signs-out after 30 min idle; admin login slows down after 5 wrong attempts. |
| **Admin e-mail** | The public sign-up refuses the admin's address (use *Admin login → First-time setup*). |
| **Spam** | Contact, booking and newsletter forms have a hidden honeypot field + a cooldown; inputs have length limits matching the database rules. |
| **Demo mode** | Accounts created without Firebase keys store a salted SHA-256 hash, not the password (old plain-text demo records are upgraded on next login). |
| **Database rules** | `firebase/firestore.rules`: members-only bookings tied to the account, owner-only reads, public read / admin-only write for catalog/huts/gallery, field-size limits (now also on user profiles), default deny. |
| **Headers** | `firebase.json` adds HSTS, `nosniff`, frame protection, a strict Permissions-Policy, `Cross-Origin-Opener-Policy: same-origin-allow-popups` (needed for Google sign-in) and `no-store` on admin/auth pages. |

## Content-Security-Policy (report-only)
`firebase.json` ships a `Content-Security-Policy-Report-Only` header so nothing can break. After deploying, open the site, sign in
(Google + email), book and use the admin with the browser console open. If you see **no** "violates the following Content Security
Policy" messages, rename the header key to `Content-Security-Policy` to enforce it. (Pages still use inline scripts, hence `'unsafe-inline'`.)

## Things only YOU can do in the consoles (the code can't)
1. **Publish `firebase/firestore.rules`** (Firebase → Firestore → Rules → Publish) and run Admin → Settings → *Run permissions check*.
2. **Restrict the Firebase web API key**: Google Cloud Console → APIs & Services → Credentials → your Browser key → *Website restrictions* →
   add your real domain(s) (and `localhost` for testing). The key is public by design; this stops other sites from using your quota.
3. **Authentication → Settings**: keep *Authorized domains* to your own domain; turn on **Email enumeration protection**; disable sign-in
   methods you don't use; consider enabling multi-factor auth for the admin account (or protect the admin Google account with 2-Step Verification).
4. **Create the admin account right after deploying** (Admin login → First-time setup). Until it exists, nobody else should be able to take that
   address — and because no e-mail verification is required, do this first. Even safer: grant admin by user ID (`admins/{uid}` document) and remove the e-mail from the rules.
5. **Change the old admin password** that used to be written as a comment in `firebase-config.js` (it was removed from the file, but treat it as exposed).
6. **App Check** (Firebase → App Check → reCAPTCHA v3, then enforce for Firestore) is the proper defence against bots writing to your database. Not enabled by default.
7. Set a **budget alert** and enable **Firestore backups/exports** in Google Cloud.

## Known limits
- Form spam protection is client-side (honeypot/cooldown): it stops casual bots, not a determined script — use App Check for that.
- Pictures are stored inside database documents (data URLs), so keep them small; Firebase Storage would be better for many large photos.
- The availability calendar on the booking page uses fixed example dates until it is connected to real bookings.
