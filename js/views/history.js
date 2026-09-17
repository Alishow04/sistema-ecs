// Histórico ECS — consulta completa (item 1+2 do roadmap: Histórico com
// filtros/paginação + Busca global). Decisões de arquitetura aplicadas aqui:
//
// - Período filtra por `createdAt` (não `ecsDate`), porque o Firestore só
//   permite orderBy() no mesmo campo que recebe filtro de intervalo, e
//   queremos sempre ordenar pela criação.
// - No máximo UM filtro estrutural por vez (Responsável OU Vendedor OU
//   Produto OU Filial OU Estado OU Marca), mutuamente exclusivo com a busca
//   livre — decisão registrada na análise de arquitetura para não explodir
//   o número de índices compostos do Firestore. A própria UI deixa isso
//   explícito (um único par de selects "Filtrar por / Valor").
// - Paginação por cursor (startAfter/endBefore), não por número de página —
//   é o jeito nativo do Firestore, sem baixar a coleção inteira.

import {
  fetchHistoricoPage,
  countHistorico,
} from '../firebase-service.js';
import {
  getResponsaveisAtivos,
  getVendedores,
  getProdutos,
  getMarcas,
  getFiliais,
  getEstadosDisponiveis,
} from '../settings-service.js';
import { renderEcsTable } from '../components/ecs-table.js';
import { tokenizeQuery } from '../utils/search-tokens.js';
import { showToast } from '../ui.js';
import { goTo } from '../router.js';

const PAGE_SIZE = 25;

const FILTER_FIELDS = {
  creatorCode: {
    label: 'Responsável',
    load: async () => (await getResponsaveisAtivos()).map((r) => ({ value: r.code, label: `${r.code} — ${r.name}` })),
  },
  seller: {
    label: 'Vendedor',
    load: async () => (await getVendedores()).map((v) => ({ value: v, label: v })),
  },
  product: {
    label: 'Produto',
    load: async () => (await getProdutos()).map((p) => ({ value: p, label: p })),
  },
  branch: {
    label: 'Filial / Região',
    load: async () => (await getFiliais()).map((f) => ({ value: f.name, label: f.name })),
  },
  state: {
    label: 'Estado (UF)',
    load: async () => (await getEstadosDisponiveis()).map((uf) => ({ value: uf, label: uf })),
  },
  brand: {
    label: 'Marca',
    load: async () => (await getMarcas()).map((m) => ({ value: m, label: m })),
  },
};

