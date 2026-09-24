import { clearCurrentUser, setCurrentUserFromFirebase } from './identity.js';
import { observeAuthState, signOutUser } from './auth-service.js';
import { renderLogin } from './views/login.js';
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

async function resolveDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const ecsParam = params.get('ecs');
  if (!ecsParam) return null;

  try {
    const record = await fetchEcsByCode(ecsParam);
    if (!record) {
      showToast(`ECS "${ecsParam}" não encontrado.`, 'error');
      return null;
    }

    // Só remove o parâmetro depois que o registro foi resolvido com sucesso.
    const url = new URL(window.location.href);
    url.searchParams.delete('ecs');
    window.history.replaceState({}, '', url);

    return { id: record.id, backTo: 'dashboard' };
  } catch (err) {
    console.error('Deep link (Hub) falhou:', err);
    showToast('Não foi possível abrir o ECS automaticamente.', 'error');
    return null;
  }
}

async function openAuthenticatedApp(firebaseUser) {
  const user = setCurrentUserFromFirebase(firebaseUser);
  if (!user) {
    showToast('Sua conta não está autorizada no Sistema ECS.', 'error');
    await signOutUser();
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

  async function logout() {
    await signOutUser();
  }

  function navigate(viewId, params = {}) {
    const view = VIEWS[viewId] || VIEWS['new-ecs'];
    renderSidebar(sidebarEl, user, viewId, navigate, logout);
    renderTopbar(topbarEl, view.title, () => navigate('new-ecs'));
    document.title = `${view.title} · Sistema ECS`;
    view.render(contentEl, params);
  }

  registerNavigate(navigate);
  navigate(initialViewId, initialParams);
}

observeAuthState((firebaseUser) => {
  if (!firebaseUser) {
    clearCurrentUser();
    renderLogin(appEl);
    return;
  }
  openAuthenticatedApp(firebaseUser);
});
