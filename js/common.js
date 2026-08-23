// common.js
// Shared across all pages: Firebase init, auth guard, sidebar toggle, logout.

// TODO: Firebase config — paste actual keys here
const firebaseConfig = {
 apiKey: "AIzaSyCk3Qt5UbIn4YpNP7gitLGG0W4lOH5P3so",
    authDomain: "ele-tech.firebaseapp.com",
    projectId: "ele-tech",
    storageBucket: "ele-tech.firebasestorage.app",
    messagingSenderId: "859089167137",
    appId: "1:859089167137:web:dc9e0c8a4a14e24bb05460",
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ---- Auth Guard ----
// Call this on any page that requires a logged-in user.
// Redirects to index.html (login) if no user is authenticated.
export function requireAuth() {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "index.html";
    }
  });
}

// ---- Sidebar Toggle (mobile drawer) ----
function setupSidebarToggle() {
  const hamburgerBtn = document.getElementById("hamburgerBtn");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");

  if (!hamburgerBtn || !sidebar || !overlay) return;

  function openSidebar() {
    sidebar.classList.add("open");
    overlay.classList.add("visible");
  }

  function closeSidebar() {
    sidebar.classList.remove("open");
    overlay.classList.remove("visible");
  }

  hamburgerBtn.addEventListener("click", openSidebar);
  overlay.addEventListener("click", closeSidebar);
}

// ---- Logout ----
function setupLogout() {
  const logoutLink = document.querySelector(".sidebar-logout a");
  if (!logoutLink) return;

  logoutLink.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await signOut(auth);
      window.location.href = "index.html";
    } catch (error) {
      console.error("Error signing out:", error);
    }
  });
}

// ---- Init shared UI behavior on every page that loads this file ----
document.addEventListener("DOMContentLoaded", () => {
  setupSidebarToggle();
  setupLogout();
});