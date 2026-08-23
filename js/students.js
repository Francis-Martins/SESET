// students.js
// Students page — wired to Firestore.

import { db, requireAuth } from "./common.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

requireAuth();

let studentsList = []; // holds the filtered (registered) students in memory

document.addEventListener("DOMContentLoaded", async () => {
  await loadStudents();

  const searchInput = document.getElementById("studentSearch");
  searchInput.addEventListener("input", (e) => {
    const filtered = filterStudents(e.target.value);
    renderStudentsTable(filtered);
  });
});

// ---- Load students with fingerprint OR rfid registered ----
async function loadStudents() {
  const tbody = document.getElementById("studentsTableBody");

  try {
    const snapshot = await getDocs(collection(db, "students"));

    const allStudents = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      allStudents.push({
        id: docSnap.id,
        name: data.name,
        regNo: data.regNo,
        fingerprintId: data.fingerprintId || null,
        rfidTagId: data.rfidTagId || null
      });
    });

    // Client-side filter: fingerprintId OR rfidTagId must be truthy
    studentsList = allStudents.filter(
      (s) => s.fingerprintId || s.rfidTagId
    );

    // Sort alphabetically by name
    studentsList.sort((a, b) => a.name.localeCompare(b.name));

    renderStudentsTable(studentsList);
  } catch (error) {
    console.error("Error loading students:", error);
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#999;">Failed to load students.</td></tr>`;
  }
}

// ---- Render ----
function renderStudentsTable(list) {
  const tbody = document.getElementById("studentsTableBody");
  tbody.innerHTML = "";

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#999;">No students found.</td></tr>`;
    return;
  }

  list.forEach((student) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${student.name}</td>
      <td>${student.regNo}</td>
      <td>${student.fingerprintId ? '<span class="icon-check">✓</span>' : '<span class="icon-cross">✗</span>'}</td>
      <td>${student.rfidTagId ? '<span class="icon-check">✓</span>' : '<span class="icon-cross">✗</span>'}</td>
    `;
    tbody.appendChild(row);
  });
}

// ---- Search / Filter (in-memory, no new Firestore query) ----
function filterStudents(queryStr) {
  const q = queryStr.trim().toLowerCase();
  if (!q) return studentsList;

  return studentsList.filter(
    (student) =>
      student.name.toLowerCase().includes(q) ||
      student.regNo.toLowerCase().includes(q)
  );
}