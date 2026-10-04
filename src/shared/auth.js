// Auth guard and logout behavior.
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "../config/firebase.js";

// Call on any page that requires a logged-in user.
export function requireAuth() {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "../index.html";
    }
  });
}

function setupLogout() {
  const logoutLink = document.querySelector(".sidebar-logout a");
  if (!logoutLink) return;

  logoutLink.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await signOut(auth);
      window.location.href = "../index.html";
    } catch (error) {
      console.error("Error signing out:", error);
    }
  });
}

document.addEventListener("DOMContentLoaded", setupLogout);