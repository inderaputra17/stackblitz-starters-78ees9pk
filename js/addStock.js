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

// DOM refs
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

let itemNameMap = {}; // id -> displayName

/* -------------------- Load existing items -------------------- */
async function loadItems() {
  const snap = await getDocs(collection(db, "inventory"));
  itemSelect.innerHTML = `<option value="">Select existing item</option>`;
  itemNameMap = {};

  snap.forEach((d) => {
    const data = d.data();
    itemNameMap[d.id] = data.displayName;
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = data.displayName;
    itemSelect.appendChild(opt);
  });
}

/* -------------------- Load locations -------------------- */
async function loadLocations() {
  const snap = await getDocs(collection(db, "inventory"));
  const locSet = new Set();

  snap.forEach((d) => {
    const data = d.data();
    const locations = data.locations || {};
    Object.keys(locations).forEach((loc) => locSet.add(loc));
  });

  locationSelect.innerHTML = `<option value="">Select location</option>`;
  [...locSet].sort().forEach((loc) => {
    const opt = document.createElement("option");
    opt.value = loc;
    opt.textContent = loc;
    locationSelect.appendChild(opt);
  });
}

/* -------------------- Advanced toggle -------------------- */
advToggle.addEventListener("click", () => {
  const open = advSection.style.display === "block";
  advSection.style.display = open ? "none" : "block";
  advToggle.textContent = open
    ? "Show Advanced Settings (PAR / MIN / MAX) ▼"
    : "Hide Advanced Settings (PAR / MIN / MAX) ▲";
});

/* -------------------- Add new location -------------------- */
addNewLocationBtn.addEventListener("click", () => {
  const name = prompt("Enter new location name:");
  if (!name) return;

  const opt = document.createElement("option");
  opt.value = name;
  opt.textContent = name;
  opt.selected = true;
  locationSelect.appendChild(opt);
});

/* -------------------- Form submit: add / top-up -------------------- */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const selectedItemId = itemSelect.value;
  const manualName = itemNameInput.value.trim();
  const qty = parseInt(qtyInput.value, 10);
  const loc = locationSelect.value;

  if (!qty || qty <= 0) {
    alert("Please enter a valid quantity.");
    return;
  }
  if (!loc) {
    alert("Please select a location.");
    return;
  }
  if (!selectedItemId && !manualName) {
    alert("Select an existing item OR enter a new item name.");
    return;
  }

  // Advanced values
  let par = parseInt(parInput.value, 10);
  let min = parseInt(minInput.value, 10);
  let max = parseInt(maxInput.value, 10);

  if (isNaN(par)) par = qty;
  if (isNaN(min)) min = Math.floor(qty / 2);
  if (isNaN(max)) max = qty * 2 || 9999;

  /* ------------ NEW ITEM ------------ */
  if (!selectedItemId && manualName) {
    const newRef = doc(collection(db, "inventory"));
    await setDoc(newRef, {
      displayName: manualName,
      defaultPar: par,
      defaultMin: min,
      defaultMax: max,
      locations: {
        [loc]: { qty, par, min, max }
      }
    });

    await logAction("add-new-item", manualName, loc, qty, "Initial setup");
    alert("New item created.");
    resetForm();
    await loadItems();
    await loadLocations();
    return;
  }

  /* ------------ EXISTING ITEM (TOP-UP) ------------ */
  if (selectedItemId) {
    const itemRef = doc(db, "inventory", selectedItemId);
    const snap = await getDoc(itemRef);
    if (!snap.exists()) {
      alert("Item not found in inventory.");
      return;
    }

    const data = snap.data();
    const itemName = data.displayName || itemNameMap[selectedItemId] || "Item";
    const locations = data.locations || {};
    const locData = locations[loc];
    const currentQty = locData?.qty || 0;

    const updates = {};

    if (!locData) {
      // New location for this item
      updates[`locations.${loc}`] = {
        qty: qty,
        par: advSection.style.display === "block" ? par : (data.defaultPar ?? par),
        min: advSection.style.display === "block" ? min : (data.defaultMin ?? min),
        max: advSection.style.display === "block" ? max : (data.defaultMax ?? max)
      };
    } else {
      // Existing location, just add qty
      updates[`locations.${loc}.qty`] = currentQty + qty;

      // If advanced open, update thresholds too
      if (advSection.style.display === "block") {
        updates[`locations.${loc}.par`] = par;
        updates[`locations.${loc}.min`] = min;
        updates[`locations.${loc}.max`] = max;
        updates.defaultPar = par;
        updates.defaultMin = min;
        updates.defaultMax = max;
      }
    }

    await updateDoc(itemRef, updates);
    await logAction("topup", itemName, loc, qty, "Stock top-up");

    alert("Item updated.");
    resetForm();
    await loadLocations();
    return;
  }
});

/* -------------------- Logging -------------------- */
async function logAction(type, item, location, qty, reason) {
  await addDoc(collection(db, "inventoryLogs"), {
    type,
    item,
    location,
    qty,
    reason,
    timestamp: serverTimestamp()
  });
}

/* -------------------- Reset form -------------------- */
function resetForm() {
  form.reset();
  advSection.style.display = "none";
  advToggle.textContent = "Show Advanced Settings (PAR / MIN / MAX) ▼";
}

/* -------------------- Initial load -------------------- */
loadItems();
loadLocations();
