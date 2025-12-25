// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBanmJiWGLLw41U8TzhM3TG_Ho22nprWlU",
  authDomain: "checkincheckout-c87c4.firebaseapp.com",
  projectId: "checkincheckout-c87c4",
  storageBucket: "checkincheckout-c87c4.firebasestorage.app",
  messagingSenderId: "775526602036",
  appId: "1:775526602036:web:c91c46f7a5b2c44692c161",
  measurementId: "G-50HLM9TLMF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

// Helper function to ensure user is authenticated
export const ensureAuth = async () => {
  return new Promise((resolve, reject) => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      unsubscribe();
      if (user) {
        resolve(user);
      } else {
        reject(new Error('User not authenticated'));
      }
    });
  });
};

export { app, analytics, db, auth };
