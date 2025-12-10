/************************************************************
 * TRANSFER.JS — CLEAN, STABLE, NO FEATURE CHANGES
 ************************************************************/

 import { db } from "./app.js";
 import {
   collection,
   doc,
   getDocs,
   getDoc,
   updateDoc,
   addDoc,
   serverTimestamp
 } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
 
 console.log("transfer.js loaded");
 
 /* ============================================================
    STATE
 ============================================================ */
 let allItems = [];
 let allLocations = [];
 
 let selectedFrom = null;
 let selectedTo = null;
 
 let batchSelection = {};
 let lastTransferRecord = null;
 let undoTimer = null;
 
 let transferInProgress = false;
 
 /* ============================================================
    DOM
 ============================================================ */
 const fromLocation      = document.getElementById("fromLocation");
 const toLocation        = document.getElementById("toLocation");
 
 const step1             = document.getElementById("step1");
 const step2             = document.getElementById("step2");
 const step3             = document.getElementById("step3");
 
 const itemSearch        = document.getElementById("itemSearch");
 const categoryFilter    = document.getElementById("categoryFilter");
 const itemList          = document.getElementById("itemList");
 
 const previewBox        = document.getElementById("previewBox");
 const transferReason    = document.getElementById("transferReason");
 
 const undoBox           = document.getElementById("undoBox");
 const undoBtn           = document.getElementById("undoBtn");
 
 const confirmBtn        = document.getElementById("confirmTransfer");
 
 /* Step Tabs */
 const step1Tab = document.getElementById("step1Tab");
 const step2Tab = document.getElementById("step2Tab");
 const step3Tab = document.getElementById("step3Tab");
 
 /* ============================================================
    STEP NAVIGATION
 ============================================================ */
 function showStep(step) {
   [step1, step2, step3].forEach(s => s.classList.add("hidden"));
   document.querySelectorAll(".step").forEach(t => t.classList.remove("active"));
 
   if (step === 1) {
     step1.classList.remove("hidden");
     step1Tab.classList.add("active");
   }
   if (step === 2) {
     step2.classList.remove("hidden");
     step2Tab.classList.add("active");
   }
   if (step === 3) {
     step3.classList.remove("hidden");
     step3Tab.classList.add("active");
     buildPreview();
   }
 }
 
 /* ============================================================
    LOAD DATA
 ============================================================ */
 async function loadData() {
   const snap = await getDocs(collection(db, "inventory"));
   allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
 
   const locSet = new Set();
   allItems.forEach(item => {
     Object.keys(item.locations || {}).forEach(loc => locSet.add(loc));
   });
 
   allLocations = [...locSet].sort();
   renderLocationDropdowns();
 }
 
 function renderLocationDropdowns() {
   fromLocation.innerHTML = `<option value="">Select location</option>`;
   toLocation.innerHTML   = `<option value="">Select location</option>`;
 
   allLocations.forEach(loc => {
     fromLocation.appendChild(new Option(loc, loc));
     toLocation.appendChild(new Option(loc, loc));
   });
 }
 
 /* ============================================================
    STEP 2 — ITEMS IN LOCATION
 ============================================================ */
 function getItemsInLocation(loc) {
   return allItems
     .filter(i => i.locations?.[loc])
     .map(i => ({
       id: i.id,
       name: i.displayName,
       qty: i.locations[loc].qty,
       category: i.category || ""
     }));
 }
 
 function renderItemList() {
   itemList.innerHTML = "";
   batchSelection = {};
 
   if (!selectedFrom) {
     itemList.innerHTML = `<p>No location selected.</p>`;
     return;
   }
 
   const q = itemSearch.value.toLowerCase();
   const cat = categoryFilter.value;
 
   const filtered = getItemsInLocation(selectedFrom)
     .filter(i => i.name.toLowerCase().includes(q))
     .filter(i => (cat ? i.category === cat : true));
 
   if (!filtered.length) {
     itemList.innerHTML = `<p>No items found.</p>`;
     return;
   }
 
   filtered.forEach(item => {
     batchSelection[item.id] = 0;
 
     const row = document.createElement("div");
     row.className = "item-row";
 
     const isEmpty = item.qty <= 0;
     const disabledClass = isEmpty ? "disabled-item" : "";
 
     row.innerHTML = `
       <div class="item-name ${disabledClass}">${item.name}</div>
 
       <div class="qty-controls">
         <button class="qty-btn qty-minus" data-id="${item.id}" ${isEmpty ? "disabled" : ""}>−</button>
         <div class="qty-display" id="qty-${item.id}">0</div>
         <button class="qty-btn qty-plus" 
                 data-id="${item.id}" 
                 data-max="${item.qty}"
                 ${isEmpty ? "disabled" : ""}>
           +
         </button>
       </div>
 
       <div class="mini-preview" id="preview-${item.id}">
         ${isEmpty ? "(No stock available)" : ""}
       </div>
     `;
 
     if (isEmpty) row.style.opacity = "0.5";
 
     itemList.appendChild(row);
   });
 }
 
 /* ============================================================
    QUANTITY BUTTON HANDLING
 ============================================================ */
 document.addEventListener("click", e => {
   if (e.target.classList.contains("qty-plus")) {
     const id = e.target.dataset.id;
     const max = Number(e.target.dataset.max);
 
     if (batchSelection[id] < max) {
       batchSelection[id]++;
       document.getElementById(`qty-${id}`).textContent = batchSelection[id];
       updateMiniPreview(id);
       buildPreview();
     }
   }
 
   if (e.target.classList.contains("qty-minus")) {
     const id = e.target.dataset.id;
 
     if (batchSelection[id] > 0) {
       batchSelection[id]--;
       document.getElementById(`qty-${id}`).textContent = batchSelection[id];
       updateMiniPreview(id);
       buildPreview();
     }
   }
 });
 
 /* Real-time mini preview */
 function updateMiniPreview(id) {
   const item = allItems.find(i => i.id === id);
   const qty = batchSelection[id];
   const original = item.locations[selectedFrom].qty;
 
   const targetQty = item.locations[selectedTo]?.qty || 0;
   const box = document.getElementById(`preview-${id}`);
 
   if (qty === 0) {
     box.textContent = "";
     return;
   }
 
   box.textContent =
     `After: ${selectedFrom} ${original}→${original - qty}, ` +
     `${selectedTo} ${targetQty}→${targetQty + qty}`;
 }
 
 /* ============================================================
    VALIDATION
 ============================================================ */
 function validateStep1() {
   selectedFrom = fromLocation.value;
   selectedTo = toLocation.value;
 
   if (!selectedFrom || !selectedTo) {
     alert("Please select both FROM and TO locations.");
     return false;
   }
   if (selectedFrom === selectedTo) {
     alert("FROM and TO cannot be the same.");
     return false;
   }
 
   return true;
 }
 
 function validateStep2() {
   const total = Object.values(batchSelection).reduce((a, b) => a + b, 0);
   if (total === 0) {
     alert("Select at least one item to transfer.");
     return false;
   }
   return true;
 }
 
 /* ============================================================
    STEP 3 — PREVIEW BUILDER
 ============================================================ */
 function buildPreview() {
   let txt = `FROM: ${selectedFrom}\nTO: ${selectedTo}\n\n`;
 
   let totalItems = 0;
   let itemCount = 0;
 
   Object.keys(batchSelection).forEach(id => {
     const qty = batchSelection[id];
     if (qty <= 0) return;
 
     itemCount++;
     totalItems += qty;
 
     const item = allItems.find(i => i.id === id);
     const fromQty = item.locations[selectedFrom].qty;
     const toQty = item.locations[selectedTo]?.qty || 0;
 
     txt += `${item.displayName}\n`;
     txt += `  ${selectedFrom}: ${fromQty} → ${fromQty - qty}\n`;
 
     if (!item.locations[selectedTo]) {
       txt += `  ${selectedTo}: (new item) 0 → ${qty}\n\n`;
     } else {
       txt += `  ${selectedTo}: ${toQty} → ${toQty + qty}\n\n`;
     }
   });
 
   txt += `--------------------------\n`;
   txt += `Total distinct items: ${itemCount}\n`;
   txt += `Total qty moving: ${totalItems}\n`;
 
   previewBox.textContent = txt.trim();
 }
 
 /* ============================================================
    SUBMIT TRANSFER
 ============================================================ */
 async function confirmTransfer() {
   if (transferInProgress) return;
 
   transferInProgress = true;
   confirmBtn.disabled = true;
   window.onbeforeunload = () => "Transfer in progress…";
 
   const ops = [];
   const undoStack = [];
 
   for (const id of Object.keys(batchSelection)) {
     const qty = batchSelection[id];
     if (qty <= 0) continue;
 
     const ref = doc(db, "inventory", id);
     const snap = await getDoc(ref);
     const data = snap.data();
 
     const beforeFrom = data.locations[selectedFrom].qty;
     const beforeTo = data.locations[selectedTo]?.qty || 0;
 
     if (qty > beforeFrom) {
       alert(`Not enough stock for ${data.displayName}`);
       resetConfirmButton();
       return;
     }
 
     const afterFrom = beforeFrom - qty;
     const afterTo = beforeTo + qty;
 
     ops.push(updateDoc(ref, {
       [`locations.${selectedFrom}.qty`]: afterFrom,
       [`locations.${selectedTo}.qty`]: afterTo
     }));
 
     undoStack.push({
       id,
       beforeFrom,
       beforeTo,
       reason: transferReason.value || "",
       qty
     });
 
     await addDoc(collection(db, "inventoryLogs"), {
       type: "transfer",
       itemId: id,
       itemName: data.displayName,
       fromLocation: selectedFrom,
       toLocation: selectedTo,
       qty,
       newQty: afterTo,
       reason: transferReason.value || "",
       timestamp: serverTimestamp(),
       meta: {
         message: `Transferred ${qty}x ${data.displayName}`
       }
     });
   }
 
   await Promise.all(ops);
 
   lastTransferRecord = undoStack;
   startUndoTimer();
 
   alert("Transfer complete!");
   resetConfirmButton();
 }
 
 function resetConfirmButton() {
   confirmBtn.disabled = false;
   transferInProgress = false;
   window.onbeforeunload = null;
 }
 
 /* ============================================================
    UNDO
 ============================================================ */
 function startUndoTimer() {
   undoBox.classList.remove("hidden");
 
   let remaining = 120;
   undoBtn.textContent = `Undo (2:00)`;
 
   undoTimer = setInterval(() => {
     remaining--;
     undoBtn.textContent = `Undo (${formatTime(remaining)})`;
 
     if (remaining <= 0) {
       clearInterval(undoTimer);
       undoBox.classList.add("hidden");
     }
   }, 1000);
 }
 
 function formatTime(sec) {
   return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
 }
 
 undoBtn.onclick = async () => {
   clearInterval(undoTimer);
   undoBox.classList.add("hidden");
 
   if (!lastTransferRecord) return;
 
   const ops = lastTransferRecord.map(rec => {
     const ref = doc(db, "inventory", rec.id);
     return updateDoc(ref, {
       [`locations.${selectedFrom}.qty`]: rec.beforeFrom,
       [`locations.${selectedTo}.qty`]: rec.beforeTo
     });
   });
 
   await Promise.all(ops);
   alert("Transfer undone.");
 };
 
 /* ============================================================
    EVENT LISTENERS
 ============================================================ */
 document.getElementById("toStep2").onclick = () => {
   if (!validateStep1()) return;
   renderItemList();
   showStep(2);
 };
 
 document.getElementById("backToStep1").onclick = () => showStep(1);
 
 document.getElementById("toStep3").onclick = () => {
   if (!validateStep2()) return;
   showStep(3);
 };
 
 document.getElementById("backToStep2").onclick = () => showStep(2);
 
 confirmBtn.onclick = confirmTransfer;
 
 itemSearch.addEventListener("input", renderItemList);
 categoryFilter.addEventListener("change", renderItemList);
 
 /* ============================================================
    INIT
 ============================================================ */
 loadData();
 
