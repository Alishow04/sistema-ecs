import { getCurrentUser } from './identity.js';
import { renderUserSelect } from './views/user-select.js';
import { renderSidebar } from './components/sidebar.js';
import { renderTopbar } from './components/topbar.js';
import { renderNewEcs } from './views/new-ecs.js';
import { renderRecentList } from './views/recent-list.js';
import { renderHistory } from './views/history.js';
import { renderDetails } from './views/details.js';
import { renderDashboard } from './views/dashboard.js';
import { renderReports } from './views/reports.js';
import { registerNavigate } from './router.js';

const VIEWS = {
  dashboard: { title: 'Dashboard', render: renderDashboard },
  'new-ecs': { title: 'Novo ECS', render: renderNewEcs },
  recent: { title: 'Últimos ECS', render: renderRecentList },
  history: { title: 'Histórico ECS', render: renderHistory },
  details: { title: 'Detalhes do ECS', render: renderDetails },
  reports: { title: 'Relatórios', render: renderReports },
};

const appEl = document.getElementById('app');

function boot() {
  const user = getCurrentUser();
  if (!user) {
    renderUserSelect(appEl, boot);
    return;
  }
  renderShell(user, 'dashboard');
}

function renderShell(user, initialViewId, initialParams = {}) {
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

  function navigate(viewId, params = {}) {
    const view = VIEWS[viewId] || VIEWS['new-ecs'];
    // A sidebar só destaca itens que têm link próprio nela (details não tem).
    renderSidebar(sidebarEl, user, viewId, navigate, boot);
    renderTopbar(topbarEl, view.title, () => navigate('new-ecs'));
    view.render(contentEl, params);
  }

  registerNavigate(navigate);
  navigate(initialViewId, initialParams);
}

boot();
