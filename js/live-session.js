// live-session.js
// Live Session page — wired to Firestore.

import { auth, db, requireAuth } from "./common.js";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

requireAuth();

let unsubscribeListener = null;
let sessionEndTime = null;
let currentLectureId = null;

document.addEventListener("DOMContentLoaded", async () => {
  await loadSystemStatus();
  setInterval(updateTimeRemaining, 1000);

  // TODO: Firebase — implement real device heartbeat check.
  // Defaulting to "Online" as placeholder state until heartbeat data exists.
  setDeviceStatus(true);

  document.getElementById("printBtn").addEventListener("click", () => {
    window.print();
  });

  document.getElementById("endSessionBtn").addEventListener("click", handleEndSession);
});

// ---- Load systemStatus/current ----
async function loadSystemStatus() {
  try {
    const statusSnap = await getDoc(doc(db, "systemStatus", "current"));

    if (!statusSnap.exists() || !statusSnap.data().sessionActive) {
      document.getElementById("lectureTitleDisplay").textContent = "No active session";
      document.getElementById("sessionDateDisplay").textContent = "";
      return;
    }

    const status = statusSnap.data();
    currentLectureId = status.lectureId;
    sessionEndTime = status.sessionEndTime?.toDate();

    document.getElementById("lectureTitleDisplay").textContent =
      `${status.lectureTitle} — ${status.courseTitle}`;

    document.getElementById("sessionDateDisplay").textContent =
      new Date().toLocaleDateString();

    attachAttendanceListener(currentLectureId);
  } catch (error) {
    console.error("Error loading system status:", error);
    document.getElementById("lectureTitleDisplay").textContent = "Failed to load session.";
  }
}

