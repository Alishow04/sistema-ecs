// Relatórios — tela de análise deliberada (diferente do Dashboard: aqui os
// números aparecem de verdade, porque é uma consulta intencional, não algo
// que a pessoa encara todo dia). Ver discussão de produto no README.
//
// O Firestore não tem GROUP BY nativo — trazemos os registros do período
// (com teto de segurança) via fetchEcsForAggregation() e agregamos por
// mês/vendedor/estado/produto no navegador. Para o volume de um sistema
// interno isso é perfeitamente viável; se o volume crescer muito, a
// migração natural é para contadores denormalizados atualizados a cada
// criação/edição, em vez de reagregar tudo a cada visita à tela.

import { fetchEcsForAggregation } from '../firebase-service.js';
import { showToast } from '../ui.js';

const PALETTE = ['#0054A6', '#0082C6', '#284480', '#5B9BD5', '#89C4E8', '#B7DDF2', '#3F5064', '#7E8CA1'];
const MONTH_LABELS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

let chartInstances = {};

function destroyCharts() {
  Object.values(chartInstances).forEach((c) => c && c.destroy());
  chartInstances = {};
}

function startOfMonthsAgo(months) {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - (months - 1));
  return d;
}
function startOfYear() {
  const d = new Date();
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

const PRESETS = {
  month: { label: 'Este mês', from: () => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; } },
  last3: { label: 'Últimos 3 meses', from: () => startOfMonthsAgo(3) },
  year: { label: 'Este ano', from: () => startOfYear() },
  custom: { label: 'Personalizado', from: null },
};

export async function renderReports(root) {
  root.innerHTML = `
    <div class="content">
      <div class="card">
        <div class="card__header">
          <div class="card__title-block">
            <h2>Relatórios</h2>
            <span>Números de verdade aqui — esta tela é para análise, não para acompanhamento diário.</span>
          </div>
        </div>

        <div class="form-grid" style="margin-bottom:16px;">
          <div class="field">
            <label>Período</label>
            <select data-preset>
              ${Object.entries(PRESETS).map(([key, p]) => `<option value="${key}">${p.label}</option>`).join('')}
            </select>
          </div>
          <div></div>
          <div class="field" data-custom-from hidden>
            <label>De</label>
            <input type="date" data-date-from />
          </div>
          <div class="field" data-custom-to hidden>
            <label>Até</label>
            <input type="date" data-date-to />
          </div>
        </div>

        <div class="form-actions" style="justify-content:flex-start; padding-top:0; border-top:none; margin-top:0; margin-bottom:8px;">
          <button type="button" class="btn btn--primary" data-apply>Gerar relatório</button>
        </div>
        <p class="hint" data-truncated-warning hidden>
          O período selecionado tem mais registros do que o relatório processa de uma vez; os números abaixo consideram só os mais recentes dentro do limite. Reduza o período para um resultado exato.
        </p>
      </div>

      <div class="kpi-row" data-summary-row></div>

      <div class="card">
        <div class="card__title-block" style="margin-bottom:14px;"><h2>ECS por mês</h2></div>
        <div style="height:260px;"><canvas data-chart="month"></canvas></div>
      </div>

      <div class="card">
        <div class="card__title-block" style="margin-bottom:14px;"><h2>Vendedores mais ativos</h2></div>
        <div style="height:280px;"><canvas data-chart="seller"></canvas></div>
      </div>

      <div class="card">
        <div class="card__title-block" style="margin-bottom:14px;"><h2>Distribuição por estado (UF)</h2></div>
        <div style="height:280px;"><canvas data-chart="state"></canvas></div>
      </div>

      <div class="card">
        <div class="card__title-block" style="margin-bottom:14px;"><h2>Distribuição por produto</h2></div>
        <div style="height:280px;"><canvas data-chart="product"></canvas></div>
      </div>
    </div>
  `;

  const presetSelect = root.querySelector('[data-preset]');
  const customFrom = root.querySelector('[data-custom-from]');
  const customTo = root.querySelector('[data-custom-to]');
  const dateFrom = root.querySelector('[data-date-from]');
  const dateTo = root.querySelector('[data-date-to]');

  presetSelect.addEventListener('change', () => {
    const isCustom = presetSelect.value === 'custom';
    customFrom.hidden = !isCustom;
    customTo.hidden = !isCustom;
  });

  root.querySelector('[data-apply]').addEventListener('click', () => generateReport(root));

  generateReport(root);
}

