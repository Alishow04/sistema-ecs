/**
 * @param {HTMLElement} container
 * @param {string} title
 * @param {(id:string)=>void} onNewEcs - chamado ao clicar em "+ Novo ECS"
 */
export function renderTopbar(container, title, onNewEcs) {
  container.innerHTML = `
    <div class="topbar__title">${title}</div>
    <div class="topbar__search">
      <input type="text" placeholder="Buscar por ECS, cliente, vendedor... (em breve)" disabled />
    </div>
    <div class="topbar__actions">
      <button type="button" class="btn btn--primary" data-new-ecs>+ Novo ECS</button>
    </div>
  `;
  container.querySelector('[data-new-ecs]').addEventListener('click', onNewEcs);
}
