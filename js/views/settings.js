// Configurações — edita as listas de apoio (settings/*) direto pela
// interface, sem precisar abrir o console do Firebase.
//
// Responsáveis é tratado diferente dos outros: nunca tem remoção, só
// ativar/desativar. Um código de responsável é permanente (ver regras que
// não podem ser quebradas no README) — removê-lo da lista não apagaria o
// histórico, mas seria fácil alguém reaproveitar o código sem querer depois.
// Os demais são listas de apoio. Produtos agora são objetos vinculados à marca
// ({ name, brand }); os ECS continuam guardando brand/product copiados, então
// mudanças nas Configurações não alteram registros históricos.

import { getVendedores, getProdutosConfig, getMarcas, getFiliais, getResponsaveis, saveList } from '../settings-service.js';
import { showToast, escapeHtml } from '../ui.js';

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

export async function renderSettings(root) {
  root.innerHTML = `
    <div class="content">
      <div class="card__title-block" style="border:none; padding-left:0; margin-bottom:16px;">
        <h1>Configurações</h1>
      </div>

      <div class="card">
        <div class="card__header">
          <div class="card__title-block"><h2>Responsáveis</h2></div>
        </div>
        <div data-section="responsaveis"><div class="skeleton-row"></div></div>
      </div>

      <div class="card">
        <div class="card__header">
          <div class="card__title-block"><h2>Filiais / Região</h2></div>
        </div>
        <div data-section="filiais"><div class="skeleton-row"></div></div>
      </div>

      <div class="card">
        <div class="card__header">
          <div class="card__title-block"><h2>Vendedores</h2></div>
        </div>
        <div data-section="vendedores"><div class="skeleton-row"></div></div>
      </div>

      <div class="card">
        <div class="card__header">
          <div class="card__title-block"><h2>Marcas</h2></div>
        </div>
        <div data-section="marcas"><div class="skeleton-row"></div></div>
      </div>

      <div class="card">
        <div class="card__header">
          <div class="card__title-block">
            <h2>Produtos por Marca</h2>
            <span>Defina quais produtos/demandas aparecem após a seleção de cada marca no Novo ECS.</span>
          </div>
        </div>
        <div data-section="produtos"><div class="skeleton-row"></div></div>
      </div>
    </div>
  `;

  await Promise.all([
    renderResponsaveisSection(root.querySelector('[data-section="responsaveis"]')),
    renderFiliaisSection(root.querySelector('[data-section="filiais"]')),
    renderSimpleListSection(root.querySelector('[data-section="vendedores"]'), 'vendedores', 'vendedor', getVendedores),
    renderSimpleListSection(root.querySelector('[data-section="marcas"]'), 'marcas', 'marca', getMarcas),
    renderProdutosSection(root.querySelector('[data-section="produtos"]')),
  ]);
}

// ---------- Vendedores / Produtos / Marcas (lista simples de texto) ----------

