// login.js
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
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// This page does not include common.js, so Firebase is initialized here directly.
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