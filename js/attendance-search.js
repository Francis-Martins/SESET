// attendance-search.js
// Attendance Search page — wired to Firestore.

import { db, requireAuth } from "./common.js";
import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

requireAuth();

let currentSort = "name"; // used only in course-only view
let currentCourseOnlyData = null; // cached for re-sort without re-querying

document.addEventListener("DOMContentLoaded", async () => {
  await populateCourseDropdown();

  document.getElementById("searchForm").addEventListener("submit", handleSearch);
  document.getElementById("printResultsBtn").addEventListener("click", () => {
    window.print();
  });
});

// ---- Populate course dropdown ----
async function populateCourseDropdown() {
  const courseSelect = document.getElementById("courseSelect");

  try {
    const snapshot = await getDocs(collection(db, "courses"));
    snapshot.forEach((docSnap) => {
      const course = docSnap.data();
      const option = document.createElement("option");
      option.value = docSnap.id;
      option.textContent = course.title;
      courseSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading courses:", error);
  }
}

// ---- Resolve a student by name/regNo text match ----
async function resolveStudent(queryStr) {
  const q = queryStr.trim().toLowerCase();
  if (!q) return null;

  try {
    const snapshot = await getDocs(collection(db, "students"));
    let found = null;

    snapshot.forEach((docSnap) => {
      if (found) return;
      const data = docSnap.data();
      if (
        data.name?.toLowerCase().includes(q) ||
        data.regNo?.toLowerCase() === q
      ) {
        found = { id: docSnap.id, ...data };
      }
    });

    return found;
  } catch (error) {
    console.error("Error resolving student:", error);
    return null;
  }
}

// ---- Count total lectures for a course (optionally within date range) ----
async function countTotalLectures(courseId, dateFrom, dateTo) {
  try {
    // NOTE: This query may require a Firestore composite index —
    // Firestore will provide a direct link in the browser console error to create it automatically.
    const q = query(collection(db, "lectures"), where("courseId", "==", courseId));
    const snapshot = await getDocs(q);

    let count = 0;
    snapshot.forEach((docSnap) => {
      const lecture = docSnap.data();
      if (isWithinDateRange(lecture.date, dateFrom, dateTo)) count++;
    });
    return count;
  } catch (error) {
    console.error("Error counting lectures:", error);
    return 0;
  }
}

function isWithinDateRange(dateStr, dateFrom, dateTo) {
  if (dateFrom && dateStr < dateFrom) return false;
  if (dateTo && dateStr > dateTo) return false;
  return true;
}

function pct(attended, total) {
  return total > 0 ? Math.round((attended / total) * 100) : 0;
}

// ---- Main search handler ----
async function handleSearch(e) {
  e.preventDefault();

  const studentQuery = document.getElementById("studentInput").value;
  const courseId = document.getElementById("courseSelect").value;
  const courseTitle = courseId
    ? document.getElementById("courseSelect").selectedOptions[0].textContent
    : "";
  const dateFrom = document.getElementById("dateFrom").value;
  const dateTo = document.getElementById("dateTo").value;

  const resultsArea = document.getElementById("resultsArea");
  const printBtn = document.getElementById("printResultsBtn");

  currentSort = "name";
  resultsArea.innerHTML = `<p style="color:#999;">Searching...</p>`;

  const student = await resolveStudent(studentQuery);

  if (student && courseId) {
    await renderStudentAndCourse(student, courseId, courseTitle, dateFrom, dateTo);
    printBtn.style.display = "inline-flex";
  } else if (student && !courseId) {
    await renderStudentOnly(student, dateFrom, dateTo);
    printBtn.style.display = "inline-flex";
  } else if (!student && courseId) {
    await renderCourseOnly(courseId, courseTitle, dateFrom, dateTo);
    printBtn.style.display = "inline-flex";
  } else {
    resultsArea.innerHTML = `<p style="color:#999;">Please enter a student name/reg no and/or select a course.</p>`;
    printBtn.style.display = "none";
  }
}

// ---- (a) Student + Course ----
async function renderStudentAndCourse(student, courseId, courseTitle, dateFrom, dateTo) {
  const resultsArea = document.getElementById("resultsArea");

  try {
    // NOTE: This query may require a Firestore composite index —
    // Firestore will provide a direct link in the browser console error to create it automatically.
    const q = query(
      collection(db, "attendanceRecords"),
      where("studentId", "==", student.id),
      where("courseId", "==", courseId)
    );
    const snapshot = await getDocs(q);

    const records = [];
    snapshot.forEach((docSnap) => {
      const r = docSnap.data();
      if (isWithinDateRange(r.date, dateFrom, dateTo)) records.push(r);
    });

    const total = await countTotalLectures(courseId, dateFrom, dateTo);
    const attended = records.length;
    const percentage = pct(attended, total);

    let html = `
      <p class="summary-line">${attended} / ${total} lectures attended — ${percentage}%</p>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Date</th><th>Time</th><th>Mode</th></tr></thead>
          <tbody>
    `;

    if (records.length === 0) {
      html += `<tr><td colspan="3" style="text-align:center;color:#999;">No attendance records found.</td></tr>`;
    } else {
      records
        .sort((a, b) => (a.date + a.time) > (b.date + b.time) ? 1 : -1)
        .forEach((r) => {
          const time = r.time?.toDate ? r.time.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
          html += `<tr><td>${r.date}</td><td>${time}</td><td>${capitalize(r.mode)}</td></tr>`;
        });
    }

    html += `</tbody></table></div>`;
    resultsArea.innerHTML = html;
  } catch (error) {
    console.error("Error loading student+course attendance:", error);
    resultsArea.innerHTML = `<p style="color:#999;">Failed to load results.</p>`;
  }
}

// ---- (b) Student only ----
async function renderStudentOnly(student, dateFrom, dateTo) {
  const resultsArea = document.getElementById("resultsArea");

  try {
    const q = query(collection(db, "attendanceRecords"), where("studentId", "==", student.id));
    const snapshot = await getDocs(q);

    const recordsByCourseId = {};
    snapshot.forEach((docSnap) => {
      const r = docSnap.data();
      if (!isWithinDateRange(r.date, dateFrom, dateTo)) return;
      if (!recordsByCourseId[r.courseId]) {
        recordsByCourseId[r.courseId] = { courseTitle: r.courseTitle, count: 0 };
      }
      recordsByCourseId[r.courseId].count++;
    });

    const courseIds = Object.keys(recordsByCourseId);

    if (courseIds.length === 0) {
      resultsArea.innerHTML = `<p style="color:#999;">No attendance records found for this student.</p>`;
      return;
    }

    let html = "";
    for (const courseId of courseIds) {
      const { courseTitle, count } = recordsByCourseId[courseId];
      const total = await countTotalLectures(courseId, dateFrom, dateTo);
      const percentage = pct(count, total);

      html += `
        <div class="course-card">
          <div><strong>${courseTitle}</strong></div>
          <div>${count} / ${total} — ${percentage}%</div>
        </div>
      `;
    }

    resultsArea.innerHTML = html;
  } catch (error) {
    console.error("Error loading student-only attendance:", error);
    resultsArea.innerHTML = `<p style="color:#999;">Failed to load results.</p>`;
  }
}

// ---- (c) Course only ----
async function renderCourseOnly(courseId, courseTitle, dateFrom, dateTo) {
  const resultsArea = document.getElementById("resultsArea");

  try {
    // Get attendance counts per student for this course
    const q = query(collection(db, "attendanceRecords"), where("courseId", "==", courseId));
    const snapshot = await getDocs(q);

    const attendedByStudentId = {};
    snapshot.forEach((docSnap) => {
      const r = docSnap.data();
      if (!isWithinDateRange(r.date, dateFrom, dateTo)) return;
      attendedByStudentId[r.studentId] = (attendedByStudentId[r.studentId] || 0) + 1;
    });

    // Fetch ALL students so 0% cases are visible
    const studentsSnapshot = await getDocs(collection(db, "students"));
    const roster = [];
    studentsSnapshot.forEach((docSnap) => {
      const s = docSnap.data();
      roster.push({
        name: s.name,
        regNo: s.regNo,
        attended: attendedByStudentId[docSnap.id] || 0
      });
    });

    const total = await countTotalLectures(courseId, dateFrom, dateTo);

    currentCourseOnlyData = { roster, total, courseId, courseTitle };
    renderCourseOnlyTable();
  } catch (error) {
    console.error("Error loading course-only attendance:", error);
    resultsArea.innerHTML = `<p style="color:#999;">Failed to load results.</p>`;
  }
}

function renderCourseOnlyTable() {
  const resultsArea = document.getElementById("resultsArea");
  if (!currentCourseOnlyData) return;

  const { roster, total } = currentCourseOnlyData;

  let sortedRoster = [...roster];
  if (currentSort === "name") {
    sortedRoster.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    sortedRoster.sort((a, b) => (b.attended / (total || 1)) - (a.attended / (total || 1)));
  }

  let html = `
    <div style="margin-bottom:12px;">
      <button class="btn btn-secondary btn-sm no-print" id="sortToggleBtn">
        Sort by ${currentSort === "name" ? "Percentage (High → Low)" : "Name (A → Z)"}
      </button>
    </div>
    <div class="table-wrapper">
      <table>
        <thead><tr><th>Name</th><th>Reg No</th><th>Fraction</th><th>Percentage</th></tr></thead>
        <tbody>
  `;

  if (sortedRoster.length === 0) {
    html += `<tr><td colspan="4" style="text-align:center;color:#999;">No students found.</td></tr>`;
  } else {
    sortedRoster.forEach((s) => {
      const percentage = pct(s.attended, total);
      html += `<tr><td>${s.name}</td><td>${s.regNo}</td><td>${s.attended} / ${total}</td><td>${percentage}%</td></tr>`;
    });
  }

  html += `</tbody></table></div>`;
  resultsArea.innerHTML = html;

  document.getElementById("sortToggleBtn").addEventListener("click", () => {
    currentSort = currentSort === "name" ? "percentage" : "name";
    renderCourseOnlyTable();
  });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}