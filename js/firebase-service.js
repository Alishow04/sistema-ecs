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
  limitToLast,
  startAfter,
  endBefore,
  where,
  getDocs,
  getCountFromServer,
  serverTimestamp,
  Timestamp,
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
  limitToLast,
  startAfter,
  endBefore,
  where,
  getDocs,
  getCountFromServer,
  serverTimestamp,
  Timestamp,
  db,
};

/** Lê um documento simples de settings/{name}; devolve null se não existir. */
export async function readSettingsDoc(name) {
  const ref = doc(db, 'settings', name);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/** Grava a lista completa em settings/{name} e atualiza o cache local na hora. */
export async function writeSettingsDoc(name, list) {
  await setDoc(doc(db, 'settings', name), { list });
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

/**
 * Monta a query-base do Histórico (sem limit/cursor) a partir dos filtros.
 * Decisão importante: o período filtra por `createdAt`, não por `ecsDate`.
 * O Firestore só permite uma orderBy() no mesmo campo que recebe filtro de
 * intervalo (>=/<=) — usar createdAt para as duas coisas evita ter que
 * escolher entre ordenar por data de criação OU filtrar por período.
 *
 * @param {object} filters
 * @param {boolean} filters.includeCancelled
 * @param {{field:string, value:string}|null} filters.structuralFilter - ex: {field:'seller', value:'Olinger - BRU'}
 * @param {string[]|null} filters.searchTerms - tokens da busca global (mutuamente exclusivo com structuralFilter)
 * @param {Date|null} filters.dateFrom
 * @param {Date|null} filters.dateTo
 */
export function buildHistoricoQuery(filters) {
  const clauses = [];

  if (!filters.includeCancelled) {
    clauses.push(where('cancelled', '==', false));
  }

  if (filters.structuralFilter) {
    clauses.push(where(filters.structuralFilter.field, '==', filters.structuralFilter.value));
  } else if (filters.searchTerms && filters.searchTerms.length > 0) {
    clauses.push(where('searchTokens', 'array-contains-any', filters.searchTerms.slice(0, 30)));
  }

  if (filters.dateFrom) {
    clauses.push(where('createdAt', '>=', Timestamp.fromDate(filters.dateFrom)));
  }
  if (filters.dateTo) {
    clauses.push(where('createdAt', '<=', Timestamp.fromDate(filters.dateTo)));
  }

  return query(collection(db, 'ecsRecords'), ...clauses, orderBy('createdAt', 'desc'));
}

/** Total de resultados para os filtros atuais (para exibir "X resultados"). */
export async function countHistorico(filters) {
  const baseQuery = buildHistoricoQuery(filters);
  const snap = await getCountFromServer(baseQuery);
  return snap.data().count;
}

/**
 * Busca registros para agregação client-side (Relatórios). O Firestore não
 * tem GROUP BY nativo, então trazemos os registros do período (com um teto
 * de segurança) e agregamos por mês/vendedor/estado/produto no navegador.
 * Reaproveita os MESMOS índices do Histórico — nenhum índice novo aqui.
 */
export async function fetchEcsForAggregation(filters, capSize = 2000) {
  const baseQuery = buildHistoricoQuery(filters);
  const snap = await getDocs(query(baseQuery, limit(capSize)));
  return {
    records: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    truncated: snap.docs.length >= capSize,
  };
}

/**
 * Contagem de ECS por dia nos últimos `days` dias (mais antigo primeiro),
 * usada só para o sparkline decorativo do Dashboard quando os números
 * estão ocultos — por isso devolve só o array de contagens, sem datas.
 */
export async function fetchDailyActivityCounts(days = 14) {
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const q = query(
    collection(db, 'ecsRecords'),
    where('cancelled', '==', false),
    where('createdAt', '>=', Timestamp.fromDate(start)),
    orderBy('createdAt', 'desc'),
    limit(1000)
  );
  const snap = await getDocs(q);

  const buckets = [];
  const keyToIndex = new Map();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    keyToIndex.set(d.toDateString(), i);
    buckets.push(0);
  }

  snap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const date = data.createdAt?.toDate ? data.createdAt.toDate() : null;
    if (!date) return;
    const idx = keyToIndex.get(date.toDateString());
    if (idx != null) buckets[idx] += 1;
  });

  return buckets;
}

/**
 * Busca uma página de resultados.
 * @param {object} filters - mesmo formato de buildHistoricoQuery
 * @param {object} [page]
 * @param {number} [page.pageSize]
 * @param {object|null} [page.cursor] - doc snapshot de referência (startAfter/endBefore)
 * @param {'next'|'prev'} [page.direction]
 */
export async function fetchHistoricoPage(filters, { pageSize = 25, cursor = null, direction = 'next' } = {}) {
  const baseQuery = buildHistoricoQuery(filters);

  let pageQuery;
  if (!cursor) {
    pageQuery = query(baseQuery, limit(pageSize));
  } else if (direction === 'next') {
    pageQuery = query(baseQuery, startAfter(cursor), limit(pageSize));
  } else {
    pageQuery = query(baseQuery, endBefore(cursor), limitToLast(pageSize));
  }

  const snap = await getDocs(pageQuery);
  return {
    records: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    firstDoc: snap.docs[0] || null,
    lastDoc: snap.docs[snap.docs.length - 1] || null,
    isEmpty: snap.empty,
  };
}
