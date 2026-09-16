// ATENÇÃO: preencha com as credenciais do SEU projeto Firebase antes de rodar.
// Console Firebase → Configurações do projeto → Seus apps → SDK setup and configuration.
// Essas chaves são públicas por natureza (não são segredo) — a segurança real
// fica nas Firestore Security Rules (ver firestore.rules), não aqui.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'COLE_AQUI_A_API_KEY',
  authDomain: 'seu-projeto.firebaseapp.com',
  projectId: 'seu-projeto',
  storageBucket: 'seu-projeto.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:xxxxxxxxxxxxxxxxxxxxxx',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
