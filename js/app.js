// ======================================================
//  Firebase Initialization + Offline Persistence
// ======================================================

import { 
  initializeApp 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";

import { 
  getFirestore, 
  enableIndexedDbPersistence 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

import {
  getAuth,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// ------------------------------------------------------
//  1. Firebase Configuration (Production Config)
// ------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyAwyIghTzxPQ3veDYljtOYZg4b0EiJ5hr4",
  authDomain: "first-aid-app-8ae79.firebaseapp.com",
  projectId: "first-aid-app-8ae79",
  storageBucket: "first-aid-app-8ae79.appspot.com",
  messagingSenderId: "759107374304",
  appId: "1:759107374304:web:efb87e2c55a32e95129485"
};

// ------------------------------------------------------
//  2. Initialize Firebase
// ------------------------------------------------------
export const app = initializeApp(firebaseConfig);

// ------------------------------------------------------
//  3. Firestore Instance
// ------------------------------------------------------
export const db = getFirestore(app);

// ------------------------------------------------------
//  4. Firebase Auth (REQUIRED for Firestore Rules)
// ------------------------------------------------------
export const auth = getAuth(app);

// 🔐 Silent Anonymous Login
signInAnonymously(auth).catch(err => {
  console.warn("⚠️ Anonymous auth failed:", err);
});

// ------------------------------------------------------
//  5. Offline Persistence
// ------------------------------------------------------
enableIndexedDbPersistence(db).catch(err => {
  console.warn("⚠️ Firestore persistence failed:", err);
});

// ------------------------------------------------------
//  6. Debug Logging
// ------------------------------------------------------
console.log(
  "%c🔥 Firebase connected — Auth + DB ready",
  "color:#E63946; font-weight:700;"
);