async function renderSimpleListSection(container, key, singular, getter) {
  let items;
  try {
    items = [...(await getter())];
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="table-empty">Não foi possível carregar.</div>`;
    return;
  }

  paint();

  function paint() {
    container.innerHTML = `
      <div class="settings-chip-list">
        ${items.length === 0
          ? `<p class="hint">Nenhum ${singular} cadastrado ainda.</p>`
          : items.map((item, i) => `
              <span class="settings-chip">
                ${escapeHtml(item)}
                <button type="button" data-remove="${i}" aria-label="Remover ${escapeHtml(item)}">&times;</button>
              </span>
            `).join('')}
      </div>
      <div class="settings-add-row">
        <input type="text" placeholder="Novo ${singular}..." data-new-value />
        <button type="button" class="btn btn--secondary" data-add>Adicionar</button>
      </div>
    `;

    container.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => removeAt(Number(btn.dataset.remove)));
    });
    container.querySelector('[data-add]').addEventListener('click', addItem);
    container.querySelector('[data-new-value]').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addItem(); }
    });
  }

  async function addItem() {
    const input = container.querySelector('[data-new-value]');
    const value = input.value.trim();
    if (!value) return;
    if (items.some((i) => i.toLowerCase() === value.toLowerCase())) {
      showToast(`"${value}" já está na lista.`, 'error');
      return;
    }
    items.push(value);
    if (await persist()) paint();
  }

  async function removeAt(index) {
    items.splice(index, 1);
    if (await persist()) paint();
  }

  async function persist() {
    try {
      await saveList(key, items);
      return true;
    } catch (err) {
      console.error(err);
      showToast('Não foi possível salvar. Tente novamente.', 'error');
      return false;
    }
  }
}

// ---------- Produtos por Marca ----------

async function renderProdutosSection(container) {
  let items;
  let brands;
  try {
    [items, brands] = await Promise.all([
      getProdutosConfig(),
      getMarcas(),
    ]);
    items = items.map((p) => ({ ...p }));
    brands = [...brands];
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="table-empty">Não foi possível carregar.</div>`;
    return;
  }

  let selectedBrand = brands[0] || '';
  paint();

  function paint() {
    const brandItems = selectedBrand
      ? items.filter((p) => p.brand === selectedBrand)
      : [];
    const unresolved = items
      .map((p, index) => ({ ...p, index }))
      .filter((p) => !p.brand || !brands.includes(p.brand));

    container.innerHTML = `
      ${brands.length === 0 ? `
        <div class="table-empty">
          Cadastre pelo menos uma marca acima antes de vincular produtos.
        </div>
      ` : `
        <div class="settings-product-toolbar">
          <div class="field" style="max-width:360px;">
            <label>Marca</label>
            <select data-product-brand>
              ${brands.map((brand) => `<option value="${escapeHtml(brand)}" ${brand === selectedBrand ? 'selected' : ''}>${escapeHtml(brand)}</option>`).join('')}
            </select>
          </div>
          <p class="hint">Os produtos abaixo serão as únicas opções exibidas quando <strong>${escapeHtml(selectedBrand)}</strong> for selecionada no cadastro de um ECS.</p>
        </div>

        <div class="settings-chip-list" style="margin-top:12px;">
          ${brandItems.length === 0
            ? `<p class="hint">Nenhum produto cadastrado para esta marca.</p>`
            : brandItems.map((item) => {
                const realIndex = items.indexOf(item);
                return `
                  <span class="settings-chip">
                    ${escapeHtml(item.name)}
                    <button type="button" data-remove-product="${realIndex}" aria-label="Remover ${escapeHtml(item.name)}">&times;</button>
                  </span>
                `;
              }).join('')}
        </div>

        <div class="settings-add-row">
          <input type="text" placeholder="Novo produto/demanda para ${escapeHtml(selectedBrand)}..." data-new-product />
          <button type="button" class="btn btn--secondary" data-add-product>Adicionar</button>
        </div>
      `}

      ${unresolved.length ? `
        <div class="settings-legacy-block">
          <div class="section-title">Produtos sem vínculo válido</div>
          <p class="hint">Itens da estrutura antiga ou ligados a uma marca removida. Associe cada um a uma marca para que volte a aparecer no Novo ECS.</p>
          <div class="settings-legacy-list">
            ${unresolved.map((item) => `
              <div class="settings-legacy-row" data-legacy-row="${item.index}">
                <div>
                  <strong>${escapeHtml(item.name)}</strong>
                  ${item.brand ? `<span class="hint"> · marca anterior: ${escapeHtml(item.brand)}</span>` : ''}
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                  <select data-legacy-brand>
                    <option value="">Escolher marca...</option>
                    ${brands.map((brand) => `<option value="${escapeHtml(brand)}">${escapeHtml(brand)}</option>`).join('')}
                  </select>
                  <button type="button" class="btn btn--secondary" data-assign-product>Associar</button>
                  <button type="button" class="btn btn--ghost" data-remove-legacy>Remover</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;

    const brandSelect = container.querySelector('[data-product-brand]');
    if (brandSelect) {
      brandSelect.addEventListener('change', () => {
        selectedBrand = brandSelect.value;
        paint();
      });
    }

    container.querySelectorAll('[data-remove-product]').forEach((btn) => {
      btn.addEventListener('click', () => removeAt(Number(btn.dataset.removeProduct)));
    });

    const addBtn = container.querySelector('[data-add-product]');
    if (addBtn) addBtn.addEventListener('click', addItem);
    const input = container.querySelector('[data-new-product]');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addItem(); }
      });
    }

    container.querySelectorAll('[data-legacy-row]').forEach((row) => {
      const index = Number(row.dataset.legacyRow);
      row.querySelector('[data-assign-product]').addEventListener('click', () => assignLegacy(index, row));
      row.querySelector('[data-remove-legacy]').addEventListener('click', () => removeAt(index));
    });
  }

  async function addItem() {
    if (!selectedBrand) {
      showToast('Selecione uma marca primeiro.', 'error');
      return;
    }
    const input = container.querySelector('[data-new-product]');
    const name = input.value.trim();
    if (!name) return;

    if (items.some((p) => p.brand === selectedBrand && p.name.toLowerCase() === name.toLowerCase())) {
      showToast(`"${name}" já está cadastrado para ${selectedBrand}.`, 'error');
      return;
    }

    items.push({ name, brand: selectedBrand });
    if (await persist()) paint();
  }

  async function assignLegacy(index, row) {
    const brand = row.querySelector('[data-legacy-brand]').value;
    if (!brand) {
      showToast('Escolha uma marca para associar o produto.', 'error');
      return;
    }
    const item = items[index];
    if (!item) return;

    if (items.some((p, i) => i !== index && p.brand === brand && p.name.toLowerCase() === item.name.toLowerCase())) {
      showToast(`"${item.name}" já está cadastrado para ${brand}.`, 'error');
      return;
    }

    item.brand = brand;
    selectedBrand = brand;
    if (await persist()) paint();
  }

  async function removeAt(index) {
    items.splice(index, 1);
    if (await persist()) paint();
  }

  async function persist() {
    try {
      await saveList('produtos', items);
      return true;
    } catch (err) {
      console.error(err);
      showToast('Não foi possível salvar. Tente novamente.', 'error');
      return false;
    }
  }
}

// ---------- Filiais (nome + UF) ----------

async function renderFiliaisSection(container) {
  let items;
  try {
    items = (await getFiliais()).map((f) => ({ ...f }));
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="table-empty">Não foi possível carregar.</div>`;
    return;
  }

  paint();

  function paint() {
    container.innerHTML = `
      <div class="settings-chip-list">
        ${items.length === 0
          ? `<p class="hint">Nenhuma filial cadastrada ainda.</p>`
          : items.map((f, i) => `
              <span class="settings-chip">
                ${escapeHtml(f.name)} · ${f.state}
                <button type="button" data-remove="${i}" aria-label="Remover ${escapeHtml(f.name)}">&times;</button>
              </span>
            `).join('')}
      </div>
      <div class="settings-add-row">
        <input type="text" placeholder="Nome da filial/região..." data-new-name style="flex:2;" />
        <select data-new-state>
          <option value="">UF</option>
          ${UFS.map((uf) => `<option value="${uf}">${uf}</option>`).join('')}
        </select>
        <button type="button" class="btn btn--secondary" data-add>Adicionar</button>
      </div>
      <p class="hint" style="margin-top:8px;">O UF é preenchido sozinho no formulário Novo ECS a partir da filial escolhida aqui.</p>
    `;

    container.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => removeAt(Number(btn.dataset.remove)));
    });
    container.querySelector('[data-add]').addEventListener('click', addItem);
  }

  async function addItem() {
    const nameInput = container.querySelector('[data-new-name]');
    const stateInput = container.querySelector('[data-new-state]');
    const name = nameInput.value.trim();
    const state = stateInput.value;

    if (!name || !state) {
      showToast('Informe o nome da filial e o UF.', 'error');
      return;
    }
    if (items.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      showToast(`"${name}" já está cadastrada.`, 'error');
      return;
    }

    items.push({ name, state });
    if (await persist()) paint();
  }

  async function removeAt(index) {
    items.splice(index, 1);
    if (await persist()) paint();
  }

  async function persist() {
    try {
      await saveList('filiais', items);
      return true;
    } catch (err) {
      console.error(err);
      showToast('Não foi possível salvar. Tente novamente.', 'error');
      return false;
    }
  }
}

