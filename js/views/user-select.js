import { setCurrentUser } from '../identity.js';
import { getResponsaveis } from '../settings-service.js';
import { showToast } from '../ui.js';

const FIEDLER_LOGO_URL = 'https://www.fiedler.com.br/wp-content/uploads/2025/12/fiedler-topo.png';

/**
 * @param {HTMLElement} root
 * @param {()=>void} onSelected
 */
export async function renderUserSelect(root, onSelected) {
  root.innerHTML = `
    <div class="fullscreen-view">
      <div class="user-select-card">
        <div class="user-select-card__brand">
          <img class="user-select-card__logo" src="${FIEDLER_LOGO_URL}" alt="FIEDLER Automação Industrial" />
          <div class="user-select-card__mark">Solução interna · Fiedler</div>
        </div>
        <div class="user-select-card__body">
          <h1>Sistema ECS</h1>
          <p>Quem está utilizando este computador?</p>
          <div data-options>
            <div class="skeleton-row" style="height:44px;"></div>
            <div class="skeleton-row" style="height:44px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  let responsaveis = [];
  try {
    responsaveis = await getResponsaveis();
  } catch (err) {
    showToast('Não foi possível carregar a lista de responsáveis. Verifique a conexão e a configuração do Firebase.', 'error');
    console.error(err);
  }

  const optionsEl = root.querySelector('[data-options]');
  const active = responsaveis.filter((r) => r.active !== false);

  if (active.length === 0) {
    optionsEl.innerHTML = `<p class="hint">Nenhum responsável cadastrado em settings/responsaveis.</p>`;
    return;
  }

  optionsEl.innerHTML = active
    .map(
      (r) => `
      <button type="button" class="user-option" data-code="${r.code}" data-name="${r.name}">
        <span class="user-option__badge">${r.code}</span>
        <span>${r.name}</span>
      </button>`
    )
    .join('');

  optionsEl.querySelectorAll('[data-code]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setCurrentUser({ code: btn.dataset.code, name: btn.dataset.name });
      onSelected();
    });
  });
}
