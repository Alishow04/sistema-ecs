// Firebase Web SDK via CDN (ES Modules)
// O Sistema ECS agora usa o MESMO projeto Firebase da Central SPX.
// Isso unifica a autenticação e permite que HUB, Central e ECS compartilhem
// a mesma identidade sem Cloud Functions ou uma segunda base de usuários.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAg3RZPbYEYz-FU9-kGICmXmHV58UImeFQ',
  authDomain: 'central-spx-fiedler.firebaseapp.com',
  projectId: 'central-spx-fiedler',
  storageBucket: 'central-spx-fiedler.firebasestorage.app',
  messagingSenderId: '1009454162688',
  appId: '1:1009454162688:web:b81a72c90d13572fb409e5'
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
