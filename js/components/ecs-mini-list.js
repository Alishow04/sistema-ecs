import { escapeHtml } from '../ui.js';

/**
 * Lista compacta de ECS para painéis estreitos (ex.: ao lado do formulário
 * Novo ECS) — uma linha por registro, sem colunas, pensada para caber em
 * ~300-360px de largura.
 * @param {HTMLElement} container
 * @param {object[]} records
 * @param {(id:string)=>void} onClick
 * @param {string} [emptyMessage]
 */
export function renderEcsMiniList(container, records, onClick, emptyMessage = 'Nenhum ECS encontrado.') {
  if (records.length === 0) {
    container.innerHTML = `<div class="table-empty">${emptyMessage}</div>`;
    return;
  }

  container.innerHTML = records
    .map((r) => `
      <button type="button" class="mini-ecs-row" data-id="${r.id}">
        <div class="mini-ecs-row__top">
          <span class="mono">${r.ecsCode}</span>
          ${r.cancelled ? '<span class="pill pill--cancelled">Cancelado</span>' : ''}
        </div>
        <div class="mini-ecs-row__sub">${escapeHtml(r.client) || '—'} · ${escapeHtml(r.product) || '—'}</div>
      </button>
    `)
    .join('');

  container.querySelectorAll('.mini-ecs-row').forEach((row) => {
    row.addEventListener('click', () => onClick(row.dataset.id));
  });
}
