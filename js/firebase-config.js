/* ==========================================================================
   Turtle Beach Huts Karachi — Firebase configuration
   ==========================================================================
   HOW TO GO LIVE
   1. Create a project at https://console.firebase.google.com
   2. Project settings → General → "Your apps" → Web app → copy the config
      object it gives you and paste the values below, replacing the
      "REPLACE_ME" placeholders.
   3. Authentication → Sign-in method → enable Email/Password, Google,
      Facebook (optional) and Anonymous (used for "Continue as Guest").
   4. Firestore Database → Create database (production mode) → set the
      rules shown at the bottom of this file (Firestore console → Rules).
   5. Add the email address(es) that should have access to /admin.html to
      the ADMIN_EMAILS list below.
   6. Reload the site. Every page already includes this file as a module
      script — once the keys above are valid, auth.js / main.js / admin.js
      automatically switch from demo (localStorage) mode to live Firebase.
      Nothing else needs to change.

   Until you add real keys, the site keeps working exactly as before using
   a local demo session + localStorage, so it's safe to hand over / preview
   without any setup.
   ========================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyC97NPMhvxvv-r72mMb3UhUK8z_V0sifos",
  authDomain: "login-and-signup-75bec.firebaseapp.com",
  projectId: "login-and-signup-75bec",
  storageBucket: "login-and-signup-75bec.firebasestorage.app",
  messagingSenderId: "95417279013",
  appId: "1:95417279013:web:5a443a9bb5374053a915cc"
};

// Emails allowed into /admin.html. Add the accounts your team signs in
// with. (For stronger security, switch this to a Firestore-based
// `users/{uid}.role == "admin"` check — see README "Admin access".)
export const ADMIN_EMAILS = [
  "ali4@gmail.com"
  // pasword Hello123@ 
];

window.__tbhkFirebaseReady = false;
window.tbhkFirebase = null;

async function boot() {
  const isConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "REPLACE_ME";
  if (!isConfigured) {
    console.info("[TBHK] Firebase not configured yet — running in demo mode (localStorage). See js/firebase-config.js.");
    window.__tbhkFirebaseReady = true;
    window.dispatchEvent(new CustomEvent("tbhk-firebase-ready", { detail: { live: false } }));
    return;
  }

  try {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
    const {
      getAuth, GoogleAuthProvider, FacebookAuthProvider,
      signInWithEmailAndPassword, createUserWithEmailAndPassword,
      signInWithPopup, signInAnonymously, sendPasswordResetEmail,
      onAuthStateChanged, signOut, updateProfile, sendEmailVerification
    } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
    const {
      getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc,
      collection, addDoc, onSnapshot, query, orderBy, serverTimestamp
    } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const googleProvider = new GoogleAuthProvider();
    const facebookProvider = new FacebookAuthProvider();

    window.tbhkFirebase = {
      app, auth, db,
      googleProvider, facebookProvider,
      fns: {
        signInWithEmailAndPassword, createUserWithEmailAndPassword,
        signInWithPopup, signInAnonymously, sendPasswordResetEmail,
        onAuthStateChanged, signOut, updateProfile, sendEmailVerification,
        doc, setDoc, getDoc, updateDoc, deleteDoc,
        collection, addDoc, onSnapshot, query, orderBy, serverTimestamp
      },
      ADMIN_EMAILS
    };
    window.__tbhkFirebaseReady = true;
    window.dispatchEvent(new CustomEvent("tbhk-firebase-ready", { detail: { live: true } }));
    console.info("[TBHK] Firebase connected.");
  } catch (err) {
    console.warn("[TBHK] Firebase failed to initialize — falling back to demo mode.", err);
    window.tbhkFirebase = null;
    window.__tbhkFirebaseReady = true;
    window.dispatchEvent(new CustomEvent("tbhk-firebase-ready", { detail: { live: false } }));
  }
}

boot();

//  ==========================================================================
//    FIRESTORE SECURITY RULES — paste into Firebase console → Firestore → Rules
//    ==========================================================================

// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {

//     function isSignedIn() { return request.auth != null; }
//     function isOwner(uid) { return isSignedIn() && request.auth.uid == uid; }
//     function isAdmin() {
//       return isSignedIn() &&
//         request.auth.token.email in [
//           "admin@turtlebeachhutskarachi.com"
//         ];
//     }

//     match /users/{uid} {
//       allow read: if isOwner(uid) || isAdmin();
//       allow create: if isOwner(uid);
//       allow update: if isOwner(uid) || isAdmin();
//       allow delete: if isAdmin();
//     }

//     match /bookings/{bookingId} {
//       allow create: if true; // public booking form, incl. guests
//       allow read, update, delete: if isAdmin();
//     }

//     match /messages/{messageId} {
//       allow create: if true; // public contact form
//       allow read, update, delete: if isAdmin();
//     }

//     match /newsletter/{entryId} {
//       allow create: if true;
//       allow read, update, delete: if isAdmin();
//     }
<<<<<<< HEAD

//     // Huts & Prices catalog: everyone can read, only admins can edit
//     match /catalog/{itemId} {
//       allow read: if true;
//       allow create, update, delete: if isAdmin();
//     }
=======
>>>>>>> ba316d946e45150633c566b0a636963ef6c6d9fa
//   }
// }

  //  ========================================================================== 
