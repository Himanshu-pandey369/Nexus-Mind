// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API,
  authDomain: "nexusmind369.firebaseapp.com",
  projectId: "nexusmind369",
  storageBucket: "nexusmind369.firebasestorage.app",
  messagingSenderId: "689942858329",
  appId: "1:689942858329:web:75f9be54ac7136a0f1ff48",
  measurementId: "G-QPEYH91E9E"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app)
export const googleProvide = new GoogleAuthProvider()