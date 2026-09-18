// Dashboard — tela inicial do app. KPIs de contagem + atalho para os
// últimos ECS. Agregações mais pesadas (produto mais comum, UF com mais
// demanda, gráficos por período) ficam em Relatórios, que é uma tela de
// análise deliberada — diferente do Dashboard, que a pessoa encara todo
// dia. Por isso o Dashboard tem a opção de ocultar os números.

import { countHistorico, fetchRecentEcs, fetchDailyActivityCounts } from '../firebase-service.js';
import { getCurrentUser } from '../identity.js';
import { renderEcsTable } from '../components/ecs-table.js';
import { renderSparklineSvg } from '../components/sparkline.js';
import { goTo } from '../router.js';

const HIDE_NUMBERS_KEY = 'ecs_dashboard_hide_numbers';

function numbersAreHidden() {
  return localStorage.getItem(HIDE_NUMBERS_KEY) === 'true';
}
function setNumbersHidden(hidden) {
  localStorage.setItem(HIDE_NUMBERS_KEY, hidden ? 'true' : 'false');
}

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

  root.innerHTML = `
    <div class="content">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
        <h1>${greeting()}, ${user.name.split(' ')[0]}</h1>
        <button type="button" class="btn btn--ghost" data-toggle-numbers></button>
      </div>

      <div data-kpi-section></div>

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

  const toggleBtn = root.querySelector('[data-toggle-numbers]');
  const kpiSection = root.querySelector('[data-kpi-section]');

  function updateToggleLabel() {
    toggleBtn.textContent = numbersAreHidden() ? '👁 Mostrar números' : '🙈 Ocultar números';
  }
  updateToggleLabel();

  toggleBtn.addEventListener('click', () => {
    setNumbersHidden(!numbersAreHidden());
    updateToggleLabel();
    renderKpiSection(kpiSection, user);
  });

  renderKpiSection(kpiSection, user);

  try {
    const recent = await fetchRecentEcs(5);
    renderEcsTable(
      root.querySelector('[data-table-region]'),
      recent,
      (id) => goTo('details', { id, backTo: 'dashboard' }),
      'Nenhum ECS encontrado. Crie o primeiro em "+ Novo ECS".'
    );
  } catch (err) {
    console.error(err);
    root.querySelector('[data-table-region]').innerHTML = `<div class="table-empty">Não foi possível carregar os últimos ECS.</div>`;
  }
}

async function renderKpiSection(container, user) {
  if (numbersAreHidden()) {
    container.innerHTML = `
      <div class="card" style="margin-bottom:20px;">
        <div data-sparkline-region><div class="skeleton-row" style="height:56px;"></div></div>
        <p class="hint" style="margin-top:10px; text-align:center;">Atividade dos últimos 14 dias (números ocultos)</p>
      </div>
    `;
    try {
      const counts = await fetchDailyActivityCounts(14);
      container.querySelector('[data-sparkline-region]').innerHTML = renderSparklineSvg(counts);
    } catch (err) {
      console.error(err);
      container.querySelector('[data-sparkline-region]').innerHTML = `<div class="hint">Não foi possível carregar a atividade recente.</div>`;
    }
    return;
  }

  container.innerHTML = `
    <div class="kpi-row" data-kpi-row>
      ${renderKpiSkeleton('Hoje')}
      ${renderKpiSkeleton('Este mês')}
      ${renderKpiSkeleton('Este ano')}
      ${renderKpiSkeleton('Meus ECS (ano)')}
    </div>
  `;

  const now = new Date();
  const baseFilters = { includeCancelled: false, structuralFilter: null, searchTerms: null };

  try {
    const [today, month, year, mine] = await Promise.all([
      countHistorico({ ...baseFilters, dateFrom: startOfDay(now), dateTo: now }),
      countHistorico({ ...baseFilters, dateFrom: startOfMonth(now), dateTo: now }),
      countHistorico({ ...baseFilters, dateFrom: startOfYear(now), dateTo: now }),
      countHistorico({
        ...baseFilters,
        structuralFilter: { field: 'creatorCode', value: user.code },
        dateFrom: startOfYear(now),
        dateTo: now,
      }),
    ]);

    container.querySelector('[data-kpi-row]').innerHTML = `
      ${renderKpiCard('Hoje', today)}
      ${renderKpiCard('Este mês', month)}
      ${renderKpiCard('Este ano', year)}
      ${renderKpiCard('Meus ECS (ano)', mine)}
    `;
  } catch (err) {
    console.error(err);
    container.querySelector('[data-kpi-row]').innerHTML = `
      ${renderKpiCard('Hoje', null)}
      ${renderKpiCard('Este mês', null)}
      ${renderKpiCard('Este ano', null)}
      ${renderKpiCard('Meus ECS (ano)', null)}
    `;
  }
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
