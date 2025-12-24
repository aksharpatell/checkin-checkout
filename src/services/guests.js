import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

/**
 * Add a new guest to Firestore
 * નવો યાત્રી ઉમેરો
 */
export async function addGuest(name) {
  if (!name || !name.trim()) {
    throw new Error("Invalid guest name");
  }

  return await addDoc(collection(db, "guests"), {
    name: name.trim(),
    active: true,
    createdAt: serverTimestamp(),
  });
}
