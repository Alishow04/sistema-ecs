/*
  ONDE COLAR:
  No arquivo js/firebase-service.js do Sistema ECS, no final do arquivo
  (depois da última função exportada, fetchHistoricoPage). É só uma função
  nova — não mexe em nada que já existe.
*/

/**
 * Busca um ECS pelo código público (ex.: "ECS-AK-26-1577"), não pelo docId
 * interno ("{ano}-{sequencia}"). Usado pelo deep-link vindo do Fiedler SPX
 * Hub, que só conhece o código — o docId é um detalhe interno do ECS.
 * Devolve null se não achar (não lança erro).
 */
export async function fetchEcsByCode(code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return null;

  const q = query(
    collection(db, 'ecsRecords'),
    where('ecsCode', '==', normalized)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;

  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}
