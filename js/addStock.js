import { db } from "./app.js";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

console.log("addStock.js loaded");

const form = document.getElementById("addStockForm");
const itemNameInput = document.getElementById("itemName");
const itemQtyInput = document.getElementById("itemQty");
const locationSelect = document.getElementById("locationSelect");
const addNewLocationBtn = document.getElementById("addNewLocationBtn");

const parInput = document.getElementById("parDefault");
const minInput = document.getElementById("minDefault");
const maxInput = document.getElementById("maxDefault");

/* -------------------------------
   LOAD ALL EXISTING LOCATIONS
---------------------------------*/
async function loadLocations() {
  const snap = await getDocs(collection(db, "inventory"));
  const locSet = new Set();

  snap.forEach(d => {
    const data = d.data();
    const locations = data.locations || {};
    Object.keys(locations).forEach(loc => locSet.add(loc));
  });

  locationSelect.innerHTML = `<option value="">Select an existing location</option>`;

  [...locSet].sort().forEach(loc => {
    const opt = document.createElement("option");
    opt.value = loc;
    opt.textContent = loc;
    locationSelect.appendChild(opt);
  });
}

loadLocations();

/* -------------------------------
   ADD NEW LOCATION OPTION
---------------------------------*/
addNewLocationBtn.addEventListener("click", () => {
  const name = prompt("Enter new location name:");
  if (!name) return;

  const option = document.createElement("option");
  option.value = name;
  option.textContent = name;
  option.selected = true;

  locationSelect.appendChild(option);
});

/* -------------------------------
   FORM SUBMIT: ADD / TOP-UP
---------------------------------*/
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = itemNameInput.value.trim();
  const qty = parseInt(itemQtyInput.value, 10);
  const loc = locationSelect.value;

  if (!name || !loc) {
    alert("Item name and location are required.");
    return;
  }

  let par = parseInt(parInput.value, 10);
  let min = parseInt(minInput.value, 10);
  let max = parseInt(maxInput.value, 10);

  if (isNaN(par)) par = qty;
  if (isNaN(min)) min = Math.floor(qty / 2);
  if (isNaN(max)) max = qty * 2 || 9999;

  // Find existing item
  const snap = await getDocs(collection(db, "inventory"));
  let existing = null;

  snap.forEach(d => {
    const data = d.data();
    if (data.displayName?.toLowerCase() === name.toLowerCase()) {
      existing = { id: d.id, ...data };
    }
  });

  if (!existing) {
    // NEW ITEM
    const newRef = doc(collection(db, "inventory"));

    await setDoc(newRef, {
      displayName: name,
      defaultPar: par,
      defaultMin: min,
      defaultMax: max,
      locations: {
        [loc]: { qty, par, min, max }
      }
    });

    await log("add-new-item", name, loc, qty, "Initial setup");
    alert("New item created.");
  } else {
    // EXISTING ITEM
    const itemRef = doc(db, "inventory", existing.id);
    const locations = existing.locations || {};
    const existingLoc = locations[loc];
    const currentQty = existingLoc?.qty || 0;

    // Option C3: Ask how to apply levels
    let choice = prompt(
      "Apply PAR/MIN/MAX?\n" +
      "1 = Apply to ALL locations\n" +
      "2 = Only THIS location\n" +
      "3 = DO NOT change existing levels"
    );

    if (!["1", "2", "3"].includes(choice)) choice = "3";

    const updates = {};

    if (choice === "1") {
      Object.keys(locations).forEach(L => {
        updates[`locations.${L}.par`] = par;
        updates[`locations.${L}.min`] = min;
        updates[`locations.${L}.max`] = max;
      });
      updates.defaultPar = par;
      updates.defaultMin = min;
      updates.defaultMax = max;
    }

    if (choice === "2") {
      updates[`locations.${loc}.par`] = par;
      updates[`locations.${loc}.min`] = min;
      updates[`locations.${loc}.max`] = max;

      updates.defaultPar = par;
      updates.defaultMin = min;
      updates.defaultMax = max;
    }

    if (choice === "3") {
      if (!existingLoc) {
        updates[`locations.${loc}.par`] = existing.defaultPar ?? par;
        updates[`locations.${loc}.min`] = existing.defaultMin ?? min;
        updates[`locations.${loc}.max`] = existing.defaultMax ?? max;
      }
    }

    // Add quantity
    updates[`locations.${loc}.qty`] = currentQty + qty;

    await updateDoc(itemRef, updates);
    await log("topup", existing.displayName, loc, qty, "Stock top-up");

    alert("Item updated.");
  }

  form.reset();
  loadLocations(); // Refresh location list
});

/* -------------------------------
   LOGGING
---------------------------------*/
async function log(type, item, loc, qty, reason) {
  await addDoc(collection(db, "inventoryLogs"), {
    type,
    item,
    location: loc,
    qty,
    reason,
    timestamp: serverTimestamp()
  });
}