async function generateReport(root) {
  const presetSelect = root.querySelector('[data-preset]');
  const preset = PRESETS[presetSelect.value];
  const now = new Date();

  let from;
  let to = now;
  if (presetSelect.value === 'custom') {
    const fromInput = root.querySelector('[data-date-from]').value;
    const toInput = root.querySelector('[data-date-to]').value;
    if (!fromInput) {
      showToast('Selecione a data inicial do período personalizado.', 'error');
      return;
    }
    from = new Date(`${fromInput}T00:00:00`);
    to = toInput ? new Date(`${toInput}T23:59:59`) : now;
  } else {
    from = preset.from();
  }

  root.querySelector('[data-summary-row]').innerHTML = renderSummarySkeleton();
  root.querySelectorAll('canvas').forEach((c) => { c.style.opacity = '0.3'; });

  let records = [];
  let truncated = false;
  try {
    const result = await fetchEcsForAggregation({
      includeCancelled: false,
      structuralFilter: null,
      searchTerms: null,
      dateFrom: from,
      dateTo: to,
    });
    records = result.records;
    truncated = result.truncated;
  } catch (err) {
    console.error(err);
    showToast('Não foi possível gerar o relatório. Veja o console para detalhes.', 'error');
    root.querySelector('[data-summary-row]').innerHTML = `<div class="table-empty">Erro ao carregar os dados.</div>`;
    return;
  }

  root.querySelector('[data-truncated-warning]').hidden = !truncated;

  renderSummary(root, records, from, to);
  renderCharts(root, records, from, to);
}

function renderSummarySkeleton() {
  return ['ECS no período', 'Clientes distintos', 'Vendedor mais ativo', 'Produto mais pedido']
    .map((label) => `
      <div class="kpi-card">
        <div class="skeleton-row" style="height:22px; width:60%;"></div>
        <div class="kpi-card__label">${label}</div>
      </div>
    `).join('');
}

function topKey(counts) {
  let best = null;
  let bestCount = -1;
  counts.forEach((count, key) => {
    if (count > bestCount) { best = key; bestCount = count; }
  });
  return best;
}

function renderSummary(root, records, from, to) {
  const clients = new Set(records.map((r) => (r.client || '').trim().toLowerCase()).filter(Boolean));
  const sellerCounts = countBy(records, 'seller');
  const productCounts = countBy(records, 'product');

  root.querySelector('[data-summary-row]').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-card__value">${records.length}</div>
      <div class="kpi-card__label">ECS no período</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-card__value">${clients.size}</div>
      <div class="kpi-card__label">Clientes distintos</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-card__value" style="font-size:16px;">${topKey(sellerCounts) || '—'}</div>
      <div class="kpi-card__label">Vendedor mais ativo</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-card__value" style="font-size:16px;">${topKey(productCounts) || '—'}</div>
      <div class="kpi-card__label">Produto mais pedido</div>
    </div>
  `;
}

function countBy(records, field) {
  const map = new Map();
  records.forEach((r) => {
    const key = (r[field] || '').trim();
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
}

function topN(map, n) {
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, n);
}

function monthlySeries(records, from, to) {
  const months = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cursor <= end) {
    months.push({ key: `${cursor.getFullYear()}-${cursor.getMonth()}`, label: `${MONTH_LABELS[cursor.getMonth()]}/${String(cursor.getFullYear()).slice(-2)}`, count: 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const index = new Map(months.map((m, i) => [m.key, i]));

  records.forEach((r) => {
    const date = r.createdAt?.toDate ? r.createdAt.toDate() : null;
    if (!date) return;
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const i = index.get(key);
    if (i != null) months[i].count += 1;
  });

  return months;
}

function renderCharts(root, records, from, to) {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js não carregou — verifique a conexão ou o bloqueio de scripts externos.');
    return;
  }
  destroyCharts();

  const months = monthlySeries(records, from, to);
  chartInstances.month = new Chart(root.querySelector('[data-chart="month"]'), {
    type: 'line',
    data: {
      labels: months.map((m) => m.label),
      datasets: [{
        data: months.map((m) => m.count),
        borderColor: '#0054A6',
        backgroundColor: 'rgba(0,84,166,0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 3,
      }],
    },
    options: baseChartOptions({ legend: false }),
  });

  const sellers = topN(countBy(records, 'seller'), 8);
  chartInstances.seller = new Chart(root.querySelector('[data-chart="seller"]'), {
    type: 'bar',
    data: {
      labels: sellers.map(([k]) => k),
      datasets: [{ data: sellers.map(([, v]) => v), backgroundColor: PALETTE }],
    },
    options: baseChartOptions({ legend: false, indexAxis: 'y' }),
  });

  const states = topN(countBy(records, 'state'), 12);
  chartInstances.state = new Chart(root.querySelector('[data-chart="state"]'), {
    type: 'bar',
    data: {
      labels: states.map(([k]) => k),
      datasets: [{ data: states.map(([, v]) => v), backgroundColor: PALETTE }],
    },
    options: baseChartOptions({ legend: false }),
  });

  const products = topN(countBy(records, 'product'), 10);
  chartInstances.product = new Chart(root.querySelector('[data-chart="product"]'), {
    type: 'bar',
    data: {
      labels: products.map(([k]) => k),
      datasets: [{ data: products.map(([, v]) => v), backgroundColor: PALETTE }],
    },
    options: baseChartOptions({ legend: false, indexAxis: 'y' }),
  });

  root.querySelectorAll('canvas').forEach((c) => { c.style.opacity = '1'; });
}

function baseChartOptions({ legend = true, indexAxis = 'x' } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis,
    plugins: { legend: { display: legend } },
    scales: {
      x: { grid: { display: false }, ticks: { precision: 0 } },
      y: { grid: { color: '#E4E7EC' }, ticks: { precision: 0 } },
    },
  };
}
