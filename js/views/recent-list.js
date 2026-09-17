import { fetchRecentEcs } from '../firebase-service.js';
import { renderEcsTable } from '../components/ecs-table.js';
import { goTo } from '../router.js';

let cachedRecords = [];

export async function renderRecentList(root) {
  root.innerHTML = `
    <div class="content">
      <div class="card">
        <div class="card__header">
          <div class="card__title-block">
            <h2>Últimos ECS</h2>
            <span>Os 20 registros mais recentes. Para filtros completos e período, use o Histórico.</span>
          </div>
        </div>
        <div class="field" style="margin-bottom:14px;">
          <input type="text" placeholder="Filtrar nesta lista por código, cliente, vendedor..." data-local-filter />
        </div>
        <div class="table-wrap" data-table-region>
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
        </div>
      </div>
    </div>
  `;

  const tableRegion = root.querySelector('[data-table-region]');

  try {
    cachedRecords = await fetchRecentEcs(20);
  } catch (err) {
    console.error(err);
    tableRegion.innerHTML = `<div class="table-empty">Não foi possível carregar os registros. Verifique a configuração do Firebase.</div>`;
    return;
  }

  const openDetail = (id) => goTo('details', { id, backTo: 'recent' });
  renderEcsTable(tableRegion, cachedRecords, openDetail, 'Nenhum ECS encontrado. Crie o primeiro em "+ Novo ECS".');

  root.querySelector('[data-local-filter]').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    const filtered = term
      ? cachedRecords.filter((r) => (r.searchTokens || []).some((t) => t.includes(term)))
      : cachedRecords;
    renderEcsTable(tableRegion, filtered, openDetail);
  });
}
