// Firebase Web SDK via CDN (ES Modules)
// Configuração do projeto "sistema-ecs"

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyB3oUmNmprvM5I8SE3r4pfCPuYYZIiU70Q',
  authDomain: 'sistema-ecs.firebaseapp.com',
  projectId: 'sistema-ecs',
  storageBucket: 'sistema-ecs.firebasestorage.app',
  messagingSenderId: '893149070479',
  appId: '1:893149070479:web:fc99c7cb4726bd56bedcfa',
  measurementId: 'G-NE5KN3ZQ3M'
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
