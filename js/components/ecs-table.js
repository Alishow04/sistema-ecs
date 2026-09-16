import { formatDateBR } from '../utils/format.js';
import { escapeHtml } from '../ui.js';

const COLUMNS = [
  { label: 'ECS' }, { label: 'Data' }, { label: 'Cliente' }, { label: 'Vendedor' },
  { label: 'Produto' }, { label: 'Resp.' }, { label: 'Filial' }, { label: 'UF' },
];

/**
 * Renderiza a tabela padrão de ECS usada em "Últimos ECS" e "Histórico".
 * @param {HTMLElement} container
 * @param {object[]} records
 * @param {(id:string)=>void} onRowClick
 * @param {string} [emptyMessage]
 */
export function renderEcsTable(container, records, onRowClick, emptyMessage = 'Nenhum ECS encontrado.') {
  if (records.length === 0) {
    container.innerHTML = `<div class="table-empty">${emptyMessage}</div>`;
    return;
  }

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>${COLUMNS.map((c) => `<th>${c.label}</th>`).join('')}</tr>
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
    row.addEventListener('click', () => onRowClick(row.dataset.id));
  });
}
