// ==============================
//  Firebase App Initialization
// ==============================

// Import Firebase core + Firestore
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Your Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyAwyIghTzxPQ3veDYljtOYZg4b0EiJ5hr4",
  authDomain: "first-aid-app-8ae79.firebaseapp.com",
  projectId: "first-aid-app-8ae79",
  storageBucket: "first-aid-app-8ae79.firebasestorage.app",
  messagingSenderId: "759107374304",
  appId: "1:759107374304:web:efb87e2c55a32e95129485"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore database instance
export const db = getFirestore(app);

// Debug confirmation
console.log("🔥 Firebase successfully connected (app.js loaded)");
