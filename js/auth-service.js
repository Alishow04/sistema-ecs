import { auth } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';

export function observeAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function signInUser(email, password) {
  return signInWithEmailAndPassword(auth, String(email || '').trim(), password);
}

export async function signOutUser() {
  return signOut(auth);
}

export async function sendPasswordReset(email) {
  return sendPasswordResetEmail(auth, String(email || '').trim());
}
