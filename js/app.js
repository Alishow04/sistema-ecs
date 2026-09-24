import { getCurrentUser } from './identity.js';
import { renderUserSelect } from './views/user-select.js';
import { renderSidebar } from './components/sidebar.js';
import { renderTopbar } from './components/topbar.js';
import { renderNewEcs } from './views/new-ecs.js';
import { renderHistory } from './views/history.js';
import { renderDetails } from './views/details.js';
import { renderDashboard } from './views/dashboard.js';
import { renderReports } from './views/reports.js';
import { renderSettings } from './views/settings.js';
import { registerNavigate } from './router.js';
import { fetchEcsByCode } from './firebase-service.js';
import { showToast } from './ui.js';

const VIEWS = {
  dashboard: { title: 'Dashboard', render: renderDashboard },
  'new-ecs': { title: 'Novo ECS', render: renderNewEcs },
  history: { title: 'Histórico ECS', render: renderHistory },
  details: { title: 'Detalhes do ECS', render: renderDetails },
  reports: { title: 'Relatórios', render: renderReports },
  settings: { title: 'Configurações', render: renderSettings },
};

const appEl = document.getElementById('app');

/**
 * Deep-link vindo do Fiedler SPX Hub: ?ecs=ECS-AK-26-1577
 * Resolve o código público para o docId ("{ano}-{sequencia}") e já abre
 * direto na tela de Detalhes, em vez de cair no Dashboard como de costume.
 * O parâmetro é removido da URL logo em seguida, independente do resultado,
 * pra não tentar de novo sozinho se a pessoa der F5.
 */
async function resolveDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const ecsParam = params.get('ecs');
  if (!ecsParam) return null;

  const url = new URL(window.location.href);
  url.searchParams.delete('ecs');
  window.history.replaceState({}, '', url);

  try {
    const record = await fetchEcsByCode(ecsParam);
    if (!record) {
      showToast(`ECS "${ecsParam}" não encontrado.`, 'error');
      return null;
    }
    return { id: record.id, backTo: 'dashboard' };
  } catch (err) {
    console.error('Deep link (Hub) falhou:', err);
    showToast('Não foi possível abrir o ECS automaticamente.', 'error');
    return null;
  }
}

async function boot() {
  const user = getCurrentUser();
  if (!user) {
    renderUserSelect(appEl, boot);
    return;
  }

  const deepLinkParams = await resolveDeepLink();
  if (deepLinkParams) {
    renderShell(user, 'details', deepLinkParams);
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
    document.title = `${view.title} · Sistema ECS`;
    view.render(contentEl, params);
  }

  registerNavigate(navigate);
  navigate(initialViewId, initialParams);
}

boot();
