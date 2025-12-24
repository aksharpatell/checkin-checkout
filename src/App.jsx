import React, { useState, useEffect, useMemo, useCallback } from 'react';
// ====================================================================
// ૧. કોન્સ્ટન્ટ્સ અને યુટિલિટી ફંક્શન્સ (Constants and Utility Functions)
// ====================================================================
import { db, auth, ensureAuth } from "./firebase";
import { addGuest } from "./services/guests";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  addDoc,
  serverTimestamp
} from "firebase/firestore";
import logo from './assets/sardhar dham logo.png';
import Login from './login';
const UTARAS = {
  gadhpurdham_1: {
    label: "GadhpurDham - 1",
    rooms: 170,
    capacity: 6,
  },
  gadhpurdham_2: {
    label: "GadhpurDham - 2",
    rooms: 300,
    capacity: 6,
  },
  gadhpurdham_3: {
    label: "GadhpurDham - 3",
    rooms: 150,
    capacity: 8,
  },
  svyam_sevak_utara: {
    label: "Svyam Sevak Utara",
    rooms: 60,
    capacity: 20,
  },
  mandir_utara: {
    label: "Mandir Utara",
    rooms: 50,
    capacity: 6,
  },
};

const UTARA_CONFIG = {
  gadhpurdham_1: { rooms: 170, capacity: 6 },
  gadhpurdham_2: { rooms: 300, capacity: 6 },
  gadhpurdham_3: { rooms: 150, capacity: 8 },
  svyam_sevak_utara: { rooms: 60, capacity: 20 },
  mandir_utara: { rooms: 50, capacity: 6 },
  sarangpur_utara: { rooms: 250, capacity: 6 },
};


// ડેટાબેઝ પાથ માટેની કી
const HISTORY_COLLECTION = 'historyLog';
const CHECKIN_HISTORY_COLLECTION = 'checkInHistory';
const apiKey = "";

// સમયગાળો (Duration) ગણવા માટેનું ફંક્શન
const calculateDuration = (checkInTime) => {
  if (!checkInTime) return 'N/A';
  const now = Date.now();
  // Firestore stores timestamps as strings or Timestamp objects; we assume ISO string here
  const checkIn = new Date(checkInTime).getTime();
  const diff = now - checkIn;

  if (diff < 0) return 'Error';

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const remainingHours = hours % 24;
  const remainingMinutes = minutes % 60;

  const parts = [];
  if (days > 0) parts.push(`${days} દિવસ`);
  if (remainingHours > 0) parts.push(`${remainingHours} કલાક`);
  if (remainingMinutes > 0 || parts.length === 0) parts.push(`${remainingMinutes} મિનિટ`);

  return parts.join(' ');
};

// સરળ ફઝી સર્ચ (Simple Fuzzy Search)
const fuzzyMatch = (text, query) => {
  if (!query) return true;
  const t = text.toLowerCase();
  const q = query.toLowerCase().trim();
  if (t.includes(q)) return true;
  const queryWords = q.split(/\s+/).filter(w => w.length > 0);
  return queryWords.every(word => t.includes(word));
};

// એક્સપોનેન્શિયલ બેકઓફ સાથે API કોલ (Exponential Backoff API Call)
async function fetchWithRetry(url, options, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return await response.json();
      } else {
        const errorText = await response.text();
        console.error(`Attempt ${i + 1}: API call failed with status ${response.status}. Error: ${errorText}`);
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          // Client errors (except rate limiting), don't retry
          throw new Error(`Client error: ${response.statusText}`);
        }
      }
    } catch (error) {
      console.error(`Attempt ${i + 1}: Fetch error:`, error);
      if (i === maxRetries - 1) throw error;
    }
    // Exponential backoff delay
    const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

// ====================================================================
// ૨. કસ્ટમ મોડલ કમ્પોનન્ટ (Custom Modal Component)
// ====================================================================

const CustomModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText, cancelText, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border-2 border-orange-300">
        <div className="p-6">
          <h3 className={`text-2xl font-bold mb-3 ${onConfirm ? 'text-red-700' : 'text-transparent bg-clip-text bg-gradient-to-r from-orange-700 to-red-700'}`}>{title}</h3>
          <p className="text-gray-800 mb-4 font-medium">{message}</p>
          {children}
        </div>
        <div className="flex justify-end p-4 bg-gradient-to-r from-orange-100 to-red-100 border-t-2 border-orange-300">
          {onConfirm ? (
            <>
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="px-5 py-2 mr-3 text-sm font-semibold text-gray-700 bg-white rounded-lg hover:bg-gray-100 transition shadow-md border-2 border-gray-300"
                >
                  {cancelText || 'રદ કરો'}
                </button>
              )}
              <button
                onClick={onConfirm}
                className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-red-600 to-red-700 rounded-lg hover:from-red-700 hover:to-red-800 transition shadow-lg"
              >
                {confirmText || 'ખાતરી કરો'}
              </button>
            </>
          ) : (
            onCancel && (
              <button
                onClick={onCancel}
                className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-orange-600 to-red-600 rounded-lg hover:from-orange-700 hover:to-red-700 transition shadow-lg"
              >
                {cancelText || 'બંધ કરો'}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};

// ====================================================================
// ૩. મુખ્ય એપ્લિકેશન કમ્પોનન્ટ (Main Application Component - App)
// ====================================================================

export default function App() {
  const UTARA_CONFIG = {
    gadhpurdham_1: { label: "GadhpurDham - 1", rooms: 170, capacity: 6 },
    gadhpurdham_2: { label: "GadhpurDham - 2", rooms: 300, capacity: 6 },
    gadhpurdham_3: { label: "GadhpurDham - 3", rooms: 150, capacity: 8 },
    svyam_sevak:   { label: "Svyam Sevak Utara", rooms: 60, capacity: 20 },
    mandir_utara:  { label: "મંદિર ઉતારા", rooms: 50, capacity: 6 },
    sarangpur_utara: { label: "સારંગપુર ઉતારા", rooms: 250, capacity: 6 },
  };
  const [selectedUtara, setSelectedUtara] = useState(null); // null means home page
  const [rooms, setRooms] = useState([]);
  const [historyLog, setHistoryLog] = useState([]);
  const [checkInHistory, setCheckInHistory] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [durationTick, setDurationTick] = useState(Date.now());
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const utaraConfig = useMemo(() => 
    selectedUtara ? (UTARA_CONFIG[selectedUtara] || UTARA_CONFIG.gadhpurdham_1) : null,
    [selectedUtara]
  );
  const TOTAL_ROOMS = utaraConfig?.rooms || 0;
  const ROOM_CAPACITY = utaraConfig?.capacity || 15;
  const UTARA_LABEL = utaraConfig?.label || '';

  const [allUtaraRooms, setAllUtaraRooms] = useState({
    gadhpurdham_1: [],
    gadhpurdham_2: [],
    gadhpurdham_3: [],
    svyam_sevak: [],
    mandir_utara: [],
    sarangpur_utara: [],
  });
  
  const handleLogin = (userData) => {
    setCurrentUser(userData);
    setIsAuthenticated(true);
    
    // Save to localStorage to persist across refreshes
    localStorage.setItem('currentUser', JSON.stringify(userData));
    localStorage.setItem('isAuthenticated', 'true');
    
    // If user has specific utara access (not admin), auto-select that utara
    if (userData.role === 'manager' && userData.access !== 'all') {
      setSelectedUtara(userData.access);
    }
  };
  
  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setSelectedUtara(null);
    
    // Clear localStorage
    localStorage.removeItem('currentUser');
    localStorage.removeItem('isAuthenticated');
  };

  // Check for saved login on component mount
useEffect(() => {
  const savedUser = localStorage.getItem('currentUser');
  const savedAuth = localStorage.getItem('isAuthenticated');
  
  if (savedAuth === 'true' && savedUser) {
    try {
      const userData = JSON.parse(savedUser);
      setCurrentUser(userData);
      setIsAuthenticated(true);
      
      // Auto-select utara if manager with specific access
      if (userData.role === 'manager' && userData.access !== 'all') {
        setSelectedUtara(userData.access);
      }
    } catch (error) {
      console.error('Error loading saved user:', error);
      localStorage.removeItem('currentUser');
      localStorage.removeItem('isAuthenticated');
    }
  }
}, []);

  useEffect(() => {
    ensureAuth().then((uid) => {
      setUserId(uid);
      setIsAuthReady(true
      );
    }).catch((err) => {
      console.error("Auth failed:", err);
      setIsAuthReady(true); // still allow app to load
    });
  }, []);
  
  

  // મોડલ સ્ટેટ્સ
  const [modalState, setModalState] = useState({
    isOpen: false,
    type: 'details', // 'details', 'confirmation', 'error'
    data: null,
  });

  const closeModal = () => {
    // Only close confirmation/error modals, keep room details open
    if (modalState.type === 'confirmation' || modalState.type === 'error') {
      setModalState({ isOpen: false, type: null, data: null });
      // Don't reset selectedRoomId - keep room modal open
    } else {
      // Closing the room details modal
      setModalState({ isOpen: false, type: null, data: null });
      setSearchQuery('');
      setSelectedRoomId(null);
    }
  };

  const openRoomDetailsModal = (roomId) => {
    setSelectedRoomId(roomId);
    setModalState({ 
      isOpen: true, 
      type: 'details', 
      data: null // We'll get live data from rooms array
    });
  };

  // ડેટા લોડિંગ (Firestore onSnapshot)
  useEffect(() => {
    if (!db || !isAuthReady) {
      return;
    }
    
    // If no utara selected (home page), load all utara data for global search
    if (!selectedUtara) {
      setIsLoading(false);
      
      const unsubscribers = [];
      
      Object.keys(UTARA_CONFIG).forEach(utaraKey => {
        const roomDocRef = doc(db, "managerState", `roomsData_${utaraKey}`);
        
        const unsubscribe = onSnapshot(
          roomDocRef,
          (docSnap) => {
            if (docSnap.exists() && docSnap.data().rooms) {
              setAllUtaraRooms(prev => ({
                ...prev,
                [utaraKey]: docSnap.data().rooms
              }));
            }
          },
          (error) => {
            console.error(`Error loading ${utaraKey}:`, error);
          }
        );
        
        unsubscribers.push(unsubscribe);
      });
      
      return () => {
        unsubscribers.forEach(unsub => unsub());
      };
    }
    
    // Load specific utara data when selected
    const roomDocRef = doc(db, "managerState", `roomsData_${selectedUtara}`);
  
    const unsubscribeRooms = onSnapshot(
      roomDocRef,
      (docSnap) => {
        if (docSnap.exists() && docSnap.data().rooms) {
          setRooms(docSnap.data().rooms);
        } else {
          const initialRooms = Array.from({ length: TOTAL_ROOMS }, (_, i) => ({
            id: i + 1,
            families: [],
          }));
  
          setRooms(initialRooms);
  
          setDoc(
            roomDocRef,
            { rooms: initialRooms, lastUpdated: new Date().toISOString() },
            { merge: true }
          );
        }
  
        setIsLoading(false);
      },
      (error) => {
        console.error("Rooms snapshot error:", error);
        setIsLoading(false);
      }
    );
  
    const historyColRef = collection(db, HISTORY_COLLECTION);

const unsubscribeHistory = onSnapshot(historyColRef, (snap) => {
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  data.sort((a, b) => new Date(b.checkOutTime) - new Date(a.checkOutTime));
  setHistoryLog(data);
});

const checkInHistoryColRef = collection(db, CHECKIN_HISTORY_COLLECTION);

const unsubscribeCheckInHistory = onSnapshot(checkInHistoryColRef, (snap) => {
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  data.sort((a, b) => new Date(b.checkInTime) - new Date(a.checkInTime));
  setCheckInHistory(data);
});

return () => {
  unsubscribeRooms();
  unsubscribeHistory();
  unsubscribeCheckInHistory();
};
  }, [db, isAuthReady, selectedUtara, TOTAL_ROOMS]);
    

  // રીઅલ-ટાઇમ ડ્યુરેશન અપડેટ માટે દર મિનિટે ટિક (Tick)
  useEffect(() => {
    const interval = setInterval(() => {
      setDurationTick(Date.now());
    }, 60000); // 60 સેકન્ડ

    return () => clearInterval(interval);
  }, []);

  // ====================================================================
  // ૪. રૂમ મેનેજમેન્ટ લોજિક (Room Management Logic - Firestore Updates)
  // ====================================================================
  
  const updateRoomState = async (updatedRooms) => {
    if (!db) return;
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const roomDocRef = doc(db, "managerState", `roomsData_${selectedUtara}`);

    
    try {
      
      await setDoc(roomDocRef, { rooms: updatedRooms, lastUpdated: new Date().toISOString() });
      // UI will update automatically via onSnapshot
      
      // DON'T update modal data while user is filling form
      // if (selectedRoomId) {
      //   const updatedRoom = updatedRooms.find(r => r.id === selectedRoomId);
      //   if (updatedRoom) {
      //     setModalState(prev => ({ ...prev, data: updatedRoom }));
      //   }
      // }

    } catch (error) {
      console.error("Error updating room state in Firestore:", error);
      setModalState({
        isOpen: true,
        type: 'error',
        data: `ડેટા સેવ કરવામાં ભૂલ: ${error.message}`,
      });
    }
  };


  // નવું ફેમિલી ઉમેરવું
  const addFamily = (roomId, familyData) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    const currentMembers = room.families.reduce((sum, f) => sum + f.members, 0);
    if (currentMembers + familyData.members > ROOM_CAPACITY) {
      setModalState({
        isOpen: true,
        type: 'error',
        data: `ક્ષમતાની ભૂલ: રૂમ ${roomId} માં માત્ર ${ROOM_CAPACITY - currentMembers} વ્યક્તિની જગ્યા બાકી છે.`,
      });
      return;
    }

    const checkInTime = familyData.status === 'CheckedIn' ? new Date().toISOString() : null;

const newFamily = {
  id: crypto.randomUUID(),
  ...familyData,
  checkInTime: checkInTime,
};

// Save to check-in history if status is CheckedIn
if (familyData.status === 'CheckedIn') {
  try {
    if (db) {
      addDoc(collection(db, CHECKIN_HISTORY_COLLECTION), {
        roomNumber: roomId,
        name: familyData.name,
        members: familyData.members,
        checkInTime: checkInTime,
        phone: familyData.phone || 'N/A',
        village: familyData.village || 'N/A',
        address: familyData.address || 'N/A',
        utara: selectedUtara,  // ← ADD THIS LINE
      });
    }
  } catch (e) {
    console.error("Error adding check-in history log:", e);
  }
}

const updatedRooms = rooms.map(r =>
  r.id === roomId
    ? { ...r, families: [...r.families, newFamily] }
    : r
);
updateRoomState(updatedRooms);
  };

  // ફેમિલી ડેટા અપડેટ કરવું
  const updateFamily = (roomId, familyId, updates) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    let capacityError = false;
    const updatedRooms = rooms.map(r => {
      if (r.id === roomId) {
        const updatedFamilies = r.families.map(f => {
          if (f.id === familyId) {
            let newCheckInTime = f.checkInTime;

            // સ્ટેટસ ટૉગલ
            if (updates.status && f.status !== updates.status) {
              if (updates.status === 'CheckedIn' && !f.checkInTime) {
                newCheckInTime = new Date().toISOString();
              } else if (updates.status === 'Reserved') {
                newCheckInTime = null; // Reserved status removes check-in time
              }
            }

            // વ્યક્તિઓની સંખ્યા અપડેટ
            const newMembers = updates.members !== undefined ? updates.members : f.members;
            const otherMembers = r.families.filter(item => item.id !== familyId).reduce((sum, item) => sum + item.members, 0);

            if (otherMembers + newMembers > ROOM_CAPACITY) {
              capacityError = true;
              return f; // અપડેટ ન કરો
            }

            return { ...f, ...updates, members: newMembers, checkInTime: newCheckInTime };
          }
          return f;
        });

        if (capacityError) {
          setModalState({
            isOpen: true,
            type: 'error',
            data: `ક્ષમતાની ભૂલ: રૂમ ${roomId} માં કુલ વ્યક્તિઓ રૂમની મહત્તમ ક્ષમતા (૫) કરતાં વધી જાય છે.`,
          });
          return r; // ભૂલ હોય તો રૂમ ડેટા બદલશો નહીં
        }
        return { ...r, families: updatedFamilies };
      }
      return r;
    });

    if (!capacityError) {
        updateRoomState(updatedRooms);
    }
  };


  // ફેમિલી ચેક-આઉટ કરવું
  const handleCheckOut = (roomId, familyId) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    const familyToCheckout = room.families.find(f => f.id === familyId);
    if (!familyToCheckout) return;

    // કન્ફર્મેશન મોડલ ખોલો
    setModalState({
      isOpen: true,
      type: 'confirmation',
      data: {
        title: 'ચેક-આઉટ ખાતરી',
        message: `શું તમે ખરેખર ${familyToCheckout.name} (રૂમ ${roomId}) ને ચેક-આઉટ કરવા માંગો છો?`,
        onConfirm: () => confirmCheckOut(roomId, familyId, familyToCheckout),
      },
    });
  };

  // Clear all guests from a room
