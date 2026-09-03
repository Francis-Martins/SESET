// lecture-history.js — Lecture History page only
import { requireAuth } from "./common.js";
import { getLectureHistory, getAttendanceForLecture } from "./courses-service.js";

requireAuth();

let allLectures = [];

document.addEventListener("DOMContentLoaded", () => {
  loadLectureHistory();
  document.getElementById("courseCodeFilter").addEventListener("change", handleFilterChange);
  document.getElementById("printAttendanceBtn").addEventListener("click", () => window.print());
});

async function loadLectureHistory() {
  const tbody = document.getElementById("lectureHistoryBody");
  tbody.innerHTML = "";

  try {
    allLectures = await getLectureHistory();
    populateCourseCodeFilter(allLectures);
    renderLectureRows(allLectures);
  } catch (error) {
    console.error("Error loading lecture history:", error);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#999;">Failed to load lecture history.</td></tr>`;
  }
}

function populateCourseCodeFilter(lectures) {
  const filter = document.getElementById("courseCodeFilter");
  const currentValue = filter.value;

  const codes = [...new Set(lectures.map((l) => l.courseCode).filter(Boolean))].sort();

  filter.innerHTML = `<option value="">All</option>`;
  codes.forEach((code) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = code;
    filter.appendChild(option);
  });

  filter.value = currentValue || "";
}

function handleFilterChange() {
  const selectedCode = document.getElementById("courseCodeFilter").value;
  const filtered = selectedCode
    ? allLectures.filter((l) => l.courseCode === selectedCode)
    : allLectures;
  renderLectureRows(filtered);
}

function renderLectureRows(lectures) {
  const tbody = document.getElementById("lectureHistoryBody");
  tbody.innerHTML = "";

  if (lectures.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#999;">No lecture history yet.</td></tr>`;
    return;
  }

  lectures.forEach((lecture) => {
    const startTime = lecture.startTime
      ? lecture.startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "—";
    const endTime = lecture.endTime
      ? lecture.endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "—";

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${lecture.courseCode}</td>
      <td>${lecture.title}</td>
      <td>${lecture.date}</td>
      <td>${startTime} - ${endTime}</td>
      <td><button class="btn btn-secondary open-btn" data-lecture-id="${lecture.id}">Open</button></td>
    `;
    tbody.appendChild(row);
  });

  document.querySelectorAll(".open-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const lectureId = e.target.dataset.lectureId;
      const lecture = allLectures.find((l) => l.id === lectureId);
      if (lecture) openAttendanceSheet(lecture);
    });
  });
}

async function openAttendanceSheet(lecture) {
  document.getElementById("sheetCourseCode").textContent = lecture.courseCode;
  document.getElementById("sheetLectureTitle").textContent = lecture.title;
  document.getElementById("sheetDate").textContent = lecture.date;

  const sheetBody = document.getElementById("attendanceSheetBody");
  sheetBody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#999;">Loading…</td></tr>`;

  const section = document.getElementById("attendanceSheetSection");
  section.style.display = "block";
  section.scrollIntoView({ behavior: "smooth" });

  try {
    const records = await getAttendanceForLecture(lecture.id);
    sheetBody.innerHTML = "";

    if (records.length === 0) {
      sheetBody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#999;">No attendance records for this lecture.</td></tr>`;
      return;
    }

    records.forEach((record) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${record.name}</td>
        <td>${record.regNumber}</td>
        <td>${record.time}</td>
        <td>${record.mode}</td>
      `;
      sheetBody.appendChild(row);
    });
  } catch (error) {
    console.error("Error loading attendance:", error);
    sheetBody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#999;">Failed to load attendance.</td></tr>`;
  }
}