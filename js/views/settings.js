// Configurações — edita as listas de apoio (settings/*) direto pela
// interface, sem precisar abrir o console do Firebase.
//
// Responsáveis é tratado diferente dos outros: nunca tem remoção, só
// ativar/desativar. Um código de responsável é permanente (ver regras que
// não podem ser quebradas no README) — removê-lo da lista não apagaria o
// histórico, mas seria fácil alguém reaproveitar o código sem querer depois.
// Os demais (Vendedores, Produtos, Marcas, Filiais) são só valores de texto
// que os ECS guardam copiados, então remover uma opção da lista não afeta
// nenhum ECS já criado — só deixa de aparecer para novos registros.

import { getVendedores, getProdutos, getMarcas, getFiliais, getResponsaveis, saveList } from '../settings-service.js';
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
          <div class="card__title-block"><h2>Produtos</h2></div>
        </div>
        <div data-section="produtos"><div class="skeleton-row"></div></div>
      </div>

      <div class="card">
        <div class="card__header">
          <div class="card__title-block"><h2>Marcas</h2></div>
        </div>
        <div data-section="marcas"><div class="skeleton-row"></div></div>
      </div>
    </div>
  `;

  await Promise.all([
    renderResponsaveisSection(root.querySelector('[data-section="responsaveis"]')),
    renderFiliaisSection(root.querySelector('[data-section="filiais"]')),
    renderSimpleListSection(root.querySelector('[data-section="vendedores"]'), 'vendedores', 'vendedor', getVendedores),
    renderSimpleListSection(root.querySelector('[data-section="produtos"]'), 'produtos', 'produto', getProdutos),
    renderSimpleListSection(root.querySelector('[data-section="marcas"]'), 'marcas', 'marca', getMarcas),
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
