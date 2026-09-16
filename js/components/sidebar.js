import { clearCurrentUser } from '../identity.js';

const NAV_ITEMS = [
  { id: 'new-ecs', label: '+ Novo ECS', primary: true },
  { id: 'recent', label: 'Últimos ECS' },
  { id: 'history', label: 'Histórico' },
  // Relatórios / Configurações entram nas próximas etapas.
];

/**
 * Renderiza a sidebar dentro de `container` e liga a navegação ao `onNavigate`.
 * @param {HTMLElement} container
 * @param {{code:string, name:string}} user
 * @param {string} activeId
 * @param {(id:string)=>void} onNavigate
 * @param {()=>void} onSwitchUser
 */
export function renderSidebar(container, user, activeId, onNavigate, onSwitchUser) {
  const initials = user.code.slice(0, 2).toUpperCase();

  container.innerHTML = `
    <div class="sidebar__brand">
      <div class="sidebar__brand-name">Fiedler</div>
      <div class="sidebar__brand-sub">Sistema ECS</div>
    </div>
    <nav class="sidebar__nav">
      ${NAV_ITEMS.map((item) => `
        <button
          type="button"
          class="sidebar__link ${item.primary ? 'sidebar__link--primary' : ''} ${item.id === activeId ? 'is-active' : ''}"
          data-nav="${item.id}"
        >${item.label}</button>
      `).join('')}
    </nav>
    <div class="sidebar__footer">
      <div class="sidebar__user">
        <div class="sidebar__user-badge">${initials}</div>
        <div class="sidebar__user-name">${user.name}</div>
      </div>
      <button type="button" class="sidebar__switch-user" data-switch-user>Trocar usuário</button>
    </div>
  `;

  container.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => onNavigate(btn.dataset.nav));
  });

  container.querySelector('[data-switch-user]').addEventListener('click', () => {
    clearCurrentUser();
    onSwitchUser();
  });
}
