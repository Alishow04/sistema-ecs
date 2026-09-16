import { fetchEcsById } from '../firebase-service.js';
import { formatDateTimeBR } from '../utils/format.js';
import { openModal, escapeHtml, showToast } from '../ui.js';

/**
 * Abre o modal de detalhes de um ECS.
 * @param {string} id - docId ("{ano}-{sequencia}")
 * @param {object[]} [knownRecords] - lista já em memória, evita ida ao Firestore se o registro já estiver ali
 */
export async function openEcsDetailModal(id, knownRecords = []) {
  const record = knownRecords.find((r) => r.id === id) || (await fetchEcsById(id));
  if (!record) {
    showToast('Registro não encontrado.', 'error');
    return;
  }

  openModal(`
    <div class="modal__header">
      <h2>${record.ecsCode}${record.cancelled ? ' <span class="pill pill--cancelled">Cancelado</span>' : ''}</h2>
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
