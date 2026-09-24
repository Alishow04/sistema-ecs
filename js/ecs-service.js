// Regras de negócio do ECS. Views nunca falam com o Firestore diretamente —
// sempre passam por aqui. É este arquivo que garante que nenhum ECS duplicado
// ou fora de sequência seja criado (ver seção 3 da análise de arquitetura).

import {
  db,
  doc,
  runTransaction,
  serverTimestamp,
  collection,
  query,
  orderBy,
  getDocs,
} from './firebase-service.js';
import { buildEcsCode } from './utils/format.js';
import { buildSearchTokens } from './utils/search-tokens.js';

const EDITABLE_FIELDS = [
  'client', 'requester', 'seller', 'branch', 'state', 'product', 'brand', 'ecsDate', 'notes',
];

/**
 * Cria um novo ECS de forma atômica:
 * 1. lê o contador do ano dentro da transação
 * 2. incrementa
 * 3. grava o registro com o código gerado
 * Se dois usuários criarem ao mesmo tempo, o Firestore reexecuta
 * automaticamente a transação perdedora — nunca gera duas vezes a
 * mesma sequência.
 *
 * @param {object} input - dados vindos do formulário (sem sequence/ecsCode)
 * @param {{code:string,name:string}} user - responsável pela criação (identity.js)
 * @returns {Promise<{id:string, ecsCode:string, sequence:number}>}
 */
export async function createEcs(input, user) {
  const year = new Date().getFullYear();
  const counterRef = doc(db, 'ecsCounters', String(year));

  const result = await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    const currentSequence = counterSnap.exists()
      ? counterSnap.data().currentSequence
      : 0;
    const nextSequence = currentSequence + 1;

    const docId = `${year}-${nextSequence}`;
    const ecsCode = buildEcsCode(user.code, year, nextSequence);
    const recordRef = doc(collection(db, 'ecsRecords'), docId);

    const record = {
      ecsCode,
      sequence: nextSequence,
      year,
      creatorCode: user.code,
      creatorName: user.name,
      creatorEmail: user.email || '',
      creatorUid: user.uid || '',
      client: input.client || '',
      requester: input.requester || '',
      seller: input.seller || '',
      branch: input.branch || '',
      state: input.state || '', // derivado da filial no momento do submit (ver settings-service.js)
      product: input.product || '',
      brand: input.brand || '',
      ecsDate: input.ecsDate,
      notes: input.notes || '',
      cancelled: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: user.code,
    };
    record.searchTokens = buildSearchTokens(record);

    transaction.set(counterRef, { currentSequence: nextSequence }, { merge: true });
    transaction.set(recordRef, record);

    return { id: docId, ecsCode, sequence: nextSequence };
  });

  return result;
}

/**
 * Edita um ECS existente. Só grava os campos que realmente mudaram e cria
 * uma entrada em `ecsRecords/{id}/history` para cada um deles — tudo dentro
 * da mesma transação, então ou tudo é gravado (dado + histórico) ou nada é.
 *
 * Campos de identidade (ecsCode, sequence, year, creatorCode, createdAt)
 * não passam por aqui — nem o Firestore Security Rules deixaria alterá-los
 * (ver firestore.rules).
 *
 * @param {string} id - docId ("{ano}-{sequencia}")
 * @param {object} changes - valores atuais do formulário para os campos editáveis
 * @param {{code:string,name:string}} user - quem está editando
 */
export async function updateEcs(id, changes, user) {
  const recordRef = doc(db, 'ecsRecords', id);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(recordRef);
    if (!snap.exists()) throw new Error('ECS não encontrado.');
    const current = snap.data();

    const updates = {};
    const historyEntries = [];

    EDITABLE_FIELDS.forEach((field) => {
      const newValue = changes[field] ?? '';
      const oldValue = current[field] ?? '';
      if (newValue !== oldValue) {
        updates[field] = newValue;
        historyEntries.push({ field, oldValue, newValue });
      }
    });

    if (historyEntries.length === 0) return; // nada mudou, não grava à toa

    const merged = { ...current, ...updates };
    updates.searchTokens = buildSearchTokens(merged);
    updates.updatedAt = serverTimestamp();

    transaction.update(recordRef, updates);

    historyEntries.forEach((entry) => {
      const historyRef = doc(collection(recordRef, 'history'));
      transaction.set(historyRef, {
        ...entry,
        changedBy: user.code,
        changedByEmail: user.email || '',
        changedByUid: user.uid || '',
        changedAt: serverTimestamp(),
      });
    });
  });
}

/**
 * Cancela ou reativa um ECS sem excluí-lo (regra: "ECS criado nunca é
 * reutilizado" — cancelar não libera a sequência nem apaga o registro,
 * só marca `cancelled`). Também registrado no histórico.
 */
export async function setEcsCancelled(id, cancelled, user) {
  const recordRef = doc(db, 'ecsRecords', id);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(recordRef);
    if (!snap.exists()) throw new Error('ECS não encontrado.');
    const current = snap.data();

    if (current.cancelled === cancelled) return;

    transaction.update(recordRef, { cancelled, updatedAt: serverTimestamp() });

    const historyRef = doc(collection(recordRef, 'history'));
    transaction.set(historyRef, {
      field: 'cancelled',
      oldValue: current.cancelled,
      newValue: cancelled,
      changedBy: user.code,
      changedByEmail: user.email || '',
      changedByUid: user.uid || '',
      changedAt: serverTimestamp(),
    });
  });
}

/** Histórico de alterações de um ECS, mais recente primeiro. */
export async function fetchEcsHistory(id) {
  const recordRef = doc(db, 'ecsRecords', id);
  const q = query(collection(recordRef, 'history'), orderBy('changedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
