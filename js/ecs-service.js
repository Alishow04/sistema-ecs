// Regras de negócio do ECS. Views nunca falam com o Firestore diretamente —
// sempre passam por aqui. É este arquivo que garante que nenhum ECS duplicado
// ou fora de sequência seja criado (ver seção 3 da análise de arquitetura).

import {
  db,
  doc,
  runTransaction,
  serverTimestamp,
  collection,
} from './firebase-service.js';
import { buildEcsCode } from './utils/format.js';
import { buildSearchTokens } from './utils/search-tokens.js';

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
