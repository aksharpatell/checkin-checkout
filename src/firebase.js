import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCkn3eIQCeCfRL5IicisiqCADDLFCC4Z6w",
  authDomain: "temple-rooms.firebaseapp.com",
  projectId: "temple-rooms",
  storageBucket: "temple-rooms.appspot.com",
  messagingSenderId: "266367592056",
  appId: "1:266367592056:web:b6f419943430f1e8bdef8d"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

export async function ensureAuth() {
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }
}
