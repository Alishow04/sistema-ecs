const NAV_GROUPS = [
  {
    label: 'Operação',
    items: [
      { id: 'dashboard', number: '01', label: 'Dashboard' },
      { id: 'new-ecs', number: '02', label: 'Novo ECS' },
      { id: 'history', number: '03', label: 'Histórico' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { id: 'reports', number: '04', label: 'Relatórios' },
      { id: 'settings', number: '05', label: 'Configurações' },
    ],
  },
];

const FIEDLER_LOGO_URL = 'https://www.fiedler.com.br/wp-content/uploads/2025/12/fiedler-topo.png';

/**
 * Renderiza a sidebar dentro de `container` e liga a navegação ao `onNavigate`.
 * A estrutura visual replica a linguagem da Central de Orçamentos SPX,
 * preservando integralmente a navegação/mecânica existente do ECS.
 * @param {HTMLElement} container
 * @param {{code:string, name:string}} user
 * @param {string} activeId
 * @param {(id:string)=>void} onNavigate
 * @param {()=>void|Promise<void>} onLogout
 */
export function renderSidebar(container, user, activeId, onNavigate, onLogout) {
  const initials = user.code.slice(0, 2).toUpperCase();

  container.innerHTML = `
    <div class="sidebar__brand">
      <img class="sidebar__brand-logo" src="${FIEDLER_LOGO_URL}" alt="FIEDLER Automação Industrial" />
      <div class="sidebar__brand-mark">Solução interna · Fiedler</div>
      <div class="sidebar__brand-name">Sistema ECS</div>
      <div class="sidebar__brand-sub">Rastreio · Histórico · Relatórios</div>
    </div>

    <nav class="sidebar__nav">
      ${NAV_GROUPS.map((group, groupIndex) => `
        ${groupIndex > 0 ? '<div class="sidebar__divider"></div>' : ''}
        <div class="sidebar__group-label">${group.label}</div>
        ${group.items.map((item) => `
          <button
            type="button"
            class="sidebar__link ${item.id === activeId ? 'is-active' : ''}"
            data-nav="${item.id}"
          >
            <span class="sidebar__link-number">${item.number}</span>
            <span>${item.label}</span>
          </button>
        `).join('')}
      `).join('')}
    </nav>

    <div class="sidebar__footer">
      <div class="sidebar__user">
        <div class="sidebar__user-badge">${initials}</div>
        <div class="sidebar__user-name">${user.name}</div>
      </div>
      <div class="sidebar__user-email">${user.email || ''}</div>\n      <button type="button" class="sidebar__switch-user" data-switch-user>Sair</button>
    </div>
  `;

  container.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => onNavigate(btn.dataset.nav));
  });

  container.querySelector('[data-switch-user]').addEventListener('click', () => {
    onLogout();
  });
}
