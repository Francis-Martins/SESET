// courses.js — Courses page only
import { requireAuth } from "./common.js";
import { getCourses, createCourse, isCourseCodeTaken } from "./courses-service.js";
requireAuth();

document.addEventListener("DOMContentLoaded", () => {
  loadCourses();
  document.getElementById("createCourseForm").addEventListener("submit", handleCreateCourse);
});

async function loadCourses() {
  const tbody = document.getElementById("coursesTableBody");
  tbody.innerHTML = "";

  try {
    const courses = await getCourses();
    if (courses.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:#999;">No courses yet.</td></tr>`;
      return;
    }
    courses.forEach((course) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${course.title}</td>
        <td>${course.code}</td>
        <td>${course.createdAt ? course.createdAt.toLocaleDateString() : "—"}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error("Error loading courses:", error);
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:#999;">Failed to load courses.</td></tr>`;
  }
}

async function handleCreateCourse(e) {
  e.preventDefault();
  const titleInput = document.getElementById("courseTitle");
  const codeInput = document.getElementById("courseCode");
  const title = titleInput.value.trim();
  const code = codeInput.value.trim();
  if (!title || !code) return;

  try {
    const taken = await isCourseCodeTaken(code);
    if (taken) {
      alert(`Course code "${code}" is already in use. Please choose a different code.`);
      return;
    }

    await createCourse(title, code);
    titleInput.value = "";
    codeInput.value = "";
    await loadCourses();
  } catch (error) {
    console.error("Error creating course:", error);
    alert("Failed to create course. Please try again.");
  }
}