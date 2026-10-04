// create-session.js — Create Session page only
import { requireAuth } from "../shared/auth.js";
import { getCourses, startLectureSession } from "../services/courses-service.js";

import { app } from "../config/firebase.js";
import { getDatabase, ref, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const rtdb = getDatabase(app);
requireAuth();

document.addEventListener("DOMContentLoaded", () => {
  loadCourseOptions();
  document.getElementById("startSessionForm").addEventListener("submit", handleStartSession);
});

async function loadCourseOptions() {
  const dropdown = document.getElementById("sessionCourse");
  dropdown.innerHTML = "";

  try {
    const courses = await getCourses();

    if (courses.length === 0) {
      dropdown.innerHTML = `<option value="">No courses available</option>`;
      return;
    }

    dropdown.innerHTML = `<option value="">Select a course</option>`;
    courses.forEach((course) => {
      const option = document.createElement("option");
      option.value = course.id;
      option.textContent = course.title;
      option.dataset.title = course.title;
      option.dataset.code = course.code;
      dropdown.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading courses:", error);
    dropdown.innerHTML = `<option value="">Failed to load courses</option>`;
  }
}

let isStarting = false;

async function handleStartSession(e) {
  e.preventDefault();
  if (isStarting) return; // ignore extra clicks while a session is being created

  const courseSelect = document.getElementById("sessionCourse");
  const courseId = courseSelect.value;
  const selectedOption = courseSelect.selectedOptions[0];
  const courseTitle = selectedOption?.dataset.title || selectedOption?.textContent;
  const courseCode = selectedOption?.dataset.code || "";

  const lectureTitle = document.getElementById("lectureTitle").value.trim();
  const date = document.getElementById("lectureDate").value;
  const startTime = document.getElementById("startTime").value;
  const endTime = document.getElementById("endTime").value;

  if (!courseId || !lectureTitle || !date || !startTime || !endTime) return;

  // Lock the button so a second click can't create another lecture
  isStarting = true;
  const submitBtn = e.submitter || e.target.querySelector("button");
  const originalLabel = submitBtn ? submitBtn.textContent : "";
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Starting…";
  }

  try {
    // Clear any leftover attendance records before starting the new session
    await remove(ref(rtdb, "attendance"));

    await startLectureSession({ courseId, courseTitle, courseCode, lectureTitle, date, startTime, endTime });
    window.location.href = "live-session.html";
  } catch (error) {
    console.error("Error starting session:", error);
    showSessionError("Failed to start session. Please try again.");
    // Unlock so the user can retry after a failure
    isStarting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
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
// If the browser restores this page from its back/forward cache, reload it
// so the Start button isn't left stuck on "Starting…".
window.addEventListener("pageshow", (e) => {
  if (e.persisted) location.reload();
});