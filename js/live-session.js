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

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}