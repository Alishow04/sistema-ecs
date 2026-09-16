// Camada mais baixa de acesso ao Firestore. Nada de regra de negócio aqui —
// isso fica em ecs-service.js e settings-service.js. Esta camada só sabe
// conversar com o banco.

import { db } from './firebase-config.js';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
  collection,
  query,
  orderBy,
  limit,
  where,
  getDocs,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

export {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
  collection,
  query,
  orderBy,
  limit,
  where,
  getDocs,
  serverTimestamp,
  db,
};

/** Lê um documento simples de settings/{name}; devolve null se não existir. */
export async function readSettingsDoc(name) {
  const ref = doc(db, 'settings', name);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/** Busca os N ECS mais recentes (não-cancelados) ordenados por data de criação. */
export async function fetchRecentEcs(max = 20) {
  const q = query(
    collection(db, 'ecsRecords'),
    orderBy('createdAt', 'desc'),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Busca um ECS pelo docId (formato "{ano}-{sequencia}"). */
export async function fetchEcsById(id) {
  const ref = doc(db, 'ecsRecords', id);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
