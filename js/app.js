import { getCurrentUser } from './identity.js';
import { renderUserSelect } from './views/user-select.js';
import { renderSidebar } from './components/sidebar.js';
import { renderTopbar } from './components/topbar.js';
import { renderNewEcs } from './views/new-ecs.js';
import { renderRecentList } from './views/recent-list.js';
import { renderHistory } from './views/history.js';

const VIEWS = {
  'new-ecs': { title: 'Novo ECS', render: renderNewEcs },
  recent: { title: 'Últimos ECS', render: renderRecentList },
  history: { title: 'Histórico ECS', render: renderHistory },
};

const appEl = document.getElementById('app');

function boot() {
  const user = getCurrentUser();
  if (!user) {
    renderUserSelect(appEl, boot);
    return;
  }
  renderShell(user, 'new-ecs');
}

function renderShell(user, initialViewId) {
  appEl.innerHTML = `
    <div class="shell">
      <aside class="sidebar" data-sidebar></aside>
      <div>
        <header class="topbar" data-topbar></header>
        <main data-content></main>
      </div>
    </div>
  `;

  const sidebarEl = appEl.querySelector('[data-sidebar]');
  const topbarEl = appEl.querySelector('[data-topbar]');
  const contentEl = appEl.querySelector('[data-content]');

  function navigate(viewId) {
    const view = VIEWS[viewId] || VIEWS['new-ecs'];
    renderSidebar(sidebarEl, user, viewId, navigate, boot);
    renderTopbar(topbarEl, view.title, () => navigate('new-ecs'));
    view.render(contentEl);
  }

  navigate(initialViewId);
}

boot();
