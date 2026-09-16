import { getCurrentUser } from '../identity.js';
import {
  getVendedores,
  getFiliais,
  getProdutos,
  getMarcas,
  getEstadoDaFilial,
} from '../settings-service.js';
import { createCombobox } from '../components/combobox.js';
import { createEcs } from '../ecs-service.js';
import { showToast, escapeHtml } from '../ui.js';
import { todayISO } from '../utils/format.js';

export async function renderNewEcs(root) {
  const user = getCurrentUser();

  root.innerHTML = `
    <div class="content content--narrow">
      <div class="card" data-form-card>
        <div class="card__header">
          <div class="card__title-block">
            <h2>Novo ECS</h2>
            <span>Criando como: ${user.code} · ${escapeHtml(user.name)}</span>
          </div>
        </div>

        <form data-form>
          <div class="form-grid">
            <div class="field">
              <label>Cliente <span class="required">*</span></label>
              <input type="text" name="client" required />
            </div>
            <div class="field">
              <label>Solicitante</label>
              <input type="text" name="requester" />
            </div>

            <div class="field">
              <label>Vendedor <span class="required">*</span></label>
              <div data-combo="seller"></div>
            </div>
            <div class="field">
              <label>Filial / Região <span class="required">*</span></label>
              <div data-combo="branch"></div>
              <div class="field--readonly-chip" data-state-chip hidden>
                <span class="chip">UF: <strong data-state-value></strong></span>
              </div>
            </div>

            <div class="field">
              <label>Produto / Demanda <span class="required">*</span></label>
              <div data-combo="product"></div>
            </div>
            <div class="field">
              <label>Marca</label>
              <div data-combo="brand"></div>
            </div>

            <div class="field">
              <label>Data <span class="required">*</span></label>
              <input type="date" name="ecsDate" required value="${todayISO()}" />
            </div>
            <div></div>

            <div class="field form-grid--full">
              <label>Observações</label>
              <textarea name="notes"></textarea>
            </div>
          </div>

          <div class="form-actions">
            <button type="button" class="btn btn--secondary" data-cancel>Limpar</button>
            <button type="submit" class="btn btn--primary" data-submit>Criar ECS</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const [vendedores, filiais, produtos, marcas] = await Promise.all([
    getVendedores(),
    getFiliais(),
    getProdutos(),
    getMarcas(),
  ]);

  const sellerCombo = createCombobox({
    container: root.querySelector('[data-combo="seller"]'),
    options: vendedores,
    placeholder: 'Buscar vendedor...',
  });

  const stateChip = root.querySelector('[data-state-chip]');
  const stateValueEl = root.querySelector('[data-state-value]');
  let currentState = '';

  const branchCombo = createCombobox({
    container: root.querySelector('[data-combo="branch"]'),
    options: filiais.map((f) => f.name),
    placeholder: 'Buscar filial/região...',
    onChange: async (value) => {
      currentState = await getEstadoDaFilial(value);
      if (currentState) {
        stateValueEl.textContent = currentState;
        stateChip.hidden = false;
      } else {
        stateChip.hidden = true;
      }
    },
  });

  const productCombo = createCombobox({
    container: root.querySelector('[data-combo="product"]'),
    options: produtos,
    placeholder: 'Buscar produto/demanda...',
  });

  const brandCombo = createCombobox({
    container: root.querySelector('[data-combo="brand"]'),
    options: marcas,
    placeholder: 'Buscar marca (opcional)...',
  });

  const form = root.querySelector('[data-form]');
  const submitBtn = root.querySelector('[data-submit]');

  root.querySelector('[data-cancel]').addEventListener('click', () => form.reset());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const input = {
      client: formData.get('client').trim(),
      requester: formData.get('requester').trim(),
      seller: sellerCombo.getValue(),
      branch: branchCombo.getValue(),
      state: currentState,
      product: productCombo.getValue(),
      brand: brandCombo.getValue(),
      ecsDate: formData.get('ecsDate'),
      notes: formData.get('notes').trim(),
    };

    if (!input.client || !input.seller || !input.branch || !input.product || !input.ecsDate) {
      showToast('Preencha os campos obrigatórios antes de criar o ECS.', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Criando...';

    try {
      const result = await createEcs(input, user);
      renderConfirmation(root, result, input, () => renderNewEcs(root));
    } catch (err) {
      console.error(err);
      showToast('Não foi possível criar o ECS. Tente novamente em instantes.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Criar ECS';
    }
  });
}

function renderConfirmation(root, result, input, onCreateAnother) {
  root.innerHTML = `
    <div class="content content--narrow">
      <div class="card confirm-card">
        <div class="confirm-card__icon">✓</div>
        <h2>ECS criado</h2>
        <div class="confirm-card__code">${result.ecsCode}</div>
        <div class="confirm-card__meta">${escapeHtml(input.client)} · ${escapeHtml(input.product)}</div>
        <div class="confirm-card__actions">
          <button type="button" class="btn btn--secondary" data-copy>Copiar ECS</button>
          <button type="button" class="btn btn--secondary" data-open>Abrir registro</button>
          <button type="button" class="btn btn--primary" data-again>Criar outro</button>
        </div>
      </div>
    </div>
  `;

  root.querySelector('[data-copy]').addEventListener('click', async () => {
    await navigator.clipboard.writeText(result.ecsCode);
    showToast('Código copiado.', 'success');
  });

  root.querySelector('[data-open]').addEventListener('click', async () => {
    const { openEcsDetailModal } = await import('../components/ecs-detail-modal.js');
    openEcsDetailModal(result.id);
  });

  root.querySelector('[data-again]').addEventListener('click', onCreateAnother);
}
