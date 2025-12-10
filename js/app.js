// ======================================================
//  Firebase Initialization + Offline Persistence
//  (Single Source of Truth for Firebase in the App)
// ======================================================

import { 
  initializeApp 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";

import { 
  getFirestore, 
  enableIndexedDbPersistence 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";


// ------------------------------------------------------
//  1. Firebase Configuration (Production Config)
// ------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyAwyIghTzxPQ3veDYljtOYZg4b0EiJ5hr4",
  authDomain: "first-aid-app-8ae79.firebaseapp.com",
  projectId: "first-aid-app-8ae79",
  storageBucket: "first-aid-app-8ae79.firebasestorage.app",
  messagingSenderId: "759107374304",
  appId: "1:759107374304:web:efb87e2c55a32e95129485"
};


// ------------------------------------------------------
//  2. Initialize Firebase (MANDATORY — Only Once)
// ------------------------------------------------------
export const app = initializeApp(firebaseConfig);


// ------------------------------------------------------
//  3. Firestore Instance (Global Database)
// ------------------------------------------------------
export const db = getFirestore(app);


// ------------------------------------------------------
//  4. Enable IndexedDB Offline Persistence
//     Required for:
//     - Offline login using cached staff
//     - Offline CRUD for inventory
// ------------------------------------------------------
enableIndexedDbPersistence(db).catch(err => {
  console.warn("⚠️ Firestore persistence failed:", err);
});


// ------------------------------------------------------
//  5. Debug Log (Consistent with Your App Logging Style)
// ------------------------------------------------------
console.log(
  "%c🔥 Firebase connected — app.js loaded with persistence enabled",
  "color:#E63946; font-weight:700;"
);
