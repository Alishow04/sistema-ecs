// Detalhes do ECS — visualização, edição e histórico de alterações.
// Chegando aqui sempre via router.goTo('details', { id, backTo }) — nunca
// direto pela sidebar, por isso não tem item próprio em components/sidebar.js.

import { fetchEcsById } from '../firebase-service.js';
import { updateEcs, setEcsCancelled, fetchEcsHistory } from '../ecs-service.js';
import { getCurrentUser } from '../identity.js';
import {
  getVendedores,
  getFiliais,
  getMarcas,
  getProdutosPorMarca,
  getEstadoDaFilial,
} from '../settings-service.js';
import { createCombobox } from '../components/combobox.js';
import { showToast, escapeHtml, confirmDialog } from '../ui.js';
import { formatDateBR, formatDateTimeBR } from '../utils/format.js';
import { goTo } from '../router.js';

const FIELD_LABELS = {
  client: 'Cliente',
  requester: 'Solicitante',
  seller: 'Vendedor',
  branch: 'Filial / Região',
  state: 'Estado (UF)',
  product: 'Produto / Demanda',
  brand: 'Marca',
  ecsDate: 'Data',
  notes: 'Observações',
  cancelled: 'Status',
};

function formatHistoryValue(field, value) {
  if (field === 'cancelled') return value ? 'Cancelado' : 'Ativo';
  if (field === 'ecsDate') return formatDateBR(value);
  return value || '—';
}

export async function renderDetails(root, { id, backTo = 'history' } = {}) {
  if (!id) {
    root.innerHTML = `<div class="content"><div class="table-empty">ECS não informado.</div></div>`;
    return;
  }

  root.innerHTML = `<div class="content"><div class="skeleton-row"></div><div class="skeleton-row"></div></div>`;

  const record = await fetchEcsById(id);
  if (!record) {
    root.innerHTML = `<div class="content"><div class="table-empty">ECS não encontrado.</div></div>`;
    return;
  }

  renderReadMode(root, record, backTo);
}

function renderReadMode(root, record, backTo) {
  root.innerHTML = `
    <div class="content content--narrow">
      <div class="card">
        <div class="card__header">
          <div class="card__title-block">
            <h2>${record.ecsCode}${record.cancelled ? ' <span class="pill pill--cancelled">Cancelado</span>' : ''}</h2>
            <span>Criado em ${formatDateTimeBR(record.createdAt)} por ${record.creatorName} (${record.creatorCode})</span>
          </div>
        </div>

        <div class="form-grid" data-view-fields>
          ${renderReadField('Cliente', escapeHtml(record.client))}
          ${renderReadField('Solicitante', escapeHtml(record.requester))}
          ${renderReadField('Vendedor', escapeHtml(record.seller))}
          ${renderReadField('Filial / UF', `${escapeHtml(record.branch)}${record.state ? ` · ${record.state}` : ''}`)}
          ${renderReadField('Marca', escapeHtml(record.brand))}
          ${renderReadField('Produto', escapeHtml(record.product))}
          ${renderReadField('Data', formatDateBR(record.ecsDate))}
          ${renderReadField('Responsável', `${escapeHtml(record.creatorName)} (${record.creatorCode})`)}
          <div class="form-grid--full">${renderReadField('Observações', escapeHtml(record.notes))}</div>
        </div>

        <div class="form-actions" style="justify-content:space-between;">
          <button type="button" class="btn btn--secondary" data-back>‹ Voltar</button>
          <div style="display:flex; gap:10px;">
            <button type="button" class="btn btn--secondary" data-copy>Copiar ECS</button>
            <button type="button" class="btn btn--secondary" data-toggle-cancel>
              ${record.cancelled ? 'Reativar ECS' : 'Cancelar ECS'}
            </button>
            <button type="button" class="btn btn--primary" data-edit>Editar</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card__header">
          <div class="card__title-block"><h2>Histórico de alterações</h2></div>
        </div>
        <div data-history-region><div class="skeleton-row"></div></div>
      </div>
    </div>
  `;

  root.querySelector('[data-back]').addEventListener('click', () => goTo(backTo));
  root.querySelector('[data-copy]').addEventListener('click', async () => {
    await navigator.clipboard.writeText(record.ecsCode);
    showToast('Código copiado.', 'success');
  });
  root.querySelector('[data-edit]').addEventListener('click', () => renderEditMode(root, record, backTo));
  root.querySelector('[data-toggle-cancel]').addEventListener('click', () => handleToggleCancel(root, record, backTo));

  loadHistory(root, record.id);
}

