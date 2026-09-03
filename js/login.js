// login.js
const firebaseConfig = {
  apiKey: "AIzaSyCvc2hMrzhWS4nxkLxJdiXyzdrmd_qi2XA",
  authDomain: "attendancesystem2-4f5db.firebaseapp.com",
  databaseURL: "https://attendancesystem2-4f5db-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "attendancesystem2-4f5db",
  storageBucket: "attendancesystem2-4f5db.firebasestorage.app",
  messagingSenderId: "517801412167",
  appId: "1:517801412167:web:d786bece2383dfa0b7d362"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const errorBox = document.getElementById("loginError");

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const email = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    errorBox.style.display = "none";
    errorBox.textContent = "";

    signInWithEmailAndPassword(auth, email, password)
      .then(() => {
        window.location.href = "courses.html";
      })
      .catch((error) => {
        errorBox.textContent = getFriendlyError(error.code);
        errorBox.style.display = "block";
      });
  });
});

function getFriendlyError(code) {
  switch (code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    default:
      return "Login failed. Please try again.";
  }
}