const handleClearRoom = (roomId) => {
  const room = rooms.find(r => r.id === roomId);
  if (!room || room.families.length === 0) return;

  // Confirmation modal
  setModalState({
    isOpen: true,
    type: 'confirmation',
    data: {
      title: 'બધા મહેમાનોને દૂર કરો',
      message: `શું તમે ખરેખર રૂમ ${roomId} માંથી બધા ${room.families.length} મહેમાનોને દૂર કરવા માંગો છો? આ ક્રિયા રદ કરી શકાશે નહીં.`,
      onConfirm: () => confirmClearRoom(roomId, room.families),
    },
  });
};

const confirmClearRoom = async (roomId, families) => {
  closeModal(); // Close confirmation modal only

  const checkOutTime = new Date().toISOString();

  // Add all families to checkout history
  for (const family of families) {
    try {
      if (db) {
        await addDoc(collection(db, HISTORY_COLLECTION), {
          roomNumber: roomId,
          name: family.name,
          members: family.members,
          checkOutTime: checkOutTime,
          checkInTime: family.checkInTime || 'N/A',
          duration: family.checkInTime ? calculateDuration(family.checkInTime) : 'N/A',
          utara: selectedUtara,
        });
      }
    } catch (e) {
      console.error("Error adding history log:", e);
    }
  }

  // Clear all families from the room
  const updatedRooms = rooms.map(r =>
    r.id === roomId ? { ...r, families: [] } : r
  );
  
  await updateRoomState(updatedRooms);
  
  // DON'T close the room details modal - stay in the box
  // setSelectedRoomId(null); // <-- REMOVED THIS LINE
};

