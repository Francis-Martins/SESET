// enrollment.js
// Enrollment page — fingerprint/RFID hardware flow stays on Realtime Database.
// On successful enroll/delete, mirrors a matching record into Firestore's
// `students` collection so courses.js / students.js / attendance stay in sync.

import { app, auth, db as fs } from "../config/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase,
  ref,
  child,
  push,
  set,
  update,
  remove,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {
  doc,
  setDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const rtdb = getDatabase(app);
const commandsRef = ref(rtdb, 'commands');
const usersRef = ref(rtdb, 'users');

let busy = false;
let currentUsers = {};

function init() {
  const enrollNameInput = document.getElementById('enrollName');
  const enrollRegNoInput = document.getElementById('enrollRegNo');
  const enrollDeptInput = document.getElementById('enrollDept');
  const enrollMethodSelect = document.getElementById('enrollMethod');
  const enrollBtn = document.getElementById('enrollBtn');
  const enrollStatusBox = document.getElementById('enrollStatus');

  const deleteUserSelect = document.getElementById('deleteUserSelect');
  const deleteBtn = document.getElementById('deleteBtn');
  const deleteStatusBox = document.getElementById('deleteStatus');

  const resetBtn = document.getElementById('resetBtn');
  const usersTableBody = document.querySelector('#usersTable tbody');

  function setStatusBox(box, text, kind) {
    box.textContent = text;
    box.className = 'status-box ' + kind;
  }

  function lockButtons(lock) {
    enrollBtn.disabled = lock;
    deleteBtn.disabled = lock;
    busy = lock;
  }
function findByRegNo(regNo) {
  const target = regNo.trim().toLowerCase();
  return Object.values(currentUsers).find(
    (u) => (u.regNo || '').trim().toLowerCase() === target
  );
}
  // ---------- Enroll ----------
  enrollBtn.addEventListener('click', () => {
    const name = enrollNameInput.value.trim();
    const regNo = enrollRegNoInput.value.trim();
    if (!name) { alert('Please enter a name first.'); return; }
    if (!regNo) { alert('Please enter a Reg No first.'); return; }
    if (busy) { alert('A command is already running.'); return; }
    const existing = findByRegNo(regNo);
    if (existing) {
      alert(`Reg No "${regNo}" is already enrolled${existing.name ? ' for ' + existing.name : ''}.`);
      return;
    }
    const method = enrollMethodSelect.value;
    const pendingName = name;
    const pendingRegNo = regNo;
    const pendingDept = enrollDeptInput.value.trim();

    lockButtons(true);

    if (method === 'fingerprint') {
      enrollFingerprint(pendingName, pendingRegNo, pendingDept, () => finishEnrollFlow());
    } else if (method === 'rfid') {
      enrollRFID(pendingName, pendingRegNo, pendingDept, () => finishEnrollFlow());
    } else if (method === 'both') {
      enrollFingerprint(pendingName, pendingRegNo, pendingDept, (fpID) => {
        enrollRFID(pendingName, pendingRegNo, pendingDept, () => finishEnrollFlow(), fpID);
      });
    }
  });

  function enrollFingerprint(name, regNo, dept, onDone) {
    setStatusBox(enrollStatusBox, 'Sending fingerprint enroll command...', 'pending');
    update(commandsRef, { status: 'pending', message: '', assignedID: null })
      .then(() => update(commandsRef, { action: 'enroll' }));

    const unsubscribe = onValue(commandsRef, (snap) => {
      const data = snap.val() || {};
      if (data.status === 'in_progress') {
        setStatusBox(enrollStatusBox, 'Follow prompts on device screen (fingerprint)...', 'pending');
      } else if (data.status === 'success') {
        unsubscribe();
        const fpID = data.assignedID;
        setStatusBox(enrollStatusBox, `Fingerprint enrolled (ID #${fpID}).`, 'success');
        saveUserField(name, regNo, dept, { fingerprintID: fpID }, () => onDone(fpID));
      } else if (data.status === 'failed') {
        unsubscribe();
        setStatusBox(enrollStatusBox, `Fingerprint failed: ${data.message || ''}`, 'error');
        lockButtons(false);
      }
    });
  }

  function enrollRFID(name, regNo, dept, onDone, existingFpID) {
    setStatusBox(enrollStatusBox, 'Sending RFID enroll command...', 'pending');
    update(commandsRef, { status: 'pending', message: '', assignedUID: null })
      .then(() => update(commandsRef, { action: 'enroll_rfid' }));

    const unsubscribe = onValue(commandsRef, (snap) => {
      const data = snap.val() || {};
      if (data.status === 'in_progress') {
        setStatusBox(enrollStatusBox, 'Tap card/tag on device...', 'pending');
      } else if (data.status === 'success') {
        unsubscribe();
        const uid = data.assignedUID;
        setStatusBox(enrollStatusBox, `RFID enrolled (UID ${uid}).`, 'success');
        const fields = { rfidUID: uid };
        if (existingFpID !== undefined) fields.fingerprintID = existingFpID;
        saveUserField(name, regNo, dept, fields, () => onDone(uid));
      } else if (data.status === 'failed') {
        unsubscribe();
        setStatusBox(enrollStatusBox, `RFID failed: ${data.message || ''}`, 'error');
        lockButtons(false);
      }
    });
  }

  function saveUserField(name, regNo, dept, fields, callback) {
    const existingKey = window._pendingUserKey;

    const payload = Object.assign({
      name, regNo, department: dept || '', enrolledAt: new Date().toISOString()
    }, fields);

    if (existingKey) {
      update(child(usersRef, existingKey), fields).then(() => {
        mirrorToFirestore(existingKey, payload, fields);
        callback();
      });
    } else {
      const newRef = push(usersRef);
      window._pendingUserKey = newRef.key;
      set(newRef, payload).then(() => {
        mirrorToFirestore(newRef.key, payload, fields);
        callback();
      });
    }
  }

  // ---------- Firestore mirror ----------
  function mirrorToFirestore(key, payload, latestFields) {
    const docData = {
      name: payload.name,
      regNo: payload.regNo,
      department: payload.department || '',
      updatedAt: new Date()
    };
    if (latestFields.fingerprintID !== undefined) {
      docData.fingerprintId = latestFields.fingerprintID;
    }
    if (latestFields.rfidUID !== undefined) {
      docData.rfidTagId = latestFields.rfidUID;
    }

    setDoc(doc(fs, 'students', key), docData, { merge: true })
      .catch((err) => console.error('Firestore mirror failed:', err));
  }

  function removeFromFirestore(key) {
    deleteDoc(doc(fs, 'students', key))
      .catch((err) => console.error('Firestore mirror delete failed:', err));
  }

  function finishEnrollFlow() {
    update(commandsRef, { action: 'none' });
    lockButtons(false);
    enrollNameInput.value = '';
    enrollRegNoInput.value = '';
    enrollDeptInput.value = '';
    window._pendingUserKey = null;
  }

  // ---------- Delete ----------
  deleteBtn.addEventListener('click', () => {
    const key = deleteUserSelect.value;
    if (!key) { alert('Select a user to delete.'); return; }
    const user = currentUsers[key];
    if (!user) return;
    runDelete(key, user);
  });

  function runDelete(key, user) {
    if (busy) { alert('A command is already running.'); return; }
    lockButtons(true);

    if (user.fingerprintID !== undefined && user.fingerprintID !== null) {
      setStatusBox(deleteStatusBox, `Deleting fingerprint ID #${user.fingerprintID}...`, 'pending');
      update(commandsRef, { status: 'pending', message: '', targetID: user.fingerprintID })
        .then(() => update(commandsRef, { action: 'delete' }));

      const unsubscribe = onValue(commandsRef, (snap) => {
        const data = snap.val() || {};
        if (data.status === 'success' || data.status === 'failed') {
          unsubscribe();
          update(commandsRef, { action: 'none' });
          remove(child(usersRef, key));
          removeFromFirestore(key);
          setStatusBox(deleteStatusBox, data.status === 'success' ? 'Deleted.' : `Failed: ${data.message}`, data.status);
          lockButtons(false);
        }
      });
    } else {
      // RFID-only user, no sensor slot to clear
      remove(child(usersRef, key));
      removeFromFirestore(key);
      setStatusBox(deleteStatusBox, 'Deleted.', 'success');
      lockButtons(false);
    }
  }

  // ---------- Reset stuck command ----------
  resetBtn.addEventListener('click', () => {
    update(commandsRef, { action: 'none', status: 'idle', message: '' });
    lockButtons(false);
    setStatusBox(enrollStatusBox, 'Idle.', 'idle');
    setStatusBox(deleteStatusBox, 'Idle.', 'idle');
  });

  // ---------- Live users table + delete dropdown ----------
  onValue(usersRef, (snap) => {
    currentUsers = snap.val() || {};
    usersTableBody.innerHTML = '';
    deleteUserSelect.innerHTML = '<option value="">-- select --</option>';

    const keys = Object.keys(currentUsers);
    if (keys.length === 0) {
      usersTableBody.innerHTML = '<tr><td colspan="5" class="empty">No enrolled users yet.</td></tr>';
      return;
    }

    keys.forEach(key => {
      const u = currentUsers[key];
      const badges = [];
      if (u.fingerprintID !== undefined && u.fingerprintID !== null) badges.push(`<span class="badge fp">FP #${u.fingerprintID}</span>`);
      if (u.rfidUID) badges.push(`<span class="badge rfid">RFID</span>`);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${u.name || ''}</td>
        <td>${u.regNo || ''}</td>
        <td>${u.department || ''}</td>
        <td>${badges.join('')}</td>
        <td><button class="btn btn-danger btn-sm row-delete" data-key="${key}">Delete</button></td>
              `;
      usersTableBody.appendChild(tr);

      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = u.name || key;
      deleteUserSelect.appendChild(opt);
    });

    document.querySelectorAll('.row-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const key = e.target.dataset.key;
        const user = currentUsers[key];
        if (confirm(`Delete user "${user?.name || key}"?`)) {
          runDelete(key, user);
        }
      });
    });
  });
}

// ---------- Start once the user is signed in ----------
// Uses the session from the login page (no hardcoded admin credentials).
let started = false;
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "../index.html";
    return;
  }
  if (!started) {
    started = true;
    init();
  }
});