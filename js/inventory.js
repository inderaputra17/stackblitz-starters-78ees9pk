import { db } from "./app.js";
import {
  collection,
  doc,
  updateDoc,
  deleteField,
  onSnapshot,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

console.log("inventory.js loaded");

// UI Refs
const container = document.getElementById("inventoryContainer");

// Modal refs
const modal = document.getElementById("modal");
const modalQty = document.getElementById("modalQty");
const modalSave = document.getElementById("modalSave");
const modalCancel = document.getElementById("modalCancel");

// State
let allItems = [];
let editItemId = null;
let editLoc = null;
let actionType = null;

/* ----------------------------------------------------------
   STATUS BADGE LOGIC
---------------------------------------------------------- */
function getStatus(qty, par, min, max) {
  qty = Number(qty);
  par = Number(par ?? 0);
  min = Number(min ?? 0);
  max = Number(max ?? 9999);

  if (qty <= min) return { label: "Critical", cls: "critical" };
  if (qty < par) return { label: "Low", cls: "low" };
  if (qty > max) return { label: "Overstock", cls: "overstock" };
  return { label: "OK", cls: "ok" };
}

/* ----------------------------------------------------------
   RENDER INVENTORY PER LOCATION
---------------------------------------------------------- */
function renderInventory() {
  container.innerHTML = "";

  const locMap = {};

  allItems.forEach(item => {
    const locs = item.locations || {};
    Object.keys(locs).forEach(locKey => {
      if (!locMap[locKey]) locMap[locKey] = [];
      locMap[locKey].push({
        id: item.id,
        name: item.displayName,
        qty: locs[locKey].qty,
        par: locs[locKey].par,
        min: locs[locKey].min,
        max: locs[locKey].max
      });
    });
  });

  // Render each location card
  Object.keys(locMap).sort().forEach(loc => {
    const card = document.createElement("div");
    card.className = "location-card";

    let html = `<div class="location-header">${loc}</div>`;

    locMap[loc].sort((a, b) => a.name.localeCompare(b.name)).forEach(item => {
      const status = getStatus(item.qty, item.par, item.min, item.max);
      const detailsId = `${item.id}__${loc}`;

      html += `
        <div class="item-row">
          <div class="item-info">
            <div class="item-name">${item.name}</div>
            <div class="item-qty">
              Qty: ${item.qty} • <span class="badge ${status.cls}">${status.label}</span>
            </div>
          </div>

          <div class="action-buttons">
            <button class="btn btn-add" data-type="add" data-id="${item.id}" data-loc="${loc}">+</button>
            <button class="btn btn-minus" data-type="minus" data-id="${item.id}" data-loc="${loc}">−</button>
            <button class="btn btn-del" data-type="delete" data-id="${item.id}" data-loc="${loc}">🗑</button>
            <button class="btn btn-details" data-type="details" data-key="${detailsId}">⋯</button>
          </div>
        </div>

        <div class="details-panel" id="details-${detailsId}">
          <div class="details-row">
            <label>PAR:</label>
            <input type="number" value="${item.par}" 
                   data-id="${item.id}" data-loc="${loc}" data-field="par">
            <button class="save-level-btn" data-save="true">Save</button>
          </div>

          <div class="details-row">
            <label>MIN:</label>
            <input type="number" value="${item.min}" 
                   data-id="${item.id}" data-loc="${loc}" data-field="min">
            <button class="save-level-btn" data-save="true">Save</button>
          </div>

          <div class="details-row">
            <label>MAX:</label>
            <input type="number" value="${item.max}" 
                   data-id="${item.id}" data-loc="${loc}" data-field="max">
            <button class="save-level-btn" data-save="true">Save</button>
          </div>
        </div>
      `;
    });

    card.innerHTML = html;
    container.appendChild(card);
  });
}

/* ----------------------------------------------------------
   FIRESTORE LISTENER
---------------------------------------------------------- */
onSnapshot(collection(db, "inventory"), snap => {
  allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderInventory();
});

/* ----------------------------------------------------------
   MODAL HANDLING
---------------------------------------------------------- */
modalCancel.onclick = () => (modal.style.display = "none");

modalSave.onclick = async () => {
  const amount = Number(modalQty.value);
  if (!amount || amount < 1) {
    alert("Enter a valid number.");
    return;
  }

  const item = allItems.find(i => i.id === editItemId);
  if (!item) return;

  const itemRef = doc(db, "inventory", editItemId);
  const currentQty = item.locations?.[editLoc]?.qty ?? 0;
  let newQty = currentQty;

  // ADD
  if (actionType === "add") {
    newQty = currentQty + amount;

    await updateDoc(itemRef, {
      [`locations.${editLoc}.qty`]: newQty
    });

    await log("increase", item.displayName, editLoc, amount, "Manual add");
  }

  // MINUS
  if (actionType === "minus") {
    const reason = prompt("Reason for reducing stock?");
    if (!reason) return alert("Reason required.");

    newQty = Math.max(0, currentQty - amount);

    await updateDoc(itemRef, {
      [`locations.${editLoc}.qty`]: newQty
    });

    await log("decrease", item.displayName, editLoc, -amount, reason);
  }

  modal.style.display = "none";
};

/* ----------------------------------------------------------
   BUTTON HANDLERS
---------------------------------------------------------- */
document.addEventListener("click", async e => {
  const type = e.target.dataset.type;

  if (!type) return;

  const itemId = e.target.dataset.id;
  const loc = e.target.dataset.loc;

  // ADD / MINUS (open modal)
  if (type === "add" || type === "minus") {
    actionType = type;
    editItemId = itemId;
    editLoc = loc;
    modalQty.value = "";
    modal.style.display = "flex";
    return;
  }

  // DELETE
  if (type === "delete") {
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;

    if (!confirm(`Delete "${item.displayName}" from ${loc}?`)) return;

    const itemRef = doc(db, "inventory", itemId);

    await updateDoc(itemRef, {
      [`locations.${loc}`]: deleteField()
    });

    await log("delete", item.displayName, loc, 0, "Deleted from location");
    return;
  }

  // DETAILS PANEL TOGGLE
  if (type === "details") {
    const key = e.target.dataset.key;
    const panel = document.getElementById(`details-${key}`);
    if (panel) {
      panel.style.display = panel.style.display === "block" ? "none" : "block";
    }
    return;
  }
});

/* ----------------------------------------------------------
   SAVE PAR/MIN/MAX
---------------------------------------------------------- */
document.addEventListener("click", async e => {
  if (!e.target.dataset.save) return;

  const row = e.target.closest(".details-row");
  const input = row.querySelector("input");

  const field = input.dataset.field;
  const itemId = input.dataset.id;
  const loc = input.dataset.loc;
  const newVal = Number(input.value);

  if (isNaN(newVal) || newVal < 0) return alert("Invalid number.");

  const itemRef = doc(db, "inventory", itemId);

  await updateDoc(itemRef, {
    [`locations.${loc}.${field}`]: newVal
  });

  const item = allItems.find(i => i.id === itemId);

  await log(`update-${field}`, item.displayName, loc, 0, `${field.toUpperCase()} updated`);
  alert(`${field.toUpperCase()} updated.`);
});

/* ----------------------------------------------------------
   LOGGING FUNCTION
---------------------------------------------------------- */
async function log(type, item, location, qty, reason) {
  await addDoc(collection(db, "inventoryLogs"), {
    type,
    item,
    location,
    qty,
    reason,
    timestamp: serverTimestamp()
  });
}
