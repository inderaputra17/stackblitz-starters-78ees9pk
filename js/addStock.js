// ===============================================
// addStock.js
// Security-aligned, cleaned, same functionality
// ===============================================

import { db } from "./app.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

console.log("addStock.js loaded");


// ======================================================
// 1. SESSION + PERMISSION PRIMER (Required by Lock-In)
// ======================================================
const user = JSON.parse(sessionStorage.getItem("faUser")) || {};
const perms = user.permissions || {};


// ======================================================
// 2. DOM ELEMENTS
// ======================================================
const form = document.getElementById("addStockForm");

const itemSelect = document.getElementById("itemNameSelect");
const itemNameInput = document.getElementById("itemName");
const qtyInput = document.getElementById("itemQty");

const locationSelect = document.getElementById("locationSelect");
const addNewLocationBtn = document.getElementById("addNewLocationBtn");

const advToggle = document.getElementById("advToggle");
const advSection = document.getElementById("advSection");

const parInput = document.getElementById("parDefault");
const minInput = document.getElementById("minDefault");
const maxInput = document.getElementById("maxDefault");

let advancedOpen = false;


// ======================================================
// 3. ADVANCED SETTINGS TOGGLE
// ======================================================
advToggle.addEventListener("click", () => {
  advancedOpen = !advancedOpen;

  advSection.classList.toggle("hidden", !advancedOpen);
  advToggle.textContent = advancedOpen
    ? "Hide Advanced Settings ▲"
    : "Show Advanced Settings ▼";
});


// ======================================================
// 4. LOAD ITEMS
// ======================================================
async function loadItems() {
  const snap = await getDocs(collection(db, "inventory"));

  itemSelect.innerHTML = `<option value="">Select existing item</option>`;

  snap.forEach(docSnap => {
    const opt = document.createElement("option");
    opt.value = docSnap.id;
    opt.textContent = docSnap.data().displayName;
    itemSelect.appendChild(opt);
  });
}


// ======================================================
// 5. LOAD ALL UNIQUE LOCATIONS
// ======================================================
async function loadLocations() {
  const snap = await getDocs(collection(db, "inventory"));
  const locs = new Set();

  snap.forEach(docSnap => {
    const data = docSnap.data();
    const locationKeys = Object.keys(data.locations || {});
    locationKeys.forEach(loc => locs.add(loc));
  });

  locationSelect.innerHTML = `<option value="">Select location</option>`;

  [...locs].sort().forEach(loc => {
    const opt = document.createElement("option");
    opt.value = loc;
    opt.textContent = loc;
    locationSelect.appendChild(opt);
  });
}


// ======================================================
// 6. ADD NEW LOCATION (CLIENT-SIDE ONLY)
// ======================================================
addNewLocationBtn.addEventListener("click", () => {
  const name = prompt("Enter new location:");
  if (!name) return;

  const opt = document.createElement("option");
  opt.value = name;
  opt.textContent = name;
  opt.selected = true;
  locationSelect.appendChild(opt);
});


// ======================================================
// 7. SUBMIT FORM (CREATE OR UPDATE STOCK)
// ======================================================
form.addEventListener("submit", async e => {
  e.preventDefault();

  const existingId = itemSelect.value;
  const manualName = itemNameInput.value.trim();
  const qty = Number(qtyInput.value);
  const loc = locationSelect.value.trim();

  // Basic validations
  if (!qty || qty <= 0) return alert("Enter a valid quantity");
  if (!loc) return alert("Select a location");


  // ---------------------------
  // A. CREATE NEW ITEM
  // ---------------------------
  if (!existingId && manualName) {
    await setDoc(doc(collection(db, "inventory")), {
      displayName: manualName,
      locations: {
        [loc]: {
          qty,
          par: qty,
          min: Math.floor(qty / 2),
          max: qty * 2
        }
      }
    });

    alert("New item created.");
    form.reset();
    loadItems();
    loadLocations();
    return;
  }


  // ---------------------------
  // B. UPDATE EXISTING ITEM
  // ---------------------------
  const ref = doc(db, "inventory", existingId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    alert("Item not found.");
    return;
  }

  const data = snap.data();
  const currentQty = data.locations?.[loc]?.qty || 0;
  const newQty = currentQty + qty;

  await updateDoc(ref, {
    [`locations.${loc}.qty`]: newQty
  });

  alert("Stock updated.");
  form.reset();
  loadItems();
  loadLocations();
});


// ======================================================
// 8. INITIAL PAGE LOAD
// ======================================================
loadItems();
loadLocations();
