// Single place where Firebase is configured and initialized.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyCvc2hMrzhWS4nxkLxJdiXyzdrmd_qi2XA",
  authDomain: "attendancesystem2-4f5db.firebaseapp.com",
  databaseURL: "https://attendancesystem2-4f5db-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "attendancesystem2-4f5db",
  storageBucket: "attendancesystem2-4f5db.firebasestorage.app",
  messagingSenderId: "517801412167",
  appId: "1:517801412167:web:d786bece2383dfa0b7d362"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);