function renderReadField(label, value) {
  return `<div><div class="section-title">${label}</div><p>${value || '—'}</p></div>`;
}

async function handleToggleCancel(root, record, backTo) {
  const willCancel = !record.cancelled;
  const confirmed = await confirmDialog(
    willCancel
      ? `Cancelar ${record.ecsCode}? O código continua existindo (não é excluído nem reaproveitado), só passa a aparecer como cancelado.`
      : `Reativar ${record.ecsCode}?`,
    { confirmLabel: willCancel ? 'Cancelar ECS' : 'Reativar ECS', cancelLabel: 'Voltar' }
  );
  if (!confirmed) return;

  try {
    await setEcsCancelled(record.id, willCancel, getCurrentUser());
    showToast(willCancel ? 'ECS cancelado.' : 'ECS reativado.', 'success');
    const updated = await fetchEcsById(record.id);
    renderReadMode(root, updated, backTo);
  } catch (err) {
    console.error(err);
    showToast('Não foi possível atualizar o status do ECS.', 'error');
  }
}

async function loadHistory(root, id) {
  const region = root.querySelector('[data-history-region]');
  try {
    const entries = await fetchEcsHistory(id);
    if (entries.length === 0) {
      region.innerHTML = `<p class="hint">Nenhuma alteração registrada além da criação.</p>`;
      return;
    }
    region.innerHTML = entries
      .map((e) => `
        <p style="margin-bottom:8px; font-size:13px;">
          <strong>${formatDateTimeBR(e.changedAt)}</strong> —
          ${FIELD_LABELS[e.field] || e.field} alterado de
          "${escapeHtml(formatHistoryValue(e.field, e.oldValue))}" para
          "${escapeHtml(formatHistoryValue(e.field, e.newValue))}" por ${e.changedBy}
        </p>
      `)
      .join('');
  } catch (err) {
    console.error(err);
    region.innerHTML = `<p class="hint">Não foi possível carregar o histórico.</p>`;
  }
}

