// enrollment.js
// Enrollment page — wired to Firestore.

import { db, requireAuth } from "./common.js";
import {
  collection,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

requireAuth();

let currentStudentId = null;

document.addEventListener("DOMContentLoaded", () => {
  const enrollForm = document.getElementById("enrollForm");
  const captureFingerprintBtn = document.getElementById("captureFingerprintBtn");
  const captureRfidBtn = document.getElementById("captureRfidBtn");
  const dismissAlertBtn = document.getElementById("dismissAlertBtn");

  enrollForm.addEventListener("submit", handleCreateStudent);
  captureFingerprintBtn.addEventListener("click", () => startCapture("fingerprint"));
  captureRfidBtn.addEventListener("click", () => startCapture("rfid"));
  dismissAlertBtn.addEventListener("click", () => {
    document.getElementById("duplicateAlert").style.display = "none";
  });
});

// ---- Create Student ----
async function handleCreateStudent(e) {
  e.preventDefault();

  const name = document.getElementById("studentName").value.trim();
  const regNo = document.getElementById("studentRegNo").value.trim();
  if (!name || !regNo) return;

  const createStudentBtn = document.getElementById("createStudentBtn");
  const captureRow = document.getElementById("captureRow");

  try {
    const docRef = await addDoc(collection(db, "students"), {
      name,
      regNo,
      fingerprintId: null,
      rfidTagId: null,
      createdAt: serverTimestamp()
    });

    currentStudentId = docRef.id;

    // Reveal capture buttons, lock the create form
    captureRow.style.display = "flex";
    createStudentBtn.disabled = true;
    createStudentBtn.textContent = "Student Created";
    createStudentBtn.classList.remove("btn-primary");
    createStudentBtn.classList.add("btn-disabled");
  } catch (error) {
    console.error("Error creating student:", error);
    alert("Failed to create student. Please try again."); // TODO: replace with inline error UI if desired
  }
}

// ---- Capture Fingerprint / RFID ----
async function startCapture(captureType) {
  if (!currentStudentId) return;

  const button = captureType === "fingerprint"
    ? document.getElementById("captureFingerprintBtn")
    : document.getElementById("captureRfidBtn");

  const statusEl = captureType === "fingerprint"
    ? document.getElementById("fingerprintStatus")
    : document.getElementById("rfidStatus");

  if (button.disabled) return;

  button.disabled = true;
  statusEl.textContent = "Waiting for scan...";

  try {
    await setDoc(doc(db, "systemStatus", "current"), {
      enrollmentMode: true,
      enrollmentTarget: { studentId: currentStudentId, captureType },
      enrollmentResult: null
    }, { merge: true });

    const unsubscribe = onSnapshot(doc(db, "systemStatus", "current"), async (docSnap) => {
      const data = docSnap.data();
      if (!data || data.enrollmentResult === null || data.enrollmentResult === undefined) return;

      unsubscribe(); // detach as soon as we get a real result

      if (data.enrollmentResult === "success") {
        button.textContent = "✓ Captured";
        button.classList.remove("btn-secondary");
        button.classList.add("btn-success");
        statusEl.textContent = `${capitalize(captureType)} captured successfully.`;
      } else if (data.enrollmentResult === "duplicate") {
        const duplicateAlert = document.getElementById("duplicateAlert");
        duplicateAlert.querySelector("span").textContent =
          `⚠️ Duplicate allocation — this ${captureType} is already assigned to another student.`;
        duplicateAlert.style.display = "flex";

        button.disabled = false; // allow retry
        statusEl.textContent = "";
      }

      // Reset systemStatus/current after handling result
      try {
        await updateDoc(doc(db, "systemStatus", "current"), {
          enrollmentMode: false,
          enrollmentTarget: null,
          enrollmentResult: null
        });
      } catch (resetError) {
        console.error("Error resetting systemStatus:", resetError);
      }
    }, (error) => {
      console.error(`Error listening for ${captureType} result:`, error);
      button.disabled = false;
      statusEl.textContent = "Something went wrong. Please try again.";
    });
  } catch (error) {
    console.error(`Error starting ${captureType} capture:`, error);
    button.disabled = false;
    statusEl.textContent = "Failed to start capture. Please try again.";
  }
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}