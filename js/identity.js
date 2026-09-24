// Identidade do Sistema ECS derivada exclusivamente do Firebase Authentication.
// Não há mais seleção manual nem localStorage como fonte de identidade.

const PROFILE_BY_EMAIL = Object.freeze({
  'alison@fiedler.com.br': { code: 'AK', name: 'Alison Körtelt' },
  'murilo@fiedler.com.br': { code: 'ML', name: 'Murilo Lini' },
  'caua@fiedler.com.br': { code: 'CP', name: 'Cauã Pitz' },
});

let currentUser = null;

export function profileForEmail(email) {
  return PROFILE_BY_EMAIL[String(email || '').trim().toLowerCase()] || null;
}

export function isAuthorizedEmail(email) {
  return Boolean(profileForEmail(email));
}

export function setCurrentUserFromFirebase(firebaseUser) {
  if (!firebaseUser) {
    currentUser = null;
    return null;
  }

  const profile = profileForEmail(firebaseUser.email);
  if (!profile) {
    currentUser = null;
    return null;
  }

  currentUser = {
    ...profile,
    email: String(firebaseUser.email || '').trim().toLowerCase(),
    uid: firebaseUser.uid,
  };
  return currentUser;
}

export function getCurrentUser() {
  return currentUser;
}

export function clearCurrentUser() {
  currentUser = null;
}
