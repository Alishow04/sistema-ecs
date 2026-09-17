// Router mínimo — permite que qualquer view (não só a sidebar/topbar) mande
// o app trocar de tela, sem precisar passar `navigate` por parâmetro em toda
// cadeia de funções. app.js registra a implementação real uma vez no boot.

let _navigate = null;

/** Chamado por app.js para registrar a função real de navegação do shell. */
export function registerNavigate(fn) {
  _navigate = fn;
}

/**
 * Navega para outra view do shell.
 * @param {string} viewId
 * @param {object} [params] - ex: { id: '2026-1900', backTo: 'history' }
 */
export function goTo(viewId, params = {}) {
  if (!_navigate) {
    console.warn('Router ainda não inicializado.');
    return;
  }
  _navigate(viewId, params);
}