const confirmCheckOut = async (roomId, familyId, familyToCheckout) => {
  closeModal(); // કન્ફર્મેશન મોડલ બંધ કરો

  const checkOutTime = new Date().toISOString();
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  
  // ૧. હિસ્ટ્રી લોગમાં ઉમેરો (Firestore)
  try {
    if (db) {
      await addDoc(collection(db, HISTORY_COLLECTION), {
        roomNumber: roomId,
        name: familyToCheckout.name,
        members: familyToCheckout.members,
        checkOutTime: checkOutTime,
        checkInTime: familyToCheckout.checkInTime || 'N/A',
        duration: familyToCheckout.checkInTime ? calculateDuration(familyToCheckout.checkInTime) : 'N/A',
        utara: selectedUtara,  // ← ADD THIS LINE
      });
    }
  } catch (e) {
    console.error("Error adding history log:", e);
  }

  // ૨. રૂમમાંથી ફેમિલી દૂર કરો (Firestore)
  const updatedRooms = rooms.map(r =>
    r.id === roomId
      ? { ...r, families: r.families.filter(f => f.id !== familyId) }
      : r
  );
  await updateRoomState(updatedRooms);
  
  // DON'T close the room details modal - stay in the box
  // setSelectedRoomId(null); // <-- REMOVED THIS LINE
};

  // ====================================================================
  // ૫. કમ્પોનન્ટ્સ (Sub-Components)
  // ====================================================================

  // રૂમ કાર્ડ
  const RoomCard = ({ room, isHighlighted, isFaded }) => {
    const occupiedCount = room.families.reduce((sum, f) => sum + f.members, 0);
    const remainingCapacity = ROOM_CAPACITY - occupiedCount;
    const occupancyPercentage = (occupiedCount / ROOM_CAPACITY) * 100;
    
    let bgColor = 'bg-gray-100 hover:bg-gray-200'; // ખાલી
    let statusText = `${remainingCapacity} ખાલી`;
    let statusColor = 'bg-green-500 text-white';
  
    if (occupiedCount === ROOM_CAPACITY) {
      bgColor = 'bg-red-100 hover:bg-red-200'; // સંપૂર્ણ ભરાયેલ
      statusText = 'FULL';
      statusColor = 'bg-red-500 text-white';
    } else if (occupancyPercentage >= 50) {
      bgColor = 'bg-yellow-100 hover:bg-yellow-200'; // અર્ધ કરતાં વધુ ભરાયેલ
      statusColor = 'bg-yellow-500 text-white';
    } else if (occupiedCount > 0) {
      bgColor = 'bg-green-100 hover:bg-green-200'; // થોડું ભરાયેલ
      statusColor = 'bg-green-500 text-white';
    }
  
    const highlightStyle = isHighlighted
      ? 'ring-4 ring-pink-500 ring-offset-2 scale-105 transition-all duration-300'
      : '';
  
    const opacityStyle = isFaded ? 'opacity-50' : 'opacity-100';
  
    return (
      <div
        onClick={() => {
          openRoomDetailsModal(room.id);
          setSearchQuery(''); // Reset search when opening room
        }}
        className={`p-4 rounded-xl shadow-lg cursor-pointer flex flex-col justify-between h-32 text-gray-800 transition transform ${bgColor} ${highlightStyle} ${opacityStyle}`}
        style={{ transition: 'opacity 0.5s ease' }}
      >
        <div className="flex justify-between items-start">
          <span className="text-2xl font-bold text-indigo-600">રૂમ {room.id}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor}`}>
            કુલ: {occupiedCount}
          </span>
        </div>
        <div className="text-center mt-2">
          <span className={`text-4xl font-extrabold ${occupiedCount === ROOM_CAPACITY ? 'text-red-700' : occupancyPercentage >= 50 ? 'text-yellow-700' : 'text-green-700'}`}>
            {statusText}
          </span>
        </div>
      </div>
    );
  };

  // રૂમ ડીટેલ્સ મોડલ
  const RoomDetailsModal = ({ room, onClose, addFamily, updateFamily, handleCheckOut, handleClearRoom }) => {
    // Use a ref to store the initial room ID - prevents reset on room updates
    const initialRoomIdRef = React.useRef(room.id);
    
    const [newFamily, setNewFamily] = useState({ 
      firstName: '', 
      lastName: '', 
      village: '',
      phone: '',
      address: '',
      members: 1, 
      status: 'CheckedIn' 
    });
    const [welcomeMessage, setWelcomeMessage] = useState(null);
    const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);
    
    // Only reset form if room ID changes (switching to a different room)
    React.useEffect(() => {
      if (room.id !== initialRoomIdRef.current) {
        setNewFamily({ 
          firstName: '', 
          lastName: '', 
          village: '',
          phone: '',
          address: '',
          members: 1, 
          status: 'CheckedIn' 
        });
        initialRoomIdRef.current = room.id;
      }
    }, [room.id]);
    
    // Restore form data when user comes back from typing
    

    // Use the latest room data passed via prop/state
    const currentMembers = room.families.reduce((sum, f) => sum + f.members, 0);
    const remainingCapacity = ROOM_CAPACITY - currentMembers;
    const isFull = remainingCapacity <= 0;

    const familyStatusColors = {
      CheckedIn: 'bg-green-500 text-white',
      Reserved: 'bg-indigo-500 text-white',
    };

    const handleAdd = (e) => {
      e.preventDefault();
      if (newFamily.firstName.trim() === '' || newFamily.phone.trim() === '' || 
          newFamily.members <= 0 || newFamily.members > remainingCapacity) {
        setModalState({
          isOpen: true,
          type: 'error',
          data: `ભૂલ: કૃપા કરીને પ્રથમ નામ અને મોબાઇલ નંબર દાખલ કરો અને ખાતરી કરો કે વ્યક્તિઓની સંખ્યા (${newFamily.members}) બાકીની ક્ષમતા (${remainingCapacity}) કરતાં વધુ નથી.`,
        });
        return;
      }
      
      // Create full name - use only first name if last name is empty
      const fullName = newFamily.lastName.trim() 
        ? `${newFamily.firstName} ${newFamily.lastName}` 
        : newFamily.firstName;
      
      addFamily(room.id, { ...newFamily, name: fullName });
      setNewFamily({ firstName: '', lastName: '', village: '', phone: '', address: '', members: 1, status: 'CheckedIn' });
    };

    // વ્યક્તિઓની સંખ્યા માટે ડાયનેમિક ડ્રોપડાઉન વિકલ્પો
    const memberOptions = useMemo(() => {
      return Array.from({ length: remainingCapacity }, (_, i) => i + 1);
    }, [remainingCapacity]);

    // ====================================================================
    // GEMINI LLM સુવિધાઓ
    // ====================================================================

    // LLM દ્વારા સ્વાગત સંદેશ જનરેટ કરવું
    const generateWelcomeMessage = useCallback(async (family) => {
      if (isGeneratingMessage) return;
      setIsGeneratingMessage(true);
      setWelcomeMessage(null); // Clear previous message
      
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
      
      const systemPrompt = "Act as a spiritual leader and temple representative. Write a very short, warm, and uplifting welcome message (2-3 sentences max) for the family. The message must be entirely in Gujarati.";
      const userQuery = `Generate a welcome message for the family named ${family.name} checking into Room ${room.id}. The family has ${family.members} members.`;

      const payload = {
          contents: [{ parts: [{ text: userQuery }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
      };

      try {
          const result = await fetchWithRetry(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });

          const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
          setWelcomeMessage(text || 'માફ કરશો, સ્વાગત સંદેશ જનરેટ કરવામાં ભૂલ થઈ.');
      } catch (error) {
          console.error("Gemini API Error for Welcome Message:", error);
          setWelcomeMessage('માફ કરશો, API કૉલ નિષ્ફળ ગયો.');
      } finally {
          setIsGeneratingMessage(false);
      }
    }, [room.id, isGeneratingMessage]);


    const FamilyItem = ({ family }) => {
      const [isEditingName, setIsEditingName] = useState(false);
      const [isEditingMembers, setIsEditingMembers] = useState(false);
      const [editName, setEditName] = useState(family.name);
      const [editMembers, setEditMembers] = useState(family.members);

      const handleSaveName = () => {
        if (editName.trim() !== '') {
          updateFamily(room.id, family.id, { name: editName.trim() });
          setIsEditingName(false);
        } else {
            // Revert if empty
            setEditName(family.name);
            setIsEditingName(false);
        }
      };

      const handleSaveMembers = () => {
        const newCount = parseInt(editMembers, 10);
        if (isNaN(newCount) || newCount <= 0) return;

        const otherMembers = room.families.filter(item => item.id !== family.id).reduce((sum, item) => sum + item.members, 0);

        if (otherMembers + newCount > ROOM_CAPACITY) {
          // Error handling is inside updateFamily to show modal
          updateFamily(room.id, family.id, { members: newCount });
          setEditMembers(family.members); // પાછું સેટ કરો
          setIsEditingMembers(false);
          return;
        }

        updateFamily(room.id, family.id, { members: newCount });
        setIsEditingMembers(false);
      };

      const toggleStatus = () => {
        const newStatus = family.status === 'CheckedIn' ? 'Reserved' : 'CheckedIn';
        updateFamily(room.id, family.id, { status: newStatus });
      };

      return (
        <li className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-3 transition duration-300 hover:shadow-md">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2">
            <div className="flex flex-col sm:flex-row sm:items-center w-full sm:w-2/3 mb-2 sm:mb-0">
              {/* નામ એડિટ */}
              <div className="flex items-center mb-2 sm:mb-0 sm:mr-4">
              {isEditingName ? (
            <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); }}
            className="p-1 border border-indigo-300 rounded text-sm w-full"
            autoFocus
            />
                ) : (
                  <span
                    className="font-semibold text-lg text-gray-800 cursor-pointer hover:text-indigo-600"
                    onClick={() => setIsEditingName(true)}
                    title="નામ એડિટ કરવા માટે ક્લિક કરો"
                  >
                    {family.name}
                  </span>
                )}
                {!isEditingName && (
                  <button onClick={() => setIsEditingName(true)} className="ml-2 text-indigo-500 hover:text-indigo-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
              </div>

              {/* વ્યક્તિઓની સંખ્યા એડિટ */}
  <div className="flex items-center">
    <span className="text-gray-500 mr-2 text-sm">વ્યક્તિઓ:</span>
    {isEditingMembers ? (
      <input
        type="number"
        value={editMembers}
        onChange={(e) => setEditMembers(parseInt(e.target.value, 10))}
        onBlur={handleSaveMembers}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveMembers(); }}
        min="1"
        max={ROOM_CAPACITY}
        className="p-1 border border-indigo-300 rounded text-sm w-16"
        autoFocus
      />
    ) : (
      <div className="flex items-center">
        <span
          className="text-lg font-bold text-gray-700 cursor-pointer hover:text-indigo-600"
          onClick={() => setIsEditingMembers(true)}
          title="સંખ્યા એડિટ કરવા માટે ક્લિક કરો"
        >
          {family.members}
        </span>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-4 w-4 ml-1 text-gray-500" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    )}
    {!isEditingMembers && (
      <button onClick={() => setIsEditingMembers(true)} className="ml-2 text-indigo-500 hover:text-indigo-700">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>
    )}
  </div>
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-1/3 justify-end">
              {/* સ્ટેટસ ટૉગલ */}
              <button
                onClick={toggleStatus}
                className={`text-xs font-medium px-3 py-1 rounded-full shadow-md transition ${familyStatusColors[family.status]}`}
              >
                {family.status === 'CheckedIn' ? 'હાજર' : 'બુકિંગ'}
              </button>

              {/* ચેક આઉટ */}
              <button
                onClick={() => handleCheckOut(room.id, family.id)}
                className="px-3 py-1 text-xs font-medium text-white bg-red-500 rounded-lg shadow-md hover:bg-red-600 transition"
              >
                ચેક-આઉટ
              </button>
            </div>
          </div>

          {/* Additional Info: Phone, Village, Address */}
          <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-600 border-t pt-2">
            {family.phone && (
              <div className="flex items-center">
                <span className="mr-1">📞</span>
                <span className="font-medium">{family.phone}</span>
              </div>
            )}
            {family.village && (
              <div className="flex items-center">
                <span className="mr-1">📍</span>
                <span>{family.village}</span>
              </div>
            )}
            {family.address && (
              <div className="flex items-center">
                <span className="mr-1">🏠</span>
                <span className="text-xs">{family.address}</span>
              </div>
            )}
          </div>
        </li>
      );
    };

    return (
      <CustomModal
        isOpen={true}
        title={`રૂમ ${room.id} વ્યવસ્થાપન`}
        message={`વર્તમાન ક્ષમતા: ${currentMembers} / ${ROOM_CAPACITY}. બાકી: ${remainingCapacity}`}
        onCancel={onClose}
        cancelText="બંધ કરો"
      >
        <div className="max-h-[70vh] overflow-y-auto pr-2">
          {/* હાલના મુસાફરો */}
<div className="flex justify-between items-center mb-3 border-b pb-2 mt-4">
  <h4 className="text-lg font-bold text-gray-700">હાલના મુસાફરો ({room.families.length})</h4>
  {room.families.length > 0 && (
    <button
      onClick={() => handleClearRoom(room.id)}
      className="px-3 py-1 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition shadow-md flex items-center space-x-1"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      <span>બધા દૂર કરો</span>
    </button>
  )}
</div>
{room.families.length === 0 ? (
  <p className="text-gray-500 italic mb-4">આ રૂમમાં કોઈ મુસાફરો નથી.</p>
) : (
            <ul className="space-y-3 mb-6">
              {room.families.map(family => (
                <div key={family.id}>
                  <FamilyItem family={family} />
                  
                </div>
              ))}
            </ul>
          )}
          
          {/* નવું ફેમિલી ઉમેરવું */}
          <h4 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-700 to-red-700 mb-3 border-b-2 border-orange-300 pb-2 mt-4">નવું ફેમિલી ઉમેરો</h4>
          <form onSubmit={handleAdd} className="bg-gradient-to-br from-orange-50 to-yellow-50 p-4 rounded-lg border-2 border-orange-300">
  <div className="flex flex-col sm:flex-row sm:space-x-4 mb-3">
  <input
  type="text"
  placeholder="પ્રથમ નામ (First Name) *"
  value={newFamily.firstName || ''}
  onChange={(e) => setNewFamily(prev => ({ ...prev, firstName: e.target.value }))}
  autoComplete="off"
  data-lpignore="true"
  data-form-type="other"
  className="p-2 border-2 border-orange-300 rounded-lg flex-grow mb-2 sm:mb-0 focus:ring-2 focus:ring-orange-400 focus:border-orange-500"
  required
/>
<input
  type="text"
  placeholder="છેલ્લું નામ (Last Name) - વૈકલ્પિક"
  value={newFamily.lastName || ''}
  onChange={(e) => setNewFamily(prev => ({ ...prev, lastName: e.target.value }))}
  autoComplete="off"
  data-lpignore="true"
  data-form-type="other"
  className="p-2 border-2 border-orange-300 rounded-lg flex-grow mb-2 sm:mb-0 focus:ring-2 focus:ring-orange-400 focus:border-orange-500"
/>
  </div>
  
  <div className="flex flex-col sm:flex-row sm:space-x-4 mb-3">
  <input
  type="text"
  placeholder="ગામ / શહેર (Village/City) - વૈકલ્પિક"
  value={newFamily.village || ''}
  onChange={(e) => setNewFamily(prev => ({ ...prev, village: e.target.value }))}
  autoComplete="off"
  data-lpignore="true"
  data-form-type="other"
  className="p-2 border-2 border-orange-300 rounded-lg flex-grow mb-2 sm:mb-0 focus:ring-2 focus:ring-orange-400 focus:border-orange-500"
/>
<input
  type="tel"
  placeholder="મોબાઇલ (Phone Number) *"
  value={newFamily.phone || ''}
  onChange={(e) => setNewFamily(prev => ({ ...prev, phone: e.target.value }))}
  autoComplete="off"
  data-lpignore="true"
  data-form-type="other"
  className="p-2 border-2 border-orange-300 rounded-lg flex-grow mb-2 sm:mb-0 focus:ring-2 focus:ring-orange-400 focus:border-orange-500"
  required
/>
  </div>
  
  <div className="mb-3">
  <input
  type="text"
  placeholder="સરનામું (Address) - વૈકલ્પિક"
  value={newFamily.address || ''}
  onChange={(e) => setNewFamily(prev => ({ ...prev, address: e.target.value }))}
  autoComplete="off"
  data-lpignore="true"
  data-form-type="other"
  className="p-2 border-2 border-orange-300 rounded-lg w-full focus:ring-2 focus:ring-orange-400 focus:border-orange-500"
/>
  </div>
  
  <div className="flex flex-col sm:flex-row sm:space-x-4">
    <select
      value={newFamily.members}
      onChange={(e) => setNewFamily(f => ({ ...f, members: parseInt(e.target.value, 10) }))}
      className="p-2 border-2 border-orange-300 rounded-lg w-full sm:w-1/3 mb-2 sm:mb-0 focus:ring-2 focus:ring-orange-400"
      disabled={isFull}
    >
      {isFull ? (
        <option value={1} disabled>FULL</option>
      ) : (
        memberOptions.map(m => (
          <option key={m} value={m}>{m} વ્યક્તિ</option>
        ))
      )}
    </select>
    <select
      value={newFamily.status}
      onChange={(e) => setNewFamily(f => ({ ...f, status: e.target.value }))}
      className="p-2 border-2 border-orange-300 rounded-lg w-full sm:w-1/3 mb-2 sm:mb-0 focus:ring-2 focus:ring-orange-400"
    >
      <option value="CheckedIn">હાજર (Checked In)</option>
      <option value="Reserved">બુકિંગ (Reserved)</option>
    </select>
  </div>
  <button
    type="submit"
    className={`mt-3 w-full py-2 font-semibold text-white rounded-lg transition shadow-lg ${isFull ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700'}`}
    disabled={isFull}
  >
    {isFull ? 'રૂમ સંપૂર્ણ ભરાયેલ છે' : 'ફેમિલી ઉમેરો'}
  </button>
</form>
        </div>
      </CustomModal>
    );
  };

  // ====================================================================
  // ૬. લિસ્ટ્સ અને સર્ચ (Lists and Search)
  // ====================================================================

  const allFamilies = useMemo(() => {
    return rooms.flatMap(room =>
      room.families.map(f => ({
        ...f,
        roomNumber: room.id
      }))
    );
  }, [rooms]);

  const checkedInList = useMemo(() => allFamilies.filter(f => f.status === 'CheckedIn'), [allFamilies]);
  const reservedList = useMemo(() => allFamilies.filter(f => f.status === 'Reserved'), [allFamilies]);

  const searchResults = useMemo(() => {
    if (!searchQuery) return { families: [], roomIds: new Set() };

    const matchedFamilies = allFamilies.filter(f => fuzzyMatch(f.name, searchQuery));
    const matchedRoomIds = new Set(matchedFamilies.map(f => f.roomNumber));

    return { families: matchedFamilies, roomIds: matchedRoomIds };
  }, [allFamilies, searchQuery]);

  // નવો યાત્રી ઉમેરવો (Add new guest from search)
