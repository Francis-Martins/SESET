// courses.js
// Courses & Lectures page — wired to Firestore.
// TODO: Firebase — collections used: courses, lectures, systemStatus/current

import { auth, db, requireAuth } from "./common.js";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

requireAuth();

document.addEventListener("DOMContentLoaded", () => {
  loadCourses();
  loadLectureHistory();

  document.getElementById("createCourseForm").addEventListener("submit", handleCreateCourse);
  document.getElementById("startSessionForm").addEventListener("submit", handleStartSession);
});

// ---- Load Courses (table + dropdown) ----
async function loadCourses() {
  const tbody = document.getElementById("coursesTableBody");
  const dropdown = document.getElementById("sessionCourse");

  tbody.innerHTML = "";
  dropdown.innerHTML = "";

  try {
    const snapshot = await getDocs(collection(db, "courses"));

    if (snapshot.empty) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:#999;">No courses yet.</td></tr>`;
      return;
    }

    snapshot.forEach((docSnap) => {
      const course = docSnap.data();
      const courseId = docSnap.id;
      const code = generateCourseCode(course.title, courseId);
      const dateAdded = course.createdAt
        ? course.createdAt.toDate().toLocaleDateString()
        : "—";

      // Table row
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${course.title}</td>
        <td>${code}</td>
        <td>${dateAdded}</td>
      `;
      tbody.appendChild(row);

      // Dropdown option
      const option = document.createElement("option");
      option.value = courseId;
      option.textContent = course.title;
      option.dataset.title = course.title;
      dropdown.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading courses:", error);
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:#999;">Failed to load courses.</td></tr>`;
  }
}

function generateCourseCode(title, docId) {
  const letters = title.replace(/[^a-zA-Z]/g, "").substring(0, 3).toUpperCase();
  const shortId = docId.substring(0, 3).toUpperCase();
  return `${letters}${shortId}`;
}

// ---- Create New Course ----
async function handleCreateCourse(e) {
  e.preventDefault();

  const titleInput = document.getElementById("courseTitle");
  const title = titleInput.value.trim();
  if (!title) return;

  try {
    await addDoc(collection(db, "courses"), {
      title: title,
      createdAt: serverTimestamp()
    });

    titleInput.value = "";
    await loadCourses(); // refresh table + dropdown
  } catch (error) {
    console.error("Error creating course:", error);
    alert("Failed to create course. Please try again."); // TODO: replace with inline error UI if desired
  }
}

// ---- Start New Lecture Session ----
async function handleStartSession(e) {
  e.preventDefault();

  const courseSelect = document.getElementById("sessionCourse");
  const courseId = courseSelect.value;
  const courseTitle = courseSelect.selectedOptions[0]?.dataset.title || courseSelect.selectedOptions[0]?.textContent;

  const lectureTitle = document.getElementById("lectureTitle").value.trim();
  const date = document.getElementById("lectureDate").value;
  const startTimeStr = document.getElementById("startTime").value;
  const endTimeStr = document.getElementById("endTime").value;

  if (!courseId || !lectureTitle || !date || !startTimeStr || !endTimeStr) return;

  try {
    const startDate = new Date(`${date}T${startTimeStr}`);
    const endDate = new Date(`${date}T${endTimeStr}`);

    const lectureRef = await addDoc(collection(db, "lectures"), {
      courseId,
      courseTitle,
      title: lectureTitle,
      date,
      startTime: Timestamp.fromDate(startDate),
      endTime: Timestamp.fromDate(endDate),
      status: "active",
      createdAt: serverTimestamp()
    });

    await setDoc(doc(db, "systemStatus", "current"), {
      sessionActive: true,
      lectureId: lectureRef.id,
      courseId,
      lectureTitle,
      courseTitle,
      sessionEndTime: Timestamp.fromDate(endDate)
    });

    window.location.href = "live-session.html";
  } catch (error) {
    console.error("Error starting session:", error);
    showSessionError("Failed to start session. Please try again.");
  }
}

function showSessionError(message) {
  let errorBox = document.getElementById("sessionError");
  if (!errorBox) {
    errorBox = document.createElement("p");
    errorBox.id = "sessionError";
    errorBox.className = "alert alert-warning";
    document.getElementById("startSessionForm").appendChild(errorBox);
  }
  errorBox.textContent = message;
  errorBox.style.display = "block";
}

// ---- Load Lecture History ----
async function loadLectureHistory() {
  const tbody = document.getElementById("lectureHistoryBody");
  tbody.innerHTML = "";

  try {
    const q = query(collection(db, "lectures"), orderBy("date", "desc"), orderBy("startTime", "desc"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#999;">No lecture history yet.</td></tr>`;
      return;
    }

    snapshot.forEach((docSnap) => {
      const lecture = docSnap.data();
      const startTime = lecture.startTime?.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || "—";
      const endTime = lecture.endTime?.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || "—";

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${lecture.courseTitle}</td>
        <td>${lecture.title}</td>
        <td>${lecture.date}</td>
        <td>${startTime} - ${endTime}</td>
        <td><span class="badge badge-${lecture.status}">${capitalize(lecture.status)}</span></td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error("Error loading lecture history:", error);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#999;">Failed to load lecture history.</td></tr>`;
  }
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}