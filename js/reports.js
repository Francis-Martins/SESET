// reports.js
// Reports & Analysis — course + student attendance lookup.

import { requireAuth } from "./common.js";
import { getCourses, getStudents, getCourseAttendanceReport } from "./courses-service.js";

requireAuth();

let allStudents = [];
let selectedRegNo = null; // null = "All Students"

document.addEventListener("DOMContentLoaded", () => {
  loadCourseOptions();
  loadStudentsCache();

  document.getElementById("studentSearch").addEventListener("input", handleStudentSearchInput);
  document.getElementById("reportForm").addEventListener("submit", handleGenerateReport);

  // Close suggestions when clicking outside
  document.addEventListener("click", (e) => {
    const wrapper = document.getElementById("studentSearch").parentElement;
    if (!wrapper.contains(e.target)) {
      document.getElementById("studentSuggestions").style.display = "none";
    }
  });
});

async function loadCourseOptions() {
  const dropdown = document.getElementById("reportCourse");
  try {
    const courses = await getCourses();
    courses.forEach((course) => {
      const option = document.createElement("option");
      option.value = course.id;
      option.textContent = `${course.title} (${course.code})`;
      dropdown.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading courses:", error);
  }
}

async function loadStudentsCache() {
  try {
    allStudents = await getStudents();
  } catch (error) {
    console.error("Error loading students:", error);
  }
}

function handleStudentSearchInput(e) {
  const value = e.target.value.trim().toLowerCase();
  selectedRegNo = null; // typing clears any previous selection until a suggestion is picked

  const suggestionsBox = document.getElementById("studentSuggestions");

  if (!value) {
    suggestionsBox.style.display = "none";
    suggestionsBox.innerHTML = "";
    return;
  }

  const matches = allStudents.filter(
    (s) => s.name.toLowerCase().includes(value) || s.regNo.toLowerCase().includes(value)
  ).slice(0, 8);

  if (matches.length === 0) {
    suggestionsBox.innerHTML = `<div class="suggestion-item" style="color:#999;">No matches</div>`;
    suggestionsBox.style.display = "block";
    return;
  }

  suggestionsBox.innerHTML = "";
  matches.forEach((student) => {
    const item = document.createElement("div");
    item.className = "suggestion-item";
    item.textContent = `${student.name} — ${student.regNo}`;
    item.addEventListener("click", () => {
      document.getElementById("studentSearch").value = `${student.name} — ${student.regNo}`;
      selectedRegNo = student.regNo;
      suggestionsBox.style.display = "none";
    });
    suggestionsBox.appendChild(item);
  });
  suggestionsBox.style.display = "block";
}

async function handleGenerateReport(e) {
  e.preventDefault();

  const courseId = document.getElementById("reportCourse").value;
  if (!courseId) return;

  const tbody = document.getElementById("reportTableBody");
  tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#999;">Loading…</td></tr>`;

  try {
    const rows = await getCourseAttendanceReport(courseId, selectedRegNo);
    renderReportTable(rows);
  } catch (error) {
    console.error("Error generating report:", error);
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#999;">Failed to generate report.</td></tr>`;
  }
}

function renderReportTable(rows) {
  const tbody = document.getElementById("reportTableBody");
  tbody.innerHTML = "";

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#999;">No data found.</td></tr>`;
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.name}</td>
      <td>${row.regNo}</td>
      <td>${row.attended} / ${row.total}</td>
      <td>${row.percentage}%</td>
    `;
    tbody.appendChild(tr);
  });
}