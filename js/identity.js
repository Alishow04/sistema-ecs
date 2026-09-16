// Identificação do responsável sem login (ver seção 5 da análise de arquitetura).
//
// Importante: todo o resto do app deve chamar getCurrentUser()/setCurrentUser()
// daqui — nunca ler localStorage diretamente. Isso é o que permite trocar esse
// mecanismo por Firebase Authentication no futuro sem tocar em mais nada.

const STORAGE_KEY = 'ecs_user';

export function getCurrentUser() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** user: { code: 'AK', name: 'Alison Körtelt' } */
export function setCurrentUser(user) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function clearCurrentUser() {
  localStorage.removeItem(STORAGE_KEY);
}
