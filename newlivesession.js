import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  updateDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCvc2hMrzhWS4nxkLxJdiXyzdrmd_qi2XA",
  databaseURL: "https://attendancesystem2-4f5db-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "attendancesystem2-4f5db"
};

const app = initializeApp(firebaseConfig);
const rtdb = getDatabase(app);
const fs = getFirestore(app);

const statusEl = document.getElementById("status");
const tbody = document.getElementById("rows");
const emptyEl = document.getElementById("empty");
const countEl = document.getElementById("count");
const saveBtn = document.getElementById("saveBtn");

let currentData = null;
let activeSession = null; // { courseId, courseTitle, lectureId, lectureTitle, date }

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
  tbody.innerHTML = "";
  if (!data) {
    emptyEl.style.display = "block";
    countEl.textContent = "0 records";
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
}

// ---- Load the active session info (set by create-session.js) ----
// ---- Load the active session info (set by create-session.js) ----
async function loadActiveSession() {
  const placeholder = document.getElementById("noSessionPlaceholder");
  const content = document.getElementById("liveSessionContent");

  try {
    const snap = await getDoc(doc(fs, "systemStatus", "current"));
    if (snap.exists() && snap.data().sessionActive) {
      const data = snap.data();
      activeSession = {
        courseId: data.courseId,
        courseTitle: data.courseTitle,
        lectureId: data.lectureId,
        lectureTitle: data.lectureTitle
      };
      placeholder.style.display = "none";
      content.style.display = "block";
    } else {
      activeSession = null;
      placeholder.style.display = "block";
      content.style.display = "none";
    }
  } catch (err) {
    console.error("Error loading active session:", err);
    activeSession = null;
    placeholder.style.display = "block";
    content.style.display = "none";
  }
}

setStatus("Connecting…", "pending");
loadActiveSession();

const attendanceRef = ref(rtdb, "attendance");
onValue(attendanceRef, (snapshot) => {
  setStatus("Live", "live");
  currentData = snapshot.val();
  render(currentData);
}, (err) => {
  setStatus("Read error: " + err.message, "error");
});

// ---- Save session to Firestore ----
saveBtn.addEventListener("click", saveSession);

async function saveSession() {
  if (!currentData || Object.keys(currentData).length === 0) {
    alert("No attendance records to save.");
    return;
  }

  if (!activeSession) {
    alert("No active session found. Please start a session from Create Session first.");
    return;
  }

  const dataToSave = currentData;
  const recordCount = Object.keys(dataToSave).length;
  const course = activeSession.courseTitle;
  const dateInput = new Date().toISOString().slice(0, 10);

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  try {
    const batch = writeBatch(fs);
    const sessionRef = doc(collection(fs, "sessions"));

    batch.set(sessionRef, {
      course,
      courseId: activeSession.courseId,
      lectureId: activeSession.lectureId,
      lectureTitle: activeSession.lectureTitle,
      date: dateInput,
      savedAt: new Date(),
      recordCount
    });

    Object.entries(dataToSave).forEach(([, val]) => {
      const name = val.Name ?? val.name ?? "";
      const recordRef = doc(collection(fs, "attendanceLog"));
      batch.set(recordRef, {
        sessionId: sessionRef.id,
        course,
        courseId: activeSession.courseId,
        lectureId: activeSession.lectureId,
        date: dateInput,
        name,
        nameLower: name.toLowerCase(),
        regNumber: val.RegNumber ?? val.regNumber ?? "",
        time: val.Time ?? val.time ?? "",
        mode: val.Mode ?? val.mode ?? ""
      });
    });

    // Mark the lecture as completed and clear the active session flag
    if (activeSession.lectureId) {
      batch.update(doc(fs, "lectures", activeSession.lectureId), { status: "completed" });
    }
    batch.update(doc(fs, "systemStatus", "current"), { sessionActive: false });

    await batch.commit();
    await remove(ref(rtdb, "attendance")); // clear the live board for the next session

    activeSession = null;
    document.getElementById("liveSessionContent").style.display = "none";
    document.getElementById("noSessionPlaceholder").style.display = "block";
    alert(`Session saved: ${recordCount} records.`);
  } catch (err) {
    console.error(err);
    alert("Save failed: " + err.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Session";
  }
}