// ---- Real-time attendance listener ----
function attachAttendanceListener(lectureId) {
  const q = query(
    collection(db, "attendanceRecords"),
    where("lectureId", "==", lectureId),
    orderBy("time", "asc")
  );

  unsubscribeListener = onSnapshot(q, (snapshot) => {
    const tbody = document.getElementById("liveAttendanceBody");
    tbody.innerHTML = "";

    let count = 0;

    snapshot.forEach((docSnap) => {
      const record = docSnap.data();
      count++;

      const time = record.time?.toDate().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }) || "—";

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${time}</td>
        <td>${record.studentName}</td>
        <td>${record.regNo}</td>
        <td>${capitalize(record.mode)}</td>
      `;
      tbody.appendChild(row);
    });

    document.getElementById("checkedInCount").textContent = count;
  }, (error) => {
    console.error("Error listening to attendance records:", error);
  });
}

// ---- Countdown ----
function updateTimeRemaining() {
  const display = document.getElementById("timeRemainingDisplay");
  if (!sessionEndTime) {
    display.textContent = "Time remaining: --:--";
    return;
  }

  const diffMs = sessionEndTime - new Date();

  if (diffMs <= 0) {
    display.textContent = "Session time elapsed";
    return;
  }

  const minutes = Math.floor(diffMs / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);
  display.textContent = `Time remaining: ${minutes}m ${seconds}s`;
}

// ---- Device status ----
function setDeviceStatus(isOnline) {
  const badge = document.getElementById("deviceStatusBadge");
  if (isOnline) {
    badge.textContent = "Device Online";
    badge.className = "badge badge-online";
  } else {
    badge.textContent = "Device Offline";
    badge.className = "badge badge-offline";
  }
}

// ---- End Session ----
async function handleEndSession() {
  try {
    await updateDoc(doc(db, "systemStatus", "current"), {
      sessionActive: false
    });

    if (currentLectureId) {
      await updateDoc(doc(db, "lectures", currentLectureId), {
        status: "ended"
      });
    }

    if (unsubscribeListener) {
      unsubscribeListener();
      unsubscribeListener = null;
    }

    window.location.href = "courses.html";
  } catch (error) {
    console.error("Error ending session:", error);
    alert("Failed to end session. Please try again."); // TODO: replace with inline error UI if desired
  }
}
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// --- NEW: Firestore imports ---
import {
  getFirestore, collection, doc, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCvc2hMrzhWS4nxkLxJdiXyzdrmd_qi2XA",
  databaseURL: "https://attendancesystem2-4f5db-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const fs = getFirestore(app); // NEW

const statusEl = document.getElementById("status");
const tbody = document.getElementById("rows");
const emptyEl = document.getElementById("empty");
const countEl = document.getElementById("count");
const saveBtn = document.getElementById("saveBtn"); // NEW — add this button to your HTML

let currentAttendance = null; // NEW — holds latest RTDB snapshot for Save to use

function setStatus(text, tone) {
  statusEl.textContent = text;
  statusEl.className = "status " + (tone || "");
}

function fmtRow(val) {
  const date = val.Date ?? val.date ?? "—";
  const time = val.Time ?? val.time ?? "—";
  const name = val.Name ?? val.name ?? "—";
  const mode = val.Mode ?? val.mode ?? "—";
  return `<tr>
    <td>${date}</td>
    <td>${time}</td>
    <td>${name}</td>
    <td>${mode}</td>
  </tr>`;
}

function render(data) {
  currentAttendance = data; // NEW

  tbody.innerHTML = "";
  if (!data) {
    emptyEl.style.display = "block";
    countEl.textContent = "0 records";
    updateSaveButtonState(); // NEW
    return;
  }
  const entries = Object.entries(data);
  emptyEl.style.display = "none";
  countEl.textContent = entries.length + (entries.length === 1 ? " record" : " records");
  entries
    .sort((a, b) => (b[0] > a[0] ? 1 : -1))
    .forEach(([, val]) => {
      if (typeof val === "object" && val !== null) {
        tbody.insertAdjacentHTML("beforeend", fmtRow(val));
      }
    });

  updateSaveButtonState(); // NEW
}

// --- NEW: Save button logic ---
function updateSaveButtonState() {
  if (!saveBtn) return;
  const hasRecords = currentAttendance && Object.keys(currentAttendance).length > 0;
  saveBtn.disabled = !hasRecords;
}

async function saveSession() {
  if (!currentAttendance) return;

  const entries = Object.entries(currentAttendance).filter(
    ([, val]) => typeof val === "object" && val !== null
  );
  if (entries.length === 0) return;

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  try {
    // Simple defaults — swap these out for real inputs whenever you add
    // a course/date picker to this page. Kept minimal on purpose for now.
    const course = "Unassigned";
    const courseId = course.toLowerCase();
    const date = new Date().toISOString().slice(0, 10);

    const batch = writeBatch(fs);

    const sessionRef = doc(collection(fs, "sessions"));
    batch.set(sessionRef, {
      course,
      courseId,
      date,
      savedAt: serverTimestamp()
    });

    entries.forEach(([, val]) => {
      const name = val.Name ?? val.name ?? "—";
      const recordRef = doc(collection(fs, "attendanceRecords"));
      batch.set(recordRef, {
        sessionId: sessionRef.id,
        course,
        courseId,
        date,
        studentName: name,
        studentNameLower: name.toLowerCase(),
        mode: val.Mode ?? val.mode ?? "—",
        checkedInAt: serverTimestamp()
      });
    });

    await batch.commit();

    setStatus("Session saved", "live");
    saveBtn.textContent = "Saved ✓";
  } catch (err) {
    setStatus("Save error: " + err.message, "error");
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Session";
  }
}

if (saveBtn) {
  saveBtn.addEventListener("click", saveSession);
}

// --- unchanged from before ---
setStatus("Connecting…", "pending");
const attendanceRef = ref(db, "attendance");
onValue(attendanceRef, (snapshot) => {
  setStatus("Live", "live");
  render(snapshot.val());
}, (err) => {
  setStatus("Read error: " + err.message, "error");
});
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}