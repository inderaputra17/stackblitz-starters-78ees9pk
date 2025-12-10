// ======================================================
// inventory.js — Cleaned + Security-Aligned Version
// ======================================================

import { db } from "./app.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  onSnapshot,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";


/* ======================================================
   DOM ELEMENTS
====================================================== */
const listEl = document.getElementById("inventoryList");
const searchInput = document.getElementById("searchInput");
const locationFilter = document.getElementById("locationFilter");

/* Modals */
const editModal = document.getElementById("editLimitsModal");
const qtyModal = document.getElementById("qtyModal");

const editPar = document.getElementById("editPar");
const editMin = document.getElementById("editMin");
const editMax = document.getElementById("editMax");

const qtyValue = document.getElementById("qtyValue");
const qtyTitle = document.getElementById("qtyModalTitle");


/* ======================================================
   STATE VARIABLES
====================================================== */
let items = [];
let activeItem = null;
let activeLocation = null;
let qtyMode = null;


/* ======================================================
   LOAD LOCATIONS FOR FILTER
====================================================== */
async function loadLocations() {
  const snap = await getDocs(collection(db, "inventory"));
  const locs = new Set();

  snap.forEach(docSnap => {
    Object.keys(docSnap.data().locations || {}).forEach(loc => locs.add(loc));
  });

  [...locs].sort().forEach(loc => {
    const option = document.createElement("option");
    option.value = loc;
    option.textContent = loc;
    locationFilter.appendChild(option);
  });
}


/* ======================================================
   REAL-TIME INVENTORY LISTENER
====================================================== */
function listenInventory() {
  onSnapshot(collection(db, "inventory"), snap => {
    items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderList();
  });
}


/* ======================================================
   STATUS CALCULATOR
====================================================== */
function getStatus(qty, par, min) {
  if (qty <= min) return "critical";
  if (qty < par) return "low";
  return "ok";
}


/* ======================================================
   RENDER INVENTORY LIST
====================================================== */
function renderList() {
  const keyword = searchInput.value.toLowerCase();
  const locFilter = locationFilter.value;

  listEl.innerHTML = "";

  items.forEach(item => {
    if (!item.displayName.toLowerCase().includes(keyword)) return;

    const locations = item.locations || {};
    if (locFilter !== "all" && !locations[locFilter]) return;

    // Determine overall item status
    let worst = "ok";
    Object.values(locations).forEach(loc => {
      const st = getStatus(loc.qty, loc.par, loc.min);
      if (st === "critical") worst = "critical";
      else if (st === "low" && worst !== "critical") worst = "low";
    });

    const badgeClass =
      worst === "critical"
        ? "status-critical"
        : worst === "low"
        ? "status-low"
        : "status-ok";

    const card = document.createElement("div");
    card.className = "item-card";

    // Header + delete item
    card.innerHTML = `
      <div class="item-header">
        <div class="item-name">${item.displayName}</div>

        <button class="action-btn btn-delete-item danger-btn">
          Delete Item
        </button>

        <span class="status-badge ${badgeClass}">
          ${worst.toUpperCase()}
        </span>
      </div>
    `;

    // DELETE ITEM (FULL)
    card.querySelector(".btn-delete-item").onclick = () =>
      deleteItem(item.id);

    // Location rows
    Object.entries(locations).forEach(([locName, loc]) => {
      const row = document.createElement("div");
      row.className = "location-row";

      row.innerHTML = `
        <div class="location-title">${locName}</div>
        <div>Qty: ${loc.qty}</div>
        <div>PAR: ${loc.par} &nbsp; MIN: ${loc.min} &nbsp; MAX: ${loc.max}</div>

        <div class="location-actions">
          <button class="action-btn btn-edit">Edit Limits</button>
          <button class="action-btn btn-add">Add</button>
          <button class="action-btn btn-minus">Minus</button>

          <button class="action-btn btn-delete-location danger-btn-light">
            Delete
          </button>
        </div>
      `;

      // Edit limits modal
      row.querySelector(".btn-edit").onclick = () =>
        openEditLimits(item.id, locName, loc);

      // Add / minus stock modal
      row.querySelector(".btn-add").onclick = () =>
        openQtyModal(item.id, locName, "add");

      row.querySelector(".btn-minus").onclick = () =>
        openQtyModal(item.id, locName, "minus");

      // Delete location
      row.querySelector(".btn-delete-location").onclick = () =>
        deleteLocation(item.id, locName);

      card.appendChild(row);
    });

    listEl.appendChild(card);
  });
}


/* ======================================================
   DELETE ITEM (FULL)
====================================================== */
async function deleteItem(itemId) {
  if (!confirm("Delete entire item?")) return;
  await deleteDoc(doc(db, "inventory", itemId));
}


/* ======================================================
   DELETE LOCATION — auto-delete item if last location
====================================================== */
async function deleteLocation(itemId, locName) {
  if (!confirm(`Delete location "${locName}"?`)) return;

  const ref = doc(db, "inventory", itemId);
  const snap = await getDoc(ref);
  const data = snap.data();

  if (!data?.locations) return;

  delete data.locations[locName];
  const remaining = Object.keys(data.locations).length;

  if (remaining === 0) {
    await deleteDoc(ref);
    return;
  }

  await updateDoc(ref, { locations: data.locations });
}


/* ======================================================
   MODAL OPENERS
====================================================== */
function openEditLimits(itemId, locName, loc) {
  activeItem = itemId;
  activeLocation = locName;

  editPar.value = loc.par;
  editMin.value = loc.min;
  editMax.value = loc.max;

  editModal.classList.remove("hidden");
}

function openQtyModal(itemId, locName, mode) {
  activeItem = itemId;
  activeLocation = locName;
  qtyMode = mode;

  qtyValue.value = "";
  qtyTitle.textContent = mode === "add" ? "Add Stock" : "Minus Stock";

  qtyModal.classList.remove("hidden");
}


/* ======================================================
   SAVE EDIT LIMITS
====================================================== */
document.getElementById("saveEditLimits").onclick = async () => {
  const ref = doc(db, "inventory", activeItem);

  await updateDoc(ref, {
    [`locations.${activeLocation}.par`]: Number(editPar.value),
    [`locations.${activeLocation}.min`]: Number(editMin.value),
    [`locations.${activeLocation}.max`]: Number(editMax.value)
  });

  editModal.classList.add("hidden");
};


/* ======================================================
   APPLY QTY CHANGE
====================================================== */
document.getElementById("saveQtyModal").onclick = async () => {
  const value = Number(qtyValue.value);
  if (value <= 0) return alert("Enter valid number");

  const item = items.find(i => i.id === activeItem);
  const currentQty = item.locations[activeLocation].qty;

  const newQty = qtyMode === "add"
    ? currentQty + value
    : currentQty - value;

  await updateDoc(doc(db, "inventory", activeItem), {
    [`locations.${activeLocation}.qty`]: newQty
  });

  qtyModal.classList.add("hidden");
};


/* ======================================================
   CLOSE MODALS
====================================================== */
document.getElementById("closeEditLimits").onclick = () =>
  editModal.classList.add("hidden");

document.getElementById("closeQtyModal").onclick = () =>
  qtyModal.classList.add("hidden");


/* ======================================================
   EVENT LISTENERS
====================================================== */
searchInput.addEventListener("input", renderList);
locationFilter.addEventListener("change", renderList);


/* ======================================================
   INIT
====================================================== */
loadLocations();
listenInventory();
