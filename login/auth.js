// Importar las funciones necesarias de los SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- SOLUCIÓN: Re-exportar las funciones para que otros módulos (como pool.js) puedan usarlas
export { doc, setDoc, getDoc, onSnapshot, onAuthStateChanged, updateDoc, deleteDoc };

// Tu configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyARtudlNYekKYm3zDl1r4RsinP1b3GUlu4",
    authDomain: "blackball-93ed0.firebaseapp.com",
    projectId: "blackball-93ed0",
    storageBucket: "blackball-93ed0.firebasestorage.app",
    messagingSenderId: "25368743673",
    appId: "1:25368743673:web:2702ce575622ceb7341c28",
    measurementId: "G-MSX7ELVR48"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// --- Funciones de Autenticación ---

export async function registerWithEmail(username, email, password) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await setDoc(doc(db, "saldo", user.uid), {
        username: username,
        email: user.email,
        balance: 0,
        profileImageName: null // Initialize profile image name
    });
    return user;
}

export async function loginWithEmail(email, password) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const userDocRef = doc(db, "saldo", user.uid);
    const docSnap = await getDoc(userDocRef);

    if (!docSnap.exists()) {
        await setDoc(userDocRef, {
            username: user.displayName || user.email.split('@')[0],
            email: user.email,
            balance: 0,
            profileImageName: null
        });
    }
    return user;
}

export async function sendResetPasswordEmail(email) {
    await sendPasswordResetEmail(auth, email);
}

export function onSessionStateChanged(callback) {
    return onAuthStateChanged(auth, callback);
}

export function onUserProfileUpdate(userId, callback) {
    const userDocRef = doc(db, "saldo", userId);
    return onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const userData = docSnap.data();
            callback(userData);
        } else {
            console.log("Perfil no encontrado en Firestore, creando uno nuevo...");
            setDoc(userDocRef, {
                username: auth.currentUser.displayName || auth.currentUser.email.split('@')[0],
                email: auth.currentUser.email,
                balance: 0,
                profileImageName: null
            }).catch(error => {
                console.error("Error al crear el perfil de usuario:", error);
            });
        }
    });
}

export async function updateUserProfile(userId, data) {
    const userDocRef = doc(db, "saldo", userId);
    await updateDoc(userDocRef, data);
}

export function logout() {
    return signOut(auth);
}