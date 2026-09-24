import { signInUser, sendPasswordReset } from '../auth-service.js';
import { isAuthorizedEmail } from '../identity.js';
import { showToast } from '../ui.js';

const FIEDLER_LOGO_URL = 'https://www.fiedler.com.br/wp-content/uploads/2025/12/fiedler-topo.png';

function messageForAuthError(err) {
  const map = {
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/user-disabled': 'Este usuário está desativado.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
    'auth/network-request-failed': 'Não foi possível conectar ao Firebase.',
  };
  return map[err?.code] || 'Não foi possível entrar no Sistema ECS.';
}

export function renderLogin(root) {
  root.innerHTML = `
    <div class="fullscreen-view">
      <div class="user-select-card auth-card">
        <div class="user-select-card__brand">
          <img class="user-select-card__logo" src="${FIEDLER_LOGO_URL}" alt="FIEDLER Automação Industrial" />
          <div class="user-select-card__mark">Solução interna · Fiedler</div>
        </div>
        <div class="user-select-card__body">
          <h1>Sistema ECS</h1>
          <p>Entre com a mesma conta utilizada na Central de Orçamentos SPX.</p>

          <form data-login-form class="auth-form">
            <label for="ecs-login-email">E-mail</label>
            <input id="ecs-login-email" type="email" autocomplete="username" required placeholder="voce@fiedler.com.br" />

            <label for="ecs-login-password">Senha</label>
            <input id="ecs-login-password" type="password" autocomplete="current-password" required />

            <div class="auth-error" data-auth-error hidden></div>

            <button type="submit" class="btn btn--primary auth-submit" data-submit>Entrar</button>
            <button type="button" class="auth-reset" data-reset>Esqueci minha senha</button>
          </form>
        </div>
      </div>
    </div>
  `;

  const form = root.querySelector('[data-login-form]');
  const emailEl = root.querySelector('#ecs-login-email');
  const passwordEl = root.querySelector('#ecs-login-password');
  const errorEl = root.querySelector('[data-auth-error]');
  const submitBtn = root.querySelector('[data-submit]');
  const resetBtn = root.querySelector('[data-reset]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.hidden = true;

    const email = emailEl.value.trim().toLowerCase();
    if (!isAuthorizedEmail(email)) {
      errorEl.textContent = 'Este e-mail não está autorizado a utilizar o Sistema ECS.';
      errorEl.hidden = false;
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Entrando...';
    try {
      await signInUser(email, passwordEl.value);
      // O app.js observa a sessão e abre o sistema automaticamente.
    } catch (err) {
      console.error(err);
      errorEl.textContent = messageForAuthError(err);
      errorEl.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Entrar';
    }
  });

  resetBtn.addEventListener('click', async () => {
    const email = emailEl.value.trim().toLowerCase();
    if (!email) {
      showToast('Informe seu e-mail antes de solicitar a redefinição.', 'error');
      emailEl.focus();
      return;
    }
    if (!isAuthorizedEmail(email)) {
      showToast('Este e-mail não está autorizado no Sistema ECS.', 'error');
      return;
    }
    try {
      await sendPasswordReset(email);
      showToast('E-mail de redefinição enviado.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Não foi possível enviar o e-mail de redefinição.', 'error');
    }
  });
}
