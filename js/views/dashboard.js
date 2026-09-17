// Dashboard — tela inicial do app. Só KPIs de contagem + atalho para os
// últimos ECS; agregações mais pesadas (produto mais comum, UF com mais
// demanda, gráficos) ficam para a etapa de Relatórios, que pode exigir
// abordagem diferente (Firestore não faz GROUP BY nativo e barato).
//
// Todos os KPIs reaproveitam buildHistoricoQuery/countHistorico do
// Histórico — nenhum índice novo do Firestore é necessário aqui.

import { countHistorico, fetchRecentEcs } from '../firebase-service.js';
import { getCurrentUser } from '../identity.js';
import { renderEcsTable } from '../components/ecs-table.js';
import { goTo } from '../router.js';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
function startOfMonth(date) {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}
function startOfYear(date) {
  const d = startOfMonth(date);
  d.setMonth(0);
  return d;
}

export async function renderDashboard(root) {
  const user = getCurrentUser();
  const now = new Date();

  root.innerHTML = `
    <div class="content">
      <div class="card__title-block" style="border:none; padding-left:0; margin-bottom:16px;">
        <h1>${greeting()}, ${user.name.split(' ')[0]}</h1>
      </div>

      <div class="kpi-row" data-kpi-row>
        ${renderKpiSkeleton('Hoje')}
        ${renderKpiSkeleton('Este mês')}
        ${renderKpiSkeleton('Este ano')}
        ${renderKpiSkeleton('Meus ECS (ano)')}
      </div>

      <div class="card">
        <div class="card__header">
          <div class="card__title-block"><h2>Últimos ECS</h2></div>
          <button type="button" class="btn btn--ghost" data-see-all>Ver histórico completo →</button>
        </div>
        <div class="table-wrap" data-table-region>
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
        </div>
      </div>
    </div>
  `;

  root.querySelector('[data-see-all]').addEventListener('click', () => goTo('history'));

  const baseFilters = { includeCancelled: false, structuralFilter: null, searchTerms: null };

  const [today, month, year, mine, recent] = await Promise.all([
    countHistorico({ ...baseFilters, dateFrom: startOfDay(now), dateTo: now }),
    countHistorico({ ...baseFilters, dateFrom: startOfMonth(now), dateTo: now }),
    countHistorico({ ...baseFilters, dateFrom: startOfYear(now), dateTo: now }),
    countHistorico({
      ...baseFilters,
      structuralFilter: { field: 'creatorCode', value: user.code },
      dateFrom: startOfYear(now),
      dateTo: now,
    }),
    fetchRecentEcs(5),
  ]).catch((err) => {
    console.error(err);
    return [null, null, null, null, []];
  });

  const kpiRow = root.querySelector('[data-kpi-row]');
  kpiRow.innerHTML = `
    ${renderKpiCard('Hoje', today)}
    ${renderKpiCard('Este mês', month)}
    ${renderKpiCard('Este ano', year)}
    ${renderKpiCard('Meus ECS (ano)', mine)}
  `;

  const tableRegion = root.querySelector('[data-table-region]');
  renderEcsTable(
    tableRegion,
    recent,
    (id) => goTo('details', { id, backTo: 'dashboard' }),
    'Nenhum ECS encontrado. Crie o primeiro em "+ Novo ECS".'
  );
}

function renderKpiSkeleton(label) {
  return `
    <div class="kpi-card">
      <div class="skeleton-row" style="height:26px; width:50%;"></div>
      <div class="kpi-card__label">${label}</div>
    </div>
  `;
}

function renderKpiCard(label, value) {
  return `
    <div class="kpi-card">
      <div class="kpi-card__value">${value == null ? '—' : value}</div>
      <div class="kpi-card__label">${label}</div>
    </div>
  `;
}
