// Gera o array `searchTokens` gravado em cada ECS, usado para a busca global
// (Firestore não tem full-text/substring nativo — ver análise de arquitetura).

function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // remove acentos
}

function words(str) {
  return normalize(str)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Recebe o registro de ECS (antes ou depois de salvar) e devolve a lista
 * de tokens únicos para o campo searchTokens.
 */
export function buildSearchTokens(record) {
  const tokens = new Set();

  const addAll = (value) => words(value).forEach((w) => tokens.add(w));

  if (record.ecsCode) {
    tokens.add(normalize(record.ecsCode));
    addAll(record.ecsCode);
  }
  if (record.sequence != null) tokens.add(String(record.sequence));
  addAll(record.client);
  addAll(record.requester);
  addAll(record.seller);
  addAll(record.branch);
  addAll(record.state);
  addAll(record.product);
  addAll(record.brand);
  addAll(record.creatorCode);
  addAll(record.creatorName);

  return Array.from(tokens);
}
