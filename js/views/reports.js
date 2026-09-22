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
//
// PDF é gerado via impressão do navegador (window.print + CSS @media
// print), não jsPDF — decisão tomada desde a etapa de arquitetura para não
// adicionar dependência: o navegador já sabe salvar como PDF. CSV é gerado
// na mão (Blob + <a download>), sem lib, com ; como separador e BOM UTF-8
// porque é assim que o Excel em pt-BR abre acentos corretamente.

import { fetchEcsForAggregation } from '../firebase-service.js';
import { getCurrentUser } from '../identity.js';
import { showToast } from '../ui.js';
import { formatDateBR, formatDateTimeBR } from '../utils/format.js';

const PALETTE = ['#0054A6', '#0082C6', '#284480', '#5B9BD5', '#89C4E8', '#B7DDF2', '#3F5064', '#7E8CA1'];
const MONTH_LABELS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

let chartInstances = {};
let printHandlers = null;

// Estado do último relatório gerado — usado pelos botões de exportação,
// que sempre exportam o que está na tela, não refazem a consulta.
let lastRecords = [];
let lastFrom = null;
let lastTo = null;

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
      <div class="print-only" data-print-header>
        <h1 style="margin-bottom:2px;">Relatório ECS — Fiedler Automação Industrial</h1>
        <p data-print-meta style="color:#555; font-size:13px;"></p>
      </div>

      <div class="card">
        <div class="card__header">
          <div class="card__title-block">
            <h2>Relatórios</h2>
          </div>
        </div>

        <div class="form-grid no-print" style="margin-bottom:16px;">
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

        <div class="form-actions form-actions--plain form-actions--between no-print" style="margin-bottom:8px;" data-report-actions>
          <button type="button" class="btn btn--primary" data-apply>Gerar relatório</button>
          <div style="display:flex; gap:10px;">
            <button type="button" class="btn btn--secondary" data-export-csv disabled>⬇ Baixar CSV</button>
            <button type="button" class="btn btn--secondary" data-export-pdf disabled>Imprimir / PDF</button>
          </div>
        </div>
        <p class="hint" data-truncated-warning hidden>
          O período selecionado tem mais registros do que o relatório processa de uma vez; os números abaixo (e a exportação) consideram só os mais recentes dentro do limite. Reduza o período para um resultado exato.
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

  presetSelect.addEventListener('change', () => {
    const isCustom = presetSelect.value === 'custom';
    customFrom.hidden = !isCustom;
    customTo.hidden = !isCustom;
  });

  root.querySelector('[data-apply]').addEventListener('click', () => generateReport(root));
  root.querySelector('[data-export-csv]').addEventListener('click', () => exportCsv());
  root.querySelector('[data-export-pdf]').addEventListener('click', () => window.print());

  setupPrintHandlers(root);
  generateReport(root);
}

/**
 * beforeprint: tira um "print" (toDataURL) de cada gráfico e mostra como
 * <img> no lugar do <canvas> — canvas em si imprime de forma inconsistente
 * entre navegadores, imagem estática não. afterprint: some com as imagens
 * de novo (o canvas volta a aparecer via CSS, sem precisar recriar nada).
 * Reatribuído a cada renderReports() para nunca acumular listener de uma
 * visita antiga à tela.
 */
function setupPrintHandlers(root) {
  if (printHandlers) {
    window.removeEventListener('beforeprint', printHandlers.before);
    window.removeEventListener('afterprint', printHandlers.after);
  }

  const before = () => {
    root.querySelectorAll('canvas[data-chart]').forEach((canvas) => {
      let img = canvas.parentElement.querySelector('img[data-print-img]');
      if (!img) {
        img = document.createElement('img');
        img.setAttribute('data-print-img', '');
        canvas.parentElement.appendChild(img);
      }
      img.src = canvas.toDataURL('image/png');
    });

    const user = getCurrentUser();
    const meta = root.querySelector('[data-print-meta]');
    if (meta && lastFrom && lastTo) {
      meta.textContent = `Período: ${formatDateBR(toIso(lastFrom))} a ${formatDateBR(toIso(lastTo))} · `
        + `Gerado em ${formatDateTimeBR(new Date())} por ${user.name} (${user.code})`;
    }
  };

  const after = () => {
    root.querySelectorAll('img[data-print-img]').forEach((img) => img.remove());
  };

  window.addEventListener('beforeprint', before);
  window.addEventListener('afterprint', after);
  printHandlers = { before, after };
}

function toIso(date) {
  const d = new Date(date);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
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
  root.querySelector('[data-export-csv]').disabled = true;
  root.querySelector('[data-export-pdf]').disabled = true;

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

  lastRecords = records;
  lastFrom = from;
  lastTo = to;

  root.querySelector('[data-truncated-warning]').hidden = !truncated;
  root.querySelector('[data-export-csv]').disabled = false;
  root.querySelector('[data-export-pdf]').disabled = false;

  renderSummary(root, records);
  renderCharts(root, records, from, to);
}

function exportCsv() {
  if (lastRecords.length === 0) {
    showToast('Nada para exportar neste período.', 'error');
    return;
  }

  const headers = ['ECS', 'Data', 'Cliente', 'Solicitante', 'Vendedor', 'Filial', 'UF', 'Produto', 'Marca', 'Responsável', 'Status'];
  const rows = lastRecords.map((r) => [
    r.ecsCode,
    formatDateBR(r.ecsDate),
    r.client,
    r.requester,
    r.seller,
    r.branch,
    r.state,
    r.product,
    r.brand,
    `${r.creatorCode} - ${r.creatorName}`,
    r.cancelled ? 'Cancelado' : 'Ativo',
  ]);

  const escapeCsv = (value) => {
    const s = String(value ?? '');
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  // ; como separador (não ,) e BOM UTF-8 — é o que o Excel em pt-BR espera
  // para abrir direto sem embolar acentuação ou juntar colunas.
  const csvContent = '\uFEFF' + [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(';'))
    .join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio-ecs_${toIso(lastFrom)}_a_${toIso(lastTo)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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

function renderSummary(root, records) {
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
    root.querySelectorAll('canvas[data-chart]').forEach((canvas) => {
      canvas.parentElement.innerHTML = `<div class="table-empty">Não foi possível carregar a biblioteca de gráficos (Chart.js). Os KPIs acima continuam corretos; recarregue a página ou verifique sua conexão.</div>`;
    });
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
