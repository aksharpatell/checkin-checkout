import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export async function addGuest(guestName) {
  try {
    const docRef = await addDoc(collection(db, 'guests'), {
      name: guestName,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding guest:", error);
    throw error;
  }
}