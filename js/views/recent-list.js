import { fetchRecentEcs, fetchEcsById } from '../firebase-service.js';
import { formatDateBR, formatDateTimeBR } from '../utils/format.js';
import { openModal, escapeHtml, showToast } from '../ui.js';

let cachedRecords = [];

export async function renderRecentList(root) {
  root.innerHTML = `
    <div class="content">
      <div class="card">
        <div class="card__header">
          <div class="card__title-block">
            <h2>Últimos ECS</h2>
            <span>Os 20 registros mais recentes — filtro local só para validar a mecânica; busca completa no Firestore vem na próxima etapa.</span>
          </div>
        </div>
        <div class="field" style="margin-bottom:14px;">
          <input type="text" placeholder="Filtrar por código, cliente, vendedor..." data-local-filter />
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

  renderTable(tableRegion, cachedRecords);

  root.querySelector('[data-local-filter]').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    const filtered = term
      ? cachedRecords.filter((r) => (r.searchTokens || []).some((t) => t.includes(term)))
      : cachedRecords;
    renderTable(tableRegion, filtered);
  });
}

function renderTable(container, records) {
  if (records.length === 0) {
    container.innerHTML = `<div class="table-empty">Nenhum ECS encontrado. Crie o primeiro em "+ Novo ECS".</div>`;
    return;
  }

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>ECS</th><th>Data</th><th>Cliente</th><th>Vendedor</th>
          <th>Produto</th><th>Resp.</th><th>Filial</th><th>UF</th>
        </tr>
      </thead>
      <tbody>
        ${records.map((r) => `
          <tr data-id="${r.id}">
            <td class="mono">${r.ecsCode}${r.cancelled ? ' <span class="pill pill--cancelled">Cancelado</span>' : ''}</td>
            <td>${formatDateBR(r.ecsDate)}</td>
            <td>${escapeHtml(r.client)}</td>
            <td>${escapeHtml(r.seller)}</td>
            <td>${escapeHtml(r.product)}</td>
            <td>${r.creatorCode}</td>
            <td>${escapeHtml(r.branch)}</td>
            <td>${r.state || '—'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  container.querySelectorAll('tbody tr').forEach((row) => {
    row.addEventListener('click', () => openEcsDetailModal(row.dataset.id));
  });
}

export async function openEcsDetailModal(id) {
  const record = cachedRecords.find((r) => r.id === id) || (await fetchEcsById(id));
  if (!record) {
    showToast('Registro não encontrado.', 'error');
    return;
  }

  openModal(`
    <div class="modal__header">
      <h2>${record.ecsCode}</h2>
      <button type="button" class="modal__close" data-modal-close>&times;</button>
    </div>
    <div class="modal__body">
      <div class="form-grid">
        <div><div class="section-title">Cliente</div><p>${escapeHtml(record.client) || '—'}</p></div>
        <div><div class="section-title">Solicitante</div><p>${escapeHtml(record.requester) || '—'}</p></div>
        <div><div class="section-title">Vendedor</div><p>${escapeHtml(record.seller) || '—'}</p></div>
        <div><div class="section-title">Filial / UF</div><p>${escapeHtml(record.branch)} · ${record.state || '—'}</p></div>
        <div><div class="section-title">Produto</div><p>${escapeHtml(record.product) || '—'}</p></div>
        <div><div class="section-title">Marca</div><p>${escapeHtml(record.brand) || '—'}</p></div>
        <div><div class="section-title">Data</div><p>${record.ecsDate || '—'}</p></div>
        <div><div class="section-title">Responsável</div><p>${record.creatorName} (${record.creatorCode})</p></div>
        <div class="form-grid--full"><div class="section-title">Observações</div><p>${escapeHtml(record.notes) || '—'}</p></div>
        <div class="form-grid--full"><div class="section-title">Criado em</div><p>${formatDateTimeBR(record.createdAt)}</p></div>
      </div>
    </div>
  `);
}