async function renderEditMode(root, record, backTo) {
  root.innerHTML = `
    <div class="content content--narrow">
      <div class="card">
        <div class="card__header">
          <div class="card__title-block">
            <h2>Editando ${record.ecsCode}</h2>
            <span>Código, número, ano e responsável original não podem ser alterados.</span>
          </div>
        </div>

        <form data-form>
          <div class="form-grid">
            <div class="field">
              <label>Cliente <span class="required">*</span></label>
              <input type="text" name="client" required value="${escapeHtml(record.client)}" />
            </div>
            <div class="field">
              <label>Solicitante</label>
              <input type="text" name="requester" value="${escapeHtml(record.requester || '')}" />
            </div>

            <div class="field">
              <label>Vendedor <span class="required">*</span></label>
              <div data-combo="seller"></div>
            </div>
            <div class="field">
              <label>Filial / Região <span class="required">*</span></label>
              <div data-combo="branch"></div>
              <div class="field--readonly-chip" data-state-chip ${record.state ? '' : 'hidden'}>
                <span class="chip">UF: <strong data-state-value>${record.state || ''}</strong></span>
              </div>
            </div>

            <div class="field">
              <label>Marca <span class="required">*</span></label>
              <div data-combo="brand"></div>
            </div>
            <div class="field">
              <label>Produto / Demanda <span class="required">*</span></label>
              <div data-combo="product"></div>
              <p class="hint" data-product-hint style="margin-top:6px;"></p>
            </div>

            <div class="field">
              <label>Data <span class="required">*</span></label>
              <input type="date" name="ecsDate" required value="${record.ecsDate || ''}" />
            </div>
            <div></div>

            <div class="field form-grid--full">
              <label>Observações</label>
              <textarea name="notes">${escapeHtml(record.notes || '')}</textarea>
            </div>
          </div>

          <div class="form-actions">
            <button type="button" class="btn btn--secondary" data-cancel-edit>Cancelar edição</button>
            <button type="submit" class="btn btn--primary" data-submit>Salvar alterações</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const [vendedores, filiais, marcas] = await Promise.all([
    getVendedores(), getFiliais(), getMarcas(),
  ]);

  const sellerCombo = createCombobox({
    container: root.querySelector('[data-combo="seller"]'),
    options: vendedores,
    initialValue: record.seller || '',
  });

  const stateChip = root.querySelector('[data-state-chip]');
  const stateValueEl = root.querySelector('[data-state-value]');
  let currentState = record.state || '';

  const branchCombo = createCombobox({
    container: root.querySelector('[data-combo="branch"]'),
    options: filiais.map((f) => f.name),
    initialValue: record.branch || '',
    onChange: async (value) => {
      currentState = await getEstadoDaFilial(value);
      stateValueEl.textContent = currentState;
      stateChip.hidden = !currentState;
    },
  });

  const productHint = root.querySelector('[data-product-hint]');
  let initialProducts = await getProdutosPorMarca(record.brand || '');
  // Compatibilidade com ECS antigos: se o produto gravado não estiver mais
  // cadastrado para a marca, ele continua aparecendo durante a edição até
  // o usuário escolher outra marca/produto.
  if (record.product && !initialProducts.includes(record.product)) {
    initialProducts = [record.product, ...initialProducts];
  }

  const productCombo = createCombobox({
    container: root.querySelector('[data-combo="product"]'),
    options: initialProducts,
    initialValue: record.product || '',
    placeholder: record.brand ? 'Buscar produto/demanda...' : 'Selecione uma marca primeiro...',
    disabled: !record.brand,
  });

  const brandCombo = createCombobox({
    container: root.querySelector('[data-combo="brand"]'),
    options: marcas,
    initialValue: record.brand || '',
    placeholder: 'Buscar marca...',
    onChange: async (brand) => {
      const products = await getProdutosPorMarca(brand);
      productCombo.setOptions(products);
      productCombo.setDisabled(false);
      productCombo.setPlaceholder(products.length ? 'Buscar produto/demanda...' : 'Nenhum produto cadastrado para esta marca');
      productHint.textContent = products.length
        ? `${products.length} produto${products.length === 1 ? '' : 's'} disponível${products.length === 1 ? '' : 'is'} para ${brand}.`
        : `Nenhum produto está cadastrado para ${brand}.`;
    },
  });

  productHint.textContent = record.brand
    ? `${initialProducts.length} produto${initialProducts.length === 1 ? '' : 's'} disponível${initialProducts.length === 1 ? '' : 'is'} para ${record.brand}.`
    : 'Selecione uma marca para carregar os produtos disponíveis.';

  root.querySelector('[data-cancel-edit]').addEventListener('click', () => renderReadMode(root, record, backTo));

  const form = root.querySelector('[data-form]');
  const submitBtn = root.querySelector('[data-submit]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    const changes = {
      client: formData.get('client').trim(),
      requester: formData.get('requester').trim(),
      seller: sellerCombo.getValue(),
      branch: branchCombo.getValue(),
      state: currentState,
      brand: brandCombo.getValue(),
      product: productCombo.getValue(),
      ecsDate: formData.get('ecsDate'),
      notes: formData.get('notes').trim(),
    };

    if (!changes.client || !changes.seller || !changes.branch || !changes.brand || !changes.product || !changes.ecsDate) {
      showToast('Preencha os campos obrigatórios antes de salvar.', 'error');
      return;
    }

    const validProducts = await getProdutosPorMarca(changes.brand);
    const isLegacyUnchanged = changes.brand === record.brand && changes.product === record.product;
    if (!isLegacyUnchanged && !validProducts.includes(changes.product)) {
      showToast('O produto selecionado não pertence à marca informada.', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Salvando...';

    try {
      await updateEcs(record.id, changes, getCurrentUser());
      showToast('ECS atualizado.', 'success');
      const updated = await fetchEcsById(record.id);
      renderReadMode(root, updated, backTo);
    } catch (err) {
      console.error(err);
      showToast('Não foi possível salvar as alterações.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Salvar alterações';
    }
  });
}
