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

const itemSelect = document.getElementById("itemSelect");
const existingItemsGroup = document.getElementById("existingItems");

const itemUnit = document.getElementById("itemUnit");
const itemSize = document.getElementById("itemSize");
const itemQty = document.getElementById("itemQty");

const locationSelect = document.getElementById("locationSelect");
const addNewLocationBtn = document.getElementById("addNewLocationBtn");

const parInput = document.getElementById("parDefault");
const minInput = document.getElementById("minDefault");
const maxInput = document.getElementById("maxDefault");

/* MODAL */
const newItemModal = document.getElementById("newItemModal");
const newItemName = document.getElementById("newItemName");
const newItemUnit = document.getElementById("newItemUnit");
const newItemSize = document.getElementById("newItemSize");
const saveNewItem = document.getElementById("saveNewItem");
const closeNewItem = document.getElementById("closeNewItem");

/* Load existing items */
async function loadExistingItems() {
  const snap = await getDocs(collection(db, "inventory"));
  existingItemsGroup.innerHTML = "";

  snap.forEach(d => {
    const data = d.data();
    const opt = document.createElement("option");
    opt.value = data.displayName;
    opt.textContent = data.displayName;
    opt.dataset.unit = data.unit || "";
    opt.dataset.size = data.size || "";
    existingItemsGroup.appendChild(opt);
  });
}
loadExistingItems();

/* Load existing locations */
async function loadLocations() {
  const snap = await getDocs(collection(db, "inventory"));
  const locSet = new Set();

  snap.forEach(d => {
    const locs = d.data().locations || {};
    Object.keys(locs).forEach(l => locSet.add(l));
  });

  locationSelect.innerHTML = `<option value="">Select a location</option>`;
  [...locSet].sort().forEach(l => {
    const o = document.createElement("option");
    o.value = l;
    o.textContent = l;
    locationSelect.appendChild(o);
  });
}
loadLocations();

/* Item selection */
itemSelect.addEventListener("change", async () => {
  const opt = itemSelect.selectedOptions[0];

  if (opt.value === "__new") {
    newItemModal.style.display = "flex";
    return;
  }

  if (opt.dataset.unit) itemUnit.value = opt.dataset.unit;
  if (opt.dataset.size) itemSize.value = opt.dataset.size;
});

/* Add new item modal */
saveNewItem.addEventListener("click", () => {
  if (!newItemName.value.trim()) return alert("Enter item name");

  const opt = document.createElement("option");
  opt.value = newItemName.value.trim();
  opt.textContent = newItemName.value.trim();
  opt.dataset.unit = newItemUnit.value.trim();
  opt.dataset.size = newItemSize.value.trim();

  existingItemsGroup.appendChild(opt);
  itemSelect.value = opt.value;

  itemUnit.value = newItemUnit.value.trim();
  itemSize.value = newItemSize.value.trim();

  newItemModal.style.display = "none";
});

closeNewItem.addEventListener("click", () => {
  newItemModal.style.display = "none";
});

/* Add new location */
addNewLocationBtn.addEventListener("click", () => {
  const name = prompt("Enter new location:");
  if (!name) return;

  const opt = document.createElement("option");
  opt.value = name;
  opt.textContent = name;
  locationSelect.appendChild(opt);
  locationSelect.value = name;
});

/* Submit Add/Top-Up */
form.addEventListener("submit", async e => {
  e.preventDefault();

  const name = itemSelect.value.trim();
  const qty = Number(itemQty.value);
  const loc = locationSelect.value;

  const unit = itemUnit.value.trim();
  const size = itemSize.value.trim();

  let par = Number(parInput.value);
  let min = Number(minInput.value);
  let max = Number(maxInput.value);

  if (isNaN(par)) par = qty;
  if (isNaN(min)) min = Math.floor(qty / 2);
  if (isNaN(max)) max = qty * 2;

  const snap = await getDocs(collection(db, "inventory"));
  let existing = null;

  snap.forEach(d => {
    const data = d.data();
    if (data.displayName.toLowerCase() === name.toLowerCase()) {
      existing = { id: d.id, ...data };
    }
  });

  /* New item */
  if (!existing) {
    const newRef = doc(collection(db, "inventory"));
    await setDoc(newRef, {
      displayName: name,
      unit, size,
      defaultPar: par,
      defaultMin: min,
      defaultMax: max,
      locations: {
        [loc]: { qty, par, min, max }
      }
    });

    await log("add-new-item", name, loc, qty, "Initial setup");
    alert("New item created");
  }

  /* Existing item */
  else {
    const itemRef = doc(db, "inventory", existing.id);
    const currentQty = existing.locations?.[loc]?.qty || 0;

    const updates = {
      displayName: name,
      unit, size,
      [`locations.${loc}.qty`]: currentQty + qty
    };

    await updateDoc(itemRef, updates);
    await log("topup", name, loc, qty, "Stock top-up");
    alert("Stock updated");
  }

  form.reset();
  loadExistingItems();
});

/* Logging */
async function log(type, item, loc, qty, reason) {
  await addDoc(collection(db, "inventoryLogs"), {
    type, item, location: loc,
    qty, reason,
    timestamp: serverTimestamp()
  });
}
