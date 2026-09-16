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

/**
 * Tokeniza o texto digitado na busca global com a MESMA normalização usada
 * em buildSearchTokens, para que `array-contains-any` encontre os registros.
 * Ex: "ECS-AK-26-1900" -> ["ecs-ak-26-1900","ecs","ak","26","1900"]
 */
export function tokenizeQuery(text) {
  const tokens = new Set();
  const trimmed = String(text || '').trim();
  if (!trimmed) return [];

  if (trimmed.includes('-')) tokens.add(normalize(trimmed));
  words(trimmed).forEach((w) => tokens.add(w));

  return Array.from(tokens);
}
