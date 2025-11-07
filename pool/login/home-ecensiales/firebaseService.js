import { db, auth, getDoc } from '../auth.js';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, onSnapshot, deleteDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

export { db, auth, getDoc, collection, query, where, getDocs, addDoc, doc, updateDoc, onSnapshot, deleteDoc, arrayUnion };