async function handleAddGuestFromSearch() {
  if (!searchQuery.trim()) return;

  try {
    await addGuest(searchQuery.trim());
    alert("નવો યાત્રી ઉમેરાયો ✅");
    setSearchQuery("");
  } catch (error) {
    console.error(error);
    alert("યાત્રી ઉમેરવામાં ભૂલ ❌");
  }
}
 
  // ====================================================================
  // ૭. મુખ્ય રેન્ડર (Main Render)
  // ====================================================================
  // Show login page if not authenticated
if (!isAuthenticated) {
  return <Login onLogin={handleLogin} />;
}

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-indigo-600 text-xl font-semibold">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-600 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          ડેટા લોડ થઈ રહ્યો છે... (Firebase સાથે કનેક્ટ થઈ રહ્યું છે)
        </div>
      </div>
    );
  }

// 🏠 HOME PAGE - Show when no utara is selected
if (!selectedUtara) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50 font-sans">
      {/* Decorative Header Border */}
      <div className="h-3 bg-gradient-to-r from-orange-600 via-red-600 to-yellow-600"></div>
      
      <div className="container mx-auto max-w-7xl px-4 sm:px-8 py-8">
        {/* Header Section */}
        <header className="text-center mb-12 pt-6 relative">
  {/* Logout Button - Top Right */}
  <button
    onClick={handleLogout}
    className="absolute right-0 top-0 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg text-sm font-semibold transition flex items-center space-x-2 shadow-lg"
  >
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
    <span>લૉગઆઉટ</span>
  </button>

  <div className="mb-6 relative">
            {/* Temple Icon with Glow Effect */}
            <div className="inline-block relative">
              <div className="absolute inset-0 bg-orange-400 blur-2xl opacity-30 rounded-full"></div>
              <div className="inline-block relative">
  <div className="absolute inset-0 bg-orange-400 blur-2xl opacity-30 rounded-full"></div>
  <img 
    src={logo} 
    alt="Sardhar Dham Logo" 
    className="h-20 w-40 mx-auto relative object-contain"
  />