export async function renderHistory(root) {
  root.innerHTML = `
    <div class="content">
      <div class="card">
        <div class="card__header">
          <div class="card__title-block">
            <h2>Histórico ECS</h2>
            <span data-result-count>Carregando...</span>
          </div>
        </div>

        <div class="form-grid" style="margin-bottom:6px;">
          <div class="field">
            <label>Busca livre (código, cliente, solicitante...)</label>
            <input type="text" placeholder="Ex: Nestlé, ECS-AK-26-1900, Carlos..." data-search-text />
          </div>
          <div></div>

          <div class="field">
            <label>Filtrar por</label>
            <select data-filter-field>
              <option value="">Nenhum</option>
              ${Object.entries(FILTER_FIELDS).map(([key, f]) => `<option value="${key}">${f.label}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Valor</label>
            <select data-filter-value disabled>
              <option value="">Selecione um filtro à esquerda</option>
            </select>
          </div>

          <div class="field">
            <label>De</label>
            <input type="date" data-date-from />
          </div>
          <div class="field">
            <label>Até</label>
            <input type="date" data-date-to />
          </div>
        </div>

        <label class="hint" style="display:flex; align-items:center; gap:6px; margin-bottom:16px;">
          <input type="checkbox" data-include-cancelled style="width:auto;" />
          Mostrar cancelados também
        </label>

        <div class="form-actions" style="justify-content:flex-start; padding-top:0; border-top:none; margin-top:0; margin-bottom:16px;">
          <button type="button" class="btn btn--primary" data-apply>Aplicar filtros</button>
          <button type="button" class="btn btn--secondary" data-clear>Limpar</button>
        </div>

        <div class="table-wrap" data-table-region>
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
        </div>

        <div class="form-actions" style="justify-content:space-between; align-items:center;">
          <span class="hint" data-page-label></span>
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn btn--secondary" data-prev disabled>‹ Anterior</button>
            <button type="button" class="btn btn--secondary" data-next disabled>Próxima ›</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const els = {
    resultCount: root.querySelector('[data-result-count]'),
    searchText: root.querySelector('[data-search-text]'),
    filterField: root.querySelector('[data-filter-field]'),
    filterValue: root.querySelector('[data-filter-value]'),
    dateFrom: root.querySelector('[data-date-from]'),
    dateTo: root.querySelector('[data-date-to]'),
    includeCancelled: root.querySelector('[data-include-cancelled]'),
    apply: root.querySelector('[data-apply]'),
    clear: root.querySelector('[data-clear]'),
    tableRegion: root.querySelector('[data-table-region]'),
    pageLabel: root.querySelector('[data-page-label]'),
    prev: root.querySelector('[data-prev]'),
    next: root.querySelector('[data-next]'),
  };

  let lastRecords = [];
  let pageState = { firstDoc: null, lastDoc: null, pageNumber: 1 };
  let totalCount = null;

  // Busca livre e filtro estrutural são mutuamente exclusivos — a UI deixa
  // isso visível desabilitando um lado quando o outro está em uso.
  els.searchText.addEventListener('input', () => {
    const hasText = els.searchText.value.trim().length > 0;
    els.filterField.disabled = hasText;
    els.filterValue.disabled = hasText || !els.filterField.value;
  });

  els.filterField.addEventListener('change', async () => {
    const fieldKey = els.filterField.value;
    els.searchText.disabled = Boolean(fieldKey);

    if (!fieldKey) {
      els.filterValue.innerHTML = `<option value="">Selecione um filtro à esquerda</option>`;
      els.filterValue.disabled = true;
      return;
    }

    els.filterValue.disabled = true;
    els.filterValue.innerHTML = `<option value="">Carregando...</option>`;
    const options = await FILTER_FIELDS[fieldKey].load();
    els.filterValue.innerHTML = options.map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
    els.filterValue.disabled = false;
  });

  els.clear.addEventListener('click', () => {
    els.searchText.value = '';
    els.filterField.value = '';
    els.filterValue.innerHTML = `<option value="">Selecione um filtro à esquerda</option>`;
    els.filterValue.disabled = true;
    els.searchText.disabled = false;
    els.filterField.disabled = false;
    els.dateFrom.value = '';
    els.dateTo.value = '';
    els.includeCancelled.checked = false;
    runSearch(true);
  });

  els.apply.addEventListener('click', () => runSearch(true));
  els.prev.addEventListener('click', () => runSearch(false, 'prev'));
  els.next.addEventListener('click', () => runSearch(false, 'next'));

  function buildFilters() {
    const searchTerms = els.searchText.value.trim() ? tokenizeQuery(els.searchText.value) : null;
    const structuralFilter = !searchTerms && els.filterField.value && els.filterValue.value
      ? { field: els.filterField.value, value: els.filterValue.value }
      : null;

    return {
      includeCancelled: els.includeCancelled.checked,
      structuralFilter,
      searchTerms,
      dateFrom: els.dateFrom.value ? new Date(`${els.dateFrom.value}T00:00:00`) : null,
      dateTo: els.dateTo.value ? new Date(`${els.dateTo.value}T23:59:59`) : null,
    };
  }

  async function runSearch(resetPage, direction = 'next') {
    const filters = buildFilters();

    if (resetPage) {
      pageState = { firstDoc: null, lastDoc: null, pageNumber: 1 };
      totalCount = null;
      els.resultCount.textContent = 'Buscando...';
    }

    els.tableRegion.innerHTML = `<div class="skeleton-row"></div><div class="skeleton-row"></div><div class="skeleton-row"></div>`;
    els.prev.disabled = true;
    els.next.disabled = true;

    try {
      const cursor = direction === 'next' ? pageState.lastDoc : pageState.firstDoc;
      const page = await fetchHistoricoPage(filters, {
        pageSize: PAGE_SIZE,
        cursor: resetPage ? null : cursor,
        direction,
      });

      lastRecords = page.records;
      renderEcsTable(
        els.tableRegion,
        lastRecords,
        (id) => goTo('details', { id, backTo: 'history' }),
        'Nenhum ECS encontrado com esses filtros.'
      );

      if (resetPage) {
        pageState.pageNumber = 1;
        countHistorico(filters)
          .then((count) => {
            totalCount = count;
            els.resultCount.textContent = `${count} resultado${count === 1 ? '' : 's'}`;
            updatePagination();
          })
          .catch(() => {
            els.resultCount.textContent = `${lastRecords.length}+ resultados`;
          });
      } else {
        pageState.pageNumber += direction === 'next' ? 1 : -1;
      }

      if (!page.isEmpty) {
        pageState.firstDoc = page.firstDoc;
        pageState.lastDoc = page.lastDoc;
      }

      updatePagination();
    } catch (err) {
      console.error(err);
      els.tableRegion.innerHTML = `<div class="table-empty">Não foi possível carregar os resultados. Se esta é a primeira vez usando esta combinação de filtros, pode faltar um índice do Firestore — veja o console do navegador para o link de criação automática.</div>`;
      els.resultCount.textContent = '—';
      showToast('Erro ao buscar o histórico. Veja o console para detalhes.', 'error');
    }
  }

  function updatePagination() {
    els.pageLabel.textContent = `Página ${pageState.pageNumber}`;
    els.prev.disabled = pageState.pageNumber <= 1;
    els.next.disabled = lastRecords.length < PAGE_SIZE
      || (totalCount != null && pageState.pageNumber * PAGE_SIZE >= totalCount);
  }

  runSearch(true);
}
