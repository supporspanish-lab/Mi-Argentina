// Importar las funciones necesarias de los SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
// --- SOLUCIÓN: Importar las funciones de Firestore para usarlas en este archivo
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
export const db = getFirestore(app); // Ahora 'getFirestore' está definido en este ámbito

// --- Funciones de Autenticación ---

export async function registerWithEmail(username, email, password) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await setDoc(doc(db, "saldo", user.uid), {
        username: username,
        email: user.email,
        balance: 0
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
            email: user.email,
            balance: 0
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
            callback(docSnap.data());
            console.log("User profile data received:", docSnap.data());
        } else {
            // Si el perfil no existe, lo creamos.
            console.log("Perfil no encontrado en Firestore, creando uno nuevo...");
            setDoc(userDocRef, {
                username: auth.currentUser.displayName || auth.currentUser.email,
                email: auth.currentUser.email,
                balance: 0
            }).catch(error => {
                console.error("Error al crear el perfil de usuario:", error);
            });
        }
    });
}

export function logout() {
    return signOut(auth);
}