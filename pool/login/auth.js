// Importar las funciones necesarias de los SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc, deleteDoc, runTransaction, collection, query, where, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- SOLUCIÓN: Re-exportar las funciones para que otros módulos (como pool.js) puedan usarlas
export { doc, setDoc, getDoc, onSnapshot, onAuthStateChanged, updateDoc, deleteDoc, runTransaction, collection, query, where, getDocs, addDoc };

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

// --- SOLUCIÓN: Redirigir si el usuario ya está logueado ---
// Si estamos en la página de login y el localStorage indica que hay una sesión activa,
// redirigimos inmediatamente a la página principal (home).
if (window.location.pathname.endsWith('login.html') && localStorage.getItem('userIsLoggedIn') === 'true') {
    window.location.href = 'home.html';
}

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

/**
 * Inicia sesión con email y contraseña.
 * Si el usuario no tiene un perfil en Firestore, se crea uno.
 * @param {string} email - El email del usuario.
 * @param {string} password - La contraseña del usuario.
 * @returns {Promise<User>} El objeto de usuario de Firebase.
 */
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

    // Guardar el estado de la sesión en localStorage
    localStorage.setItem('userIsLoggedIn', 'true');
    return user;
}

/**
 * NUEVO: Inicia sesión con nombre de usuario o email.
 * Determina si el input es un email o un username y procede a la autenticación.
 * @param {string} usernameOrEmail - El nombre de usuario o el email.
 * @param {string} password - La contraseña.
 * @returns {Promise<User>} El objeto de usuario de Firebase.
 */
export async function loginWithUsernameOrEmail(usernameOrEmail, password) {
    let emailToLogin = usernameOrEmail;

    // Si no parece un email, asumimos que es un nombre de usuario y buscamos el email.
    if (!usernameOrEmail.includes('@')) {
        const usersRef = collection(db, "saldo");
        const q = query(usersRef, where("username", "==", usernameOrEmail));
        
        try {
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                // Lanzamos un error compatible con Firebase Auth para que el login.html lo maneje.
                const error = new Error("No se encontró ningún usuario con ese nombre.");
                error.code = 'auth/user-not-found';
                throw error;
            }
            // Asumimos que los nombres de usuario son únicos.
            const userDoc = querySnapshot.docs[0];
            emailToLogin = userDoc.data().email;
        } catch (error) {
            // Si hubo un error en la consulta o el usuario no se encontró, lo relanzamos.
            console.error("Error buscando usuario por username:", error);
            throw error;
        }
    }

    // Una vez que tenemos el email (ya sea el original o el encontrado), iniciamos sesión.
    return loginWithEmail(emailToLogin, password);
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
            // --- SOLUCIÓN: Añadir el UID al objeto del perfil ---
            // El objeto userData no contiene el ID del documento (que es el UID del usuario) por defecto.
            // Lo añadimos manualmente para que esté disponible en toda la aplicación.
            callback({ ...userData, uid: userId });
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
    // Eliminar el estado de la sesión de localStorage
    localStorage.removeItem('userIsLoggedIn');
    return signOut(auth);
}