</div>
            </div>
          </div>
          
          {/* Title with Traditional Style */}
          <div className="relative inline-block">
            <h1 className="text-4xl sm:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-700 via-red-700 to-orange-800 mb-2 drop-shadow-lg">
              || સરધારધામ ||
            </h1>
            <div className="h-1 w-32 mx-auto bg-gradient-to-r from-orange-600 to-red-600 rounded-full mb-4"></div>
          </div>
          
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3">
            બોટાદ મહોત્સવ ઉતારા વ્યવસ્થા
          </h2>
          <div className="inline-block px-4 py-1 bg-white rounded-full shadow-md border border-orange-200">
  <p className="text-sm text-gray-600">યુઝર: <span className="font-semibold text-orange-700">{currentUser?.username || 'Guest'}</span></p>
</div>
        </header>



        {/* Global Search Bar */}
<div className="max-w-2xl mx-auto mb-10 px-4">
  <input
    type="text"
    placeholder="કોઈપણ ઉતારામાં યાત્રી શોધો... (Search guest across all utaras)"
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="w-full p-4 border-2 border-orange-300 rounded-xl focus:ring-4 focus:ring-orange-200 focus:border-orange-500 transition shadow-lg text-lg"
  />
  
  {searchQuery && (
    <div className="mt-4 p-4 bg-orange-50 rounded-lg border-2 border-orange-300 shadow-md">
      {(() => {
        // Search across all utaras
        const globalResults = [];
        
        Object.entries(allUtaraRooms).forEach(([utaraKey, rooms]) => {
          rooms.forEach(room => {
            room.families.forEach(family => {
              if (fuzzyMatch(family.name, searchQuery)) {
                globalResults.push({
                  ...family,
                  roomNumber: room.id,
                  utaraKey: utaraKey,
                  utaraLabel: UTARA_CONFIG[utaraKey]?.label || utaraKey
                });
              }
            });
          });
        });
        
        if (globalResults.length === 0) {
          return (
            <p className="text-sm text-red-700 text-center">
              કોઈ પરિણામ મળ્યું નથી.
            </p>
          );
        }
        
        return (
          <div>
            <p className="text-sm font-semibold text-orange-700 mb-3">
              {globalResults.length} પરિણામ મળ્યા:
            </p>
            <div className="flex flex-wrap gap-2">
              {globalResults.map((f, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedUtara(f.utaraKey);
                    setSearchQuery('');
                    window.scrollTo(0, 0);
                  }}
                  className="text-sm px-3 py-2 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg hover:from-orange-700 hover:to-red-700 transition shadow-md"
                >
                  <div className="font-semibold">{f.name}</div>
                  <div className="text-xs opacity-90">
                    {f.utaraLabel} - રૂમ {f.roomNumber} | {f.members} વ્યક્તિ
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  )}
</div>

{/* Main Content */}
<main>

          <div className="text-center mb-10">
            <h3 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-2">
            
            </h3>
            <p className="text-gray-600">Please Select Accommodation</p>
          </div>
          
          {/* Utara Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 max-w-7xl mx-auto">
            
            {/* GadhpurDham - 1 */}
<button
  onClick={() => {
    setSelectedUtara('gadhpurdham_1');
    window.scrollTo(0, 0);
  }}
  className="group relative bg-gradient-to-br from-white to-orange-50 border-4 border-orange-300 hover:border-orange-500 rounded-3xl p-8 shadow-2xl hover:shadow-orange-300/50 transform hover:scale-105 transition-all duration-300 overflow-hidden"
>
  <div className="absolute top-0 right-0 w-32 h-32 bg-orange-200 rounded-full -mr-16 -mt-16 opacity-20 group-hover:opacity-40 transition"></div>
  <div className="relative text-center">
    <div className="inline-block px-4 py-1 bg-orange-600 text-white rounded-full text-xs font-bold mb-3 shadow-md">
      GADHPUR DHAM
    </div>
    <h3 className="text-3xl font-extrabold text-orange-800 mb-4">ગઢપુર ધામ - ૧</h3>
    <div className="flex justify-center items-center space-x-6 mb-4">
      <div className="text-center">
        <p className="text-5xl font-extrabold text-orange-700">170</p>
        <p className="text-sm text-gray-600 font-semibold">રૂમ્સ</p>
      </div>
      <div className="text-4xl text-orange-300">●</div>
      <div className="text-center">
        <p className="text-5xl font-extrabold text-green-600">
          {allUtaraRooms.gadhpurdham_1?.reduce((sum, room) => 
            sum + room.families.reduce((s, f) => 
              f.status === 'CheckedIn' ? s + f.members : s, 0), 0) || 0}
        </p>
        <p className="text-sm text-gray-600 font-semibold">હાજર</p>
      </div>
    </div>
    <div className="text-orange-600 font-semibold group-hover:text-orange-800 transition">
      Click to Manage →
    </div>
  </div>
</button>

            {/* GadhpurDham - 2 */}
            <button
              onClick={() => {
                setSelectedUtara('gadhpurdham_2');
                window.scrollTo(0, 0);
              }}
              className="group relative bg-gradient-to-br from-white to-red-50 border-4 border-red-300 hover:border-red-500 rounded-3xl p-8 shadow-2xl hover:shadow-red-300/50 transform hover:scale-105 transition-all duration-300 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-200 rounded-full -mr-16 -mt-16 opacity-20 group-hover:opacity-40 transition"></div>
              <div className="relative text-center">
                <div className="inline-block px-4 py-1 bg-red-600 text-white rounded-full text-xs font-bold mb-3 shadow-md">
                  GADHPUR DHAM
                </div>
                <h3 className="text-3xl font-extrabold text-red-800 mb-4">ગઢપુર ધામ - ૨</h3>
                <div className="flex justify-center items-center space-x-6 mb-4">
                  <div className="text-center">
                    <p className="text-5xl font-extrabold text-red-700">300</p>
                    <p className="text-sm text-gray-600 font-semibold">રૂમ્સ</p>
                  </div>
                  <div className="text-4xl text-red-300">●</div>
                  <div className="text-center">
  <p className="text-5xl font-extrabold text-green-600">
    {allUtaraRooms.gadhpurdham_2?.reduce((sum, room) => 
      sum + room.families.reduce((s, f) => 
        f.status === 'CheckedIn' ? s + f.members : s, 0), 0) || 0}
  </p>
  <p className="text-sm text-gray-600 font-semibold">હાજર</p>
</div>
                </div>
                <div className="text-red-600 font-semibold group-hover:text-red-800 transition">
                  Click to Manage →
                </div>
              </div>
            </button>

            {/* GadhpurDham - 3 */}
            <button
              onClick={() => {
                setSelectedUtara('gadhpurdham_3');
                window.scrollTo(0, 0);
              }}
              className="group relative bg-gradient-to-br from-white to-yellow-50 border-4 border-yellow-400 hover:border-yellow-600 rounded-3xl p-8 shadow-2xl hover:shadow-yellow-300/50 transform hover:scale-105 transition-all duration-300 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-200 rounded-full -mr-16 -mt-16 opacity-20 group-hover:opacity-40 transition"></div>
              <div className="relative text-center">
                <div className="inline-block px-4 py-1 bg-yellow-600 text-white rounded-full text-xs font-bold mb-3 shadow-md">
                  GADHPUR DHAM
                </div>
                <h3 className="text-3xl font-extrabold text-yellow-800 mb-4">ગઢપુર ધામ - ૩</h3>
                <div className="flex justify-center items-center space-x-6 mb-4">
                  <div className="text-center">
                    <p className="text-5xl font-extrabold text-yellow-700">150</p>
                    <p className="text-sm text-gray-600 font-semibold">રૂમ્સ</p>
                  </div>
                  <div className="text-4xl text-yellow-300">●</div>
                  <div className="text-center">
  <p className="text-5xl font-extrabold text-green-600">
    {allUtaraRooms.gadhpurdham_3?.reduce((sum, room) => 
      sum + room.families.reduce((s, f) => 
        f.status === 'CheckedIn' ? s + f.members : s, 0), 0) || 0}
  </p>
  <p className="text-sm text-gray-600 font-semibold">હાજર</p>
</div>
                </div>
                <div className="text-yellow-700 font-semibold group-hover:text-yellow-900 transition">
                  Click to Manage →
                </div>
              </div>
            </button>

            {/* Svyam Sevak Utara */}
            <button
              onClick={() => {
                setSelectedUtara('svyam_sevak');
                window.scrollTo(0, 0);
              }}
              className="group relative bg-gradient-to-br from-white to-amber-50 border-4 border-amber-400 hover:border-amber-600 rounded-3xl p-8 shadow-2xl hover:shadow-amber-300/50 transform hover:scale-105 transition-all duration-300 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-200 rounded-full -mr-16 -mt-16 opacity-20 group-hover:opacity-40 transition"></div>
              <div className="relative text-center">
                <div className="inline-block px-4 py-1 bg-amber-700 text-white rounded-full text-xs font-bold mb-3 shadow-md">
                  SEVAK UTARA
                </div>
                <h3 className="text-3xl font-extrabold text-amber-900 mb-4">સ્વયં સેવક ઉતારા</h3>
                <div className="flex justify-center items-center space-x-6 mb-4">
                  <div className="text-center">
                    <p className="text-5xl font-extrabold text-amber-700">60</p>
                    <p className="text-sm text-gray-600 font-semibold">રૂમ્સ</p>
                  </div>
                  <div className="text-4xl text-amber-300">●</div>
                  <div className="text-center">
  <p className="text-5xl font-extrabold text-green-600">
    {allUtaraRooms.svyam_sevak?.reduce((sum, room) => 
      sum + room.families.reduce((s, f) => 
        f.status === 'CheckedIn' ? s + f.members : s, 0), 0) || 0}
  </p>
  <p className="text-sm text-gray-600 font-semibold">હાજર</p>
</div>
                </div>
                <div className="text-amber-700 font-semibold group-hover:text-amber-900 transition">
                  Click to Manage →
                </div>
              </div>
            </button>
            {/* Mandir Utara */}
<button
  onClick={() => {
    setSelectedUtara('mandir_utara');
    window.scrollTo(0, 0);
  }}
  className="group relative bg-gradient-to-br from-white to-red-50 border-4 border-red-300 hover:border-red-500 rounded-3xl p-8 shadow-2xl hover:shadow-red-300/50 transform hover:scale-105 transition-all duration-300 overflow-hidden"
>
  <div className="absolute top-0 right-0 w-32 h-32 bg-red-200 rounded-full -mr-16 -mt-16 opacity-20 group-hover:opacity-40 transition"></div>
  <div className="relative text-center">
    <div className="inline-block px-4 py-1 bg-red-600 text-white rounded-full text-xs font-bold mb-3 shadow-md">
      MANDIR UTARA
    </div>
    <h3 className="text-3xl font-extrabold text-red-800 mb-4">મંદિર ઉતારા</h3>
    <div className="flex justify-center items-center space-x-6 mb-4">
      <div className="text-center">
        <p className="text-5xl font-extrabold text-red-700">50</p>
        <p className="text-sm text-gray-600 font-semibold">રૂમ્સ</p>
      </div>
      <div className="text-4xl text-red-300">●</div>
      <div className="text-center">
        <p className="text-5xl font-extrabold text-green-600">
          {allUtaraRooms.mandir_utara?.reduce((sum, room) => 
            sum + room.families.reduce((s, f) => 
              f.status === 'CheckedIn' ? s + f.members : s, 0), 0) || 0}
        </p>
        <p className="text-sm text-gray-600 font-semibold">હાજર</p>
      </div>
    </div>
    <div className="text-red-600 font-semibold group-hover:text-red-800 transition">
      Click to Manage →
    </div>
  </div>
</button>
{/* Sarangpur Utara */}
<button
  onClick={() => {
    setSelectedUtara('sarangpur_utara');
    window.scrollTo(0, 0);
  }}
  className="group relative bg-gradient-to-br from-white to-orange-50 border-4 border-orange-300 hover:border-orange-500 rounded-3xl p-8 shadow-2xl hover:shadow-orange-300/50 transform hover:scale-105 transition-all duration-300 overflow-hidden"
>
  <div className="absolute top-0 right-0 w-32 h-32 bg-orange-200 rounded-full -mr-16 -mt-16 opacity-20 group-hover:opacity-40 transition"></div>
  <div className="relative text-center">
    <div className="inline-block px-4 py-1 bg-orange-600 text-white rounded-full text-xs font-bold mb-3 shadow-md">
      SARANGPUR UTARA
    </div>
    <h3 className="text-3xl font-extrabold text-orange-800 mb-4">સારંગપુર ઉતારા</h3>
    <div className="flex justify-center items-center space-x-6 mb-4">
      <div className="text-center">
        <p className="text-5xl font-extrabold text-orange-700">250</p>
        <p className="text-sm text-gray-600 font-semibold">રૂમ્સ</p>
      </div>
      <div className="text-4xl text-orange-300">●</div>
      <div className="text-center">
        <p className="text-5xl font-extrabold text-green-600">
          {allUtaraRooms.sarangpur_utara?.reduce((sum, room) => 
            sum + room.families.reduce((s, f) => 
              f.status === 'CheckedIn' ? s + f.members : s, 0), 0) || 0}
        </p>
        <p className="text-sm text-gray-600 font-semibold">હાજર</p>
      </div>
    </div>
    <div className="text-orange-600 font-semibold group-hover:text-orange-800 transition">
      Click to Manage →
    </div>
  </div>
</button>
          </div>
        </main>

	  
         {/* Developer Credit */}
<div className="fixed bottom-2 right-2">
  <p className="text-[10px] text-gray-400">
    Akshar Patel
  </p>
</div>

{/* Footer - Center */}
<footer className="text-center mt-16 pb-8">
  <div className="inline-block px-6 py-3 bg-white rounded-full shadow-lg border-2 border-orange-200">
    <p className="text-sm text-gray-600">
      🙏 <span className="font-semibold text-orange-700">જય સ્વામિનારાયણ</span> 🙏
    </p>
  </div>
</footer>
      </div>
    </div>
  );
}
if (!selectedUtara) {
  // If user is not admin, redirect them to their assigned utara
  if (currentUser && currentUser.role === 'manager' && currentUser.access !== 'all') {
    setSelectedUtara(currentUser.access);
    return null;
  }
}
return (
  <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50 font-sans p-4 sm:p-8">
    {/* Decorative Header Border */}
    <div className="fixed top-0 left-0 right-0 h-2 bg-gradient-to-r from-orange-600 via-red-600 to-yellow-600 z-50"></div>
    
    <header className="bg-white shadow-2xl rounded-2xl p-4 mb-8 sticky top-4 z-10 border-2 border-orange-200">
        {/* Back to Home Button - Only for Admin */}
        {currentUser && currentUser.role === 'admin' && (
          <button
            onClick={() => {
              setSelectedUtara(null);
              setSearchQuery('');
              window.scrollTo(0, 0);
            }}
            className="absolute left-4 top-4 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg text-sm font-semibold transition flex items-center space-x-2 shadow-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>હોમ</span>
          </button>
        )}

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="absolute right-4 top-4 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg text-sm font-semibold transition flex items-center space-x-2 shadow-lg"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>લૉગઆઉટ</span>
        </button>

        <h1 className="text-3xl font-extrabold text-center mb-2">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-700 via-red-700 to-orange-800">
            મંદિર ઉતારા વ્યવસ્થાપન સિસ્ટમ
          </span>
        </h1>
        <p className="text-center text-xs text-gray-500 mt-2">
    વર્તમાન યુઝર: {currentUser?.username || 'Guest'}
</p>
        
        <div className="max-w-xl mx-auto mt-4">
          <input
            type="text"
            placeholder="ફેમિલી લીડરના નામ દ્વારા શોધો..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-3 border-2 border-orange-300 rounded-xl focus:ring-4 focus:ring-orange-200 focus:border-orange-500 transition shadow-md"
          />
        </div>

        {searchQuery && searchResults.families.length > 0 && (
          <div className="max-w-xl mx-auto mt-3 p-3 bg-orange-50 rounded-lg border-2 border-orange-300 shadow-md">
            <p className="text-sm font-semibold text-orange-700 mb-2">શોધ પરિણામો ({searchResults.families.length} મેચ):</p>
            <div className="flex flex-wrap gap-2">
              {searchResults.families.map(f => (
                <button
                  key={f.id}
                  onClick={() => openRoomDetailsModal(f.roomNumber)}
                  className="text-xs px-2 py-1 bg-orange-600 text-white rounded-full hover:bg-orange-700 transition shadow-sm"
                >
                  {f.name} (રૂમ {f.roomNumber})
                </button>
              ))}
            </div>
          </div>
        )}
        {searchQuery && searchResults.families.length === 0 && (
          <div className="max-w-xl mx-auto mt-3 p-3 bg-red-50 rounded-lg border-2 border-red-300 shadow-md">
            <p className="text-sm text-red-700 text-center">
              કોઈ પરિણામ મળ્યું નથી.
            </p>
          </div>
        )}
      </header>

      <main className="container mx-auto">
        {/* રૂમ ગ્રીડ */}
        <section className="mb-10 p-6 bg-white rounded-2xl shadow-2xl border-2 border-orange-200">
  <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-700 to-red-700 mb-4 flex items-center flex-wrap gap-3">
    <span>રૂમ ગ્રીડ - {UTARA_LABEL} (કુલ: {TOTAL_ROOMS}, ક્ષમતા: {ROOM_CAPACITY})</span>
    <span className="px-5 py-2 bg-green-600 text-white rounded-full text-lg font-semibold shadow-lg">
      હાજર: {rooms.reduce((sum, room) => sum + room.families.reduce((s, f) => f.status === 'CheckedIn' ? s + f.members : s, 0), 0)} લોકો
    </span>
    <span className="px-5 py-2 bg-red-600 text-white rounded-full text-lg font-semibold shadow-lg">
      સંપૂર્ણ રૂમ: {rooms.filter(room => room.families.reduce((sum, f) => sum + f.members, 0) === ROOM_CAPACITY).length}
    </span>
  </h2>

  <div className="h-[65vh] overflow-y-auto pr-2 border-2 border-orange-100 rounded-xl bg-gradient-to-br from-orange-50 to-yellow-50">

  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 p-4">
  {rooms.map(room => (
    <RoomCard
      key={room.id}
      room={room}
      isHighlighted={false}
      isFaded={false}
    />
  ))}
</div>
  </div>
</section>


            
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* હાજર યાત્રીઓનું લિસ્ટ */}
          <section className="p-6 bg-white rounded-2xl shadow-2xl border-2 border-green-200">
  <h2 className="text-2xl font-bold text-green-700 mb-4 border-b-2 border-green-300 pb-2">
              હાજર યાત્રીઓનું લિસ્ટ ({checkedInList.length})
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {checkedInList.length === 0 ? (
                <p className="text-gray-500 italic">કોઈ યાત્રીઓ હાજર નથી.</p>
              ) : (
                checkedInList.map(f => (
                  <div
                    key={f.id}
                    className="bg-green-50 p-3 rounded-lg border-l-4 border-green-500 shadow-md flex justify-between items-center cursor-pointer hover:bg-green-100 transition"
                    onClick={() => openRoomDetailsModal(f.roomNumber)}
                  >
                    <div>
                      <p className="font-semibold text-gray-800">{f.name}</p>
                      <p className="text-xs text-gray-600">
                        રૂમ {f.roomNumber} | {f.members} વ્યક્તિ
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-700">
                        {calculateDuration(f.checkInTime, durationTick)}
                      </p>
                      <p className="text-xs text-gray-500">કુલ સમય</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* બુકિંગ લિસ્ટ */}
          <section className="p-6 bg-white rounded-2xl shadow-2xl border-2 border-orange-200">
  <h2 className="text-2xl font-bold text-orange-700 mb-4 border-b-2 border-orange-300 pb-2">
    બુકિંગ લિસ્ટ ({reservedList.length})
  </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {reservedList.length === 0 ? (
                <p className="text-gray-500 italic">કોઈ બુકિંગ પેન્ડિંગ નથી.</p>
              ) : (
                reservedList.map(f => (
                  <div
                    key={f.id}
                    className="bg-orange-50 p-3 rounded-lg border-l-4 border-orange-500 shadow-md flex justify-between items-center cursor-pointer hover:bg-orange-100 transition"                    onClick={() => openRoomDetailsModal(f.roomNumber)}
                  >
                    <div>
                      <p className="font-semibold text-gray-800">{f.name}</p>
                      <p className="text-xs text-gray-600">
                        રૂમ {f.roomNumber} | {f.members} વ્યક્તિ
                      </p>
                    </div>
                    <span className="text-xs font-medium px-2 py-0.5 bg-orange-600 text-white rounded-full">                      બુકિંગ
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

  
        {/* TWO BOXES - Check-In and Check-Out History */}
<div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
  
  {/* LEFT BOX - Check-In History (Green) */}
  <div className="p-6 bg-white rounded-2xl shadow-2xl border-4 border-green-400">
  <h3 className="text-2xl font-bold text-green-700 mb-4 pb-2 border-b-4 border-green-400">
  ✅ ચેક-ઇન ઇતિહાસ - {UTARA_LABEL} ({checkInHistory.filter(h => h.utara === selectedUtara).length})
</h3>
<div className="space-y-3 max-h-96 overflow-y-auto pr-2">
{checkInHistory.filter(h => h.utara === selectedUtara).length === 0 ? (
  <p className="text-gray-500 italic text-center py-8">આ ઉતારામાં હજુ સુધી કોઈ ચેક-ઇન રેકોર્ડ નથી.</p>
) : (
  checkInHistory.filter(h => h.utara === selectedUtara).map(h => (
    <div
      key={h.id}
      className="bg-green-50 p-3 rounded-lg border-l-4 border-green-500 shadow-sm hover:bg-green-100 transition"
    >
      <p className="font-bold text-gray-900 mb-1">{h.name}</p>
      <p className="text-sm text-gray-600">રૂમ {h.roomNumber} • {h.members} વ્યક્તિ</p>
      {h.phone && h.phone !== 'N/A' && <p className="text-xs text-gray-600">📞 {h.phone}</p>}
      {h.village && h.village !== 'N/A' && <p className="text-xs text-gray-600">📍 {h.village}</p>}
      <p className="text-xs text-gray-500 mt-1">
        {new Date(h.checkInTime).toLocaleString('gu-IN')}
      </p>
    </div>
  ))
)}
    </div>
  </div>

  {/* RIGHT BOX - Check-Out History (Red) */}
  <div className="p-6 bg-white rounded-2xl shadow-2xl border-4 border-red-400">
    <h3 className="text-2xl font-bold text-red-700 mb-4 pb-2 border-b-4 border-red-400">
      ❌ ચેક-આઉટ ઇતિહાસ ({historyLog.length})
    </h3>
    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
      {historyLog.length === 0 ? (
        <p className="text-gray-500 italic text-center py-8">હજુ સુધી કોઈ ચેક-આઉટ રેકોર્ડ નથી.</p>
      ) : (
        historyLog.map(h => (
          <div
            key={h.id}
            className="bg-red-50 p-3 rounded-lg border-l-4 border-red-500 shadow-sm hover:bg-red-100 transition"
          >
            <p className="font-bold text-gray-900 mb-1">{h.name}</p>
            <p className="text-sm text-gray-600">રૂમ {h.roomNumber} • {h.members} વ્યક્તિ • {h.duration}</p>
            <p className="text-xs text-gray-500 mt-1">
              {new Date(h.checkOutTime).toLocaleString('gu-IN')}
            </p>
          </div>
        ))
      )}
    </div>
  </div>
  
</div>
      </main>

      {/* મોડલ રેન્ડરિંગ */}
      {modalState.type === 'details' && selectedRoomId && (
  <RoomDetailsModal
    room={rooms.find(r => r.id === selectedRoomId)}
    onClose={closeModal}
    addFamily={addFamily}
    updateFamily={updateFamily}
    handleCheckOut={handleCheckOut}
    handleClearRoom={handleClearRoom}
  />
)}

      {modalState.type === 'confirmation' && modalState.data && (
        <CustomModal
          isOpen={true}
          title={modalState.data.title}
          message={modalState.data.message}
          onConfirm={modalState.data.onConfirm}
          onCancel={closeModal}
        />
      )}

      {modalState.type === 'error' && modalState.data && (
        <CustomModal
          isOpen={true}
          title="ભૂલ (Error)"
          message={modalState.data}
          onCancel={closeModal}
        />
      )}
    </div>
  );
}