// ---------- Responsáveis (código + nome + ativo, sem remoção) ----------

async function renderResponsaveisSection(container) {
  let items;
  try {
    items = (await getResponsaveis()).map((r) => ({ ...r }));
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="table-empty">Não foi possível carregar.</div>`;
    return;
  }

  paint();

  function paint() {
    container.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr><th>Código</th><th>Nome</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            ${items.map((r, i) => `
              <tr>
                <td class="mono">${r.code}</td>
                <td>${escapeHtml(r.name)}</td>
                <td>${r.active === false
                  ? '<span class="pill pill--cancelled">Inativo</span>'
                  : '<span class="pill" style="background:var(--success-bg); color:var(--success);">Ativo</span>'}
                </td>
                <td><button type="button" class="btn btn--ghost" data-toggle="${i}">${r.active === false ? 'Reativar' : 'Desativar'}</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <p class="hint" style="margin:12px 0;">
        Códigos nunca são removidos nem reaproveitados — só desativados. Um
        responsável inativo some da tela de seleção de usuário, mas o
        histórico dos ECS que ele já criou continua intacto.
      </p>
      <div class="settings-add-row">
        <input type="text" placeholder="Código (2 letras)" maxlength="2" style="flex:0 0 120px; text-transform:uppercase;" data-new-code />
        <input type="text" placeholder="Nome completo" style="flex:2;" data-new-name />
        <button type="button" class="btn btn--secondary" data-add>Adicionar</button>
      </div>
    `;

    container.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => toggleActive(Number(btn.dataset.toggle)));
    });
    container.querySelector('[data-add]').addEventListener('click', addItem);
  }

  async function addItem() {
    const codeInput = container.querySelector('[data-new-code]');
    const nameInput = container.querySelector('[data-new-name]');
    const code = codeInput.value.trim().toUpperCase();
    const name = nameInput.value.trim();

    if (!/^[A-Z]{2}$/.test(code)) {
      showToast('O código precisa ter exatamente 2 letras.', 'error');
      return;
    }
    if (!name) {
      showToast('Informe o nome completo.', 'error');
      return;
    }
    if (items.some((r) => r.code === code)) {
      showToast(`O código "${code}" já existe e não pode ser reaproveitado.`, 'error');
      return;
    }

    items.push({ code, name, active: true });
    if (await persist()) paint();
  }

  async function toggleActive(index) {
    items[index].active = items[index].active === false ? true : false;
    if (await persist()) paint();
  }

  async function persist() {
    try {
      await saveList('responsaveis', items);
      return true;
    } catch (err) {
      console.error(err);
      showToast('Não foi possível salvar. Tente novamente.', 'error');
      return false;
    }
  }
}
