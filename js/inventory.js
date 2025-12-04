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

const container = document.getElementById("inventoryContainer");

// Modal refs
const modal = document.getElementById("modal");
const modalQty = document.getElementById("modalQty");
const modalSave = document.getElementById("modalSave");
const modalCancel = document.getElementById("modalCancel");

// State
let allItems = [];
let actionType = null;    // "add" or "minus"
let editItemId = null;
let editLocation = null;
let currentQty = 0;

/* ---------------- STATUS ---------------- */
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

/* --------------- RENDER INVENTORY (by location) --------------- */
function renderInventory() {
  container.innerHTML = "";

  const locMap = {};

  allItems.forEach(item => {
    const locs = item.locations || {};
    Object.keys(locs).forEach(locKey => {
      if (!locMap[locKey]) {
        locMap[locKey] = { items: {} };
      }
      locMap[locKey].items[item.displayName] = {
        qty: locs[locKey].qty || 0,
        par: locs[locKey].par ?? item.defaultPar ?? 0,
        min: locs[locKey].min ?? item.defaultMin ?? 0,
        max: locs[locKey].max ?? item.defaultMax ?? 9999,
        itemId: item.id
      };
    });
  });

  Object.keys(locMap).forEach(locKey => {
    const card = document.createElement("div");
    card.className = "location-card";

    let html = `<div class="location-title">${locKey}</div>`;
    html += `
      <table>
        <tr>
          <th>Item</th>
          <th>Qty</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
    `;

    const itemsSorted = Object.keys(locMap[locKey].items).sort();

    itemsSorted.forEach(name => {
      const info = locMap[locKey].items[name];
      const status = getStatus(info.qty, info.par, info.min, info.max);
      const detailsKey = `${info.itemId}__${locKey}`;

      html += `
        <tr class="main-row" data-main-key="${detailsKey}">
          <td>${name}</td>
          <td>${info.qty}</td>
          <td><span class="badge ${status.cls}">${status.label}</span></td>
          <td>
            <button class="action-btn add-btn"
              data-type="add" data-item="${info.itemId}" data-loc="${locKey}">
              +
            </button>
            <button class="action-btn minus-btn"
              data-type="minus" data-item="${info.itemId}" data-loc="${locKey}">
              −
            </button>
            <button class="action-btn delete-btn"
              data-type="delete" data-item="${info.itemId}" data-loc="${locKey}">
              Del
            </button>
            <button class="action-btn details-btn"
              data-type="details" data-item="${info.itemId}" data-loc="${locKey}">
              Details
            </button>
          </td>
        </tr>

        <tr class="details-row" data-details-key="${detailsKey}" style="display: none;">
          <td colspan="4">
            <div class="level-field">
              <label>PAR</label>
              <input type="number" class="level-input" data-field="par"
                     data-item="${info.itemId}" data-loc="${locKey}" value="${info.par}">
              <button class="level-save-btn"
                      data-type="save-level"
                      data-field="par"
                      data-item="${info.itemId}"
                      data-loc="${locKey}">
                Save
              </button>
            </div>

            <div class="level-field">
              <label>MIN</label>
              <input type="number" class="level-input" data-field="min"
                     data-item="${info.itemId}" data-loc="${locKey}" value="${info.min}">
              <button class="level-save-btn"
                      data-type="save-level"
                      data-field="min"
                      data-item="${info.itemId}"
                      data-loc="${locKey}">
                Save
              </button>
            </div>

            <div class="level-field">
              <label>MAX</label>
              <input type="number" class="level-input" data-field="max"
                     data-item="${info.itemId}" data-loc="${locKey}" value="${info.max}">
              <button class="level-save-btn"
                      data-type="save-level"
                      data-field="max"
                      data-item="${info.itemId}"
                      data-loc="${locKey}">
                Save
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    html += `</table>`;
    card.innerHTML = html;
    container.appendChild(card);
  });
}

/* --------------- SNAPSHOT LISTENER --------------- */
onSnapshot(collection(db, "inventory"), snap => {
  allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderInventory();
});

/* --------------- MODAL HANDLERS --------------- */
modalCancel.onclick = () => {
  modal.style.display = "none";
};

modalSave.onclick = async () => {
  const qty = parseInt(modalQty.value, 10);
  if (!qty || qty < 1) {
    alert("Enter a valid quantity.");
    return;
  }

  const item = allItems.find(i => i.id === editItemId);
  if (!item) {
    alert("Item not found.");
    return;
  }

  const itemRef = doc(db, "inventory", editItemId);
  const current = item.locations?.[editLocation]?.qty || 0;
  let newQty = current;

  if (actionType === "add") {
    newQty = current + qty;
    await updateDoc(itemRef, {
      [`locations.${editLocation}.qty`]: newQty
    });
    await logAction("increase", item.displayName, editLocation, qty, "Manual top up");

  } else if (actionType === "minus") {
    let reason = prompt("Reason for decreasing stock?");
    if (!reason) {
      alert("Reason is required.");
      return;
    }

    newQty = current - qty;
    if (newQty < 0) newQty = 0;

    await updateDoc(itemRef, {
      [`locations.${editLocation}.qty`]: newQty
    });

    if (newQty === 0) {
      alert("⚠ Quantity is now ZERO. Top up required unless this item will be deleted.");
    }

    await logAction("decrease", item.displayName, editLocation, -qty, reason);
  }

  modal.style.display = "none";
};

/* --------------- CLICK HANDLER (buttons) --------------- */
document.addEventListener("click", async (e) => {
  const type = e.target.dataset.type;
  if (!type) return;

  const itemId = e.target.dataset.item;
  const loc = e.target.dataset.loc;

  if (type === "add" || type === "minus") {
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;

    editItemId = itemId;
    editLocation = loc;
    actionType = type;
    currentQty = item.locations?.[loc]?.qty || 0;

    modalQty.value = "";
    modal.style.display = "flex";
    return;
  }

  if (type === "delete") {
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;

    if (!confirm(`Delete ${item.displayName} from ${loc}?`)) return;

    const itemRef = doc(db, "inventory", itemId);
    await updateDoc(itemRef, {
      [`locations.${loc}`]: deleteField()
    });

    await logAction("delete", item.displayName, loc, 0, "Item removed from this location");
    return;
  }

  if (type === "details") {
    const key = `${itemId}__${loc}`;
    const row = document.querySelector(`.details-row[data-details-key="${key}"]`);
    if (row) {
      row.style.display = (row.style.display === "none" || row.style.display === "") ? "table-row" : "none";
    }
    return;
  }

  if (type === "save-level") {
    const field = e.target.dataset.field; // "par" | "min" | "max"
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;

    const itemRef = doc(db, "inventory", itemId);

    const parent = e.target.closest(".level-field");
    const input = parent.querySelector("input");
    const newVal = parseInt(input.value, 10);
    if (isNaN(newVal) || newVal < 0) {
      alert("Enter a valid number.");
      return;
    }

    const oldVal = item.locations?.[loc]?.[field] ?? item[`default${field[0].toUpperCase() + field.slice(1)}`];

    await updateDoc(itemRef, {
      [`locations.${loc}.${field}`]: newVal
    });

    await logAction(
      `update-${field}`,
      item.displayName,
      loc,
      0,
      `Updated ${field.toUpperCase()} from ${oldVal} to ${newVal}`
    );

    alert(`${field.toUpperCase()} updated.`);
    return;
  }
});

/* --------------- ADD LOCATION BUTTON --------------- */
document.getElementById("addLocationBtn").addEventListener("click", async () => {
  const name = prompt("Enter new location name:");
  if (!name) return;

  for (const item of allItems) {
    const ref = doc(db, "inventory", item.id);
    const par = item.defaultPar ?? 0;
    const min = item.defaultMin ?? 0;
    const max = item.defaultMax ?? 9999;

    await updateDoc(ref, {
      [`locations.${name}`]: {
        qty: 0,
        par,
        min,
        max
      }
    });
  }

  alert("New location added to all items.");
});

/* --------------- LOGGING --------------- */
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
