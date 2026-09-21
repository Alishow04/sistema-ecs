import { getCurrentUser } from '../identity.js';
import {
  getVendedores,
  getFiliais,
  getMarcas,
  getProdutosPorMarca,
  getEstadoDaFilial,
} from '../settings-service.js';
import { createCombobox } from '../components/combobox.js';
import { createEcs } from '../ecs-service.js';
import { fetchRecentEcs } from '../firebase-service.js';
import { renderEcsMiniList } from '../components/ecs-mini-list.js';
import { showToast, escapeHtml } from '../ui.js';
import { todayISO } from '../utils/format.js';
import { goTo } from '../router.js';

// Layout dividido: formulário à esquerda, painel "Últimos ECS" à direita.
// Marca vem antes de Produto/Demanda. O produto só é habilitado após a
// seleção da marca e recebe exclusivamente os itens configurados para ela.

export async function renderNewEcs(root) {
  const user = getCurrentUser();

  root.innerHTML = `
    <div class="content content--split">
      <div data-form-column></div>
      <div class="card" data-side-panel>
        <div class="card__header">
          <div class="card__title-block"><h2>Últimos ECS</h2></div>
        </div>
        <div data-mini-list>
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
        </div>
      </div>
    </div>
  `;

  const formColumn = root.querySelector('[data-form-column]');
  const miniListRegion = root.querySelector('[data-mini-list]');

  renderFormCard(formColumn, user, miniListRegion);
  refreshMiniList(miniListRegion);
}

async function refreshMiniList(container) {
  try {
    const records = await fetchRecentEcs(10);
    renderEcsMiniList(
      container,
      records,
      (id) => goTo('details', { id, backTo: 'new-ecs' }),
      'Nenhum ECS criado ainda.'
    );
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="table-empty">Não foi possível carregar os últimos ECS.</div>`;
  }
}

async function renderFormCard(formColumn, user, miniListRegion) {
  formColumn.innerHTML = `
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
            <label>Marca <span class="required">*</span></label>
            <div data-combo="brand"></div>
          </div>
          <div class="field">
            <label>Produto / Demanda <span class="required">*</span></label>
            <div data-combo="product"></div>
            <p class="hint" data-product-hint style="margin-top:6px;">Selecione a marca para carregar os produtos disponíveis.</p>
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
  `;

  const [vendedores, filiais, marcas] = await Promise.all([
    getVendedores(),
    getFiliais(),
    getMarcas(),
  ]);

  const sellerCombo = createCombobox({
    container: formColumn.querySelector('[data-combo="seller"]'),
    options: vendedores,
    placeholder: 'Buscar vendedor...',
  });

  const stateChip = formColumn.querySelector('[data-state-chip]');
  const stateValueEl = formColumn.querySelector('[data-state-value]');
  let currentState = '';

  const branchCombo = createCombobox({
    container: formColumn.querySelector('[data-combo="branch"]'),
    options: filiais.map((f) => f.name),
    placeholder: 'Buscar filial/região...',
    onChange: async (value) => {
      currentState = await getEstadoDaFilial(value);
      if (currentState) {
        stateValueEl.textContent = currentState;
        stateChip.hidden = false;
      } else {
        stateValueEl.textContent = '';
        stateChip.hidden = true;
      }
    },
  });

  const productHint = formColumn.querySelector('[data-product-hint]');
  const productCombo = createCombobox({
    container: formColumn.querySelector('[data-combo="product"]'),
    options: [],
    placeholder: 'Selecione uma marca primeiro...',
    disabled: true,
  });

  const brandCombo = createCombobox({
    container: formColumn.querySelector('[data-combo="brand"]'),
    options: marcas,
    placeholder: 'Buscar marca...',
    onChange: async (brand) => {
      // Toda troca/limpeza de Marca invalida imediatamente o Produto anterior.
      // Assim nunca fica uma combinação Marca × Produto incoerente na tela.
      productCombo.setOptions([]);
      productCombo.clear();

      if (!brand) {
        productCombo.setDisabled(true);
        productCombo.setPlaceholder('Selecione uma marca primeiro...');
        productHint.textContent = 'Selecione a marca para carregar os produtos disponíveis.';
        return;
      }

      const products = await getProdutosPorMarca(brand);
      productCombo.setOptions(products);
      productCombo.setDisabled(products.length === 0);
      productCombo.setPlaceholder(products.length ? 'Selecione ou pesquise um produto...' : 'Nenhum produto cadastrado para esta marca');
      productHint.textContent = products.length
        ? `${products.length} produto${products.length === 1 ? '' : 's'} disponível${products.length === 1 ? '' : 'is'} para ${brand}.`
        : `Nenhum produto está cadastrado para ${brand}. Configure em Configurações → Produtos por Marca.`;
    },
  });

  const form = formColumn.querySelector('[data-form]');
  const submitBtn = formColumn.querySelector('[data-submit]');

  formColumn.querySelector('[data-cancel]').addEventListener('click', () => {
    form.reset();
    sellerCombo.clear();
    branchCombo.clear();
    brandCombo.clear();
    productCombo.setOptions([]);
    productCombo.clear();
    productCombo.setDisabled(true);
    productCombo.setPlaceholder('Selecione uma marca primeiro...');
    productHint.textContent = 'Selecione a marca para carregar os produtos disponíveis.';
    currentState = '';
    stateValueEl.textContent = '';
    stateChip.hidden = true;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const input = {
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

    if (!input.client || !input.seller || !input.branch || !input.brand || !input.product || !input.ecsDate) {
      showToast('Preencha os campos obrigatórios antes de criar o ECS.', 'error');
      return;
    }

    const validProducts = await getProdutosPorMarca(input.brand);
    if (!validProducts.includes(input.product)) {
      showToast('O produto selecionado não pertence à marca informada.', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Criando...';

    try {
      const result = await createEcs(input, user);
      renderConfirmation(formColumn, result, input, () => renderFormCard(formColumn, user, miniListRegion));
      refreshMiniList(miniListRegion);
    } catch (err) {
      console.error(err);
      showToast('Não foi possível criar o ECS. Tente novamente em instantes.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Criar ECS';
    }
  });
}

function renderConfirmation(formColumn, result, input, onCreateAnother) {
  formColumn.innerHTML = `
    <div class="card confirm-card">
      <div class="confirm-card__icon">✓</div>
      <h2>ECS criado</h2>
      <div class="confirm-card__code">${result.ecsCode}</div>
      <div class="confirm-card__meta">${escapeHtml(input.client)} · ${escapeHtml(input.brand)} · ${escapeHtml(input.product)}</div>
      <div class="confirm-card__actions">
        <button type="button" class="btn btn--secondary" data-copy>Copiar ECS</button>
        <button type="button" class="btn btn--secondary" data-open>Abrir registro</button>
        <button type="button" class="btn btn--primary" data-again>Criar outro</button>
      </div>
    </div>
  `;

  formColumn.querySelector('[data-copy]').addEventListener('click', async () => {
    await navigator.clipboard.writeText(result.ecsCode);
    showToast('Código copiado.', 'success');
  });

  formColumn.querySelector('[data-open]').addEventListener('click', () => {
    goTo('details', { id: result.id, backTo: 'new-ecs' });
  });

  formColumn.querySelector('[data-again]').addEventListener('click', onCreateAnother);
}
