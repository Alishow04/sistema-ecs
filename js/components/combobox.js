// Combobox pesquisável simples, sem dependências externas.
// Comportamento híbrido: clicar abre a lista completa; digitar filtra.
// Usado nos campos Vendedor / Filial / Produto / Marca.

/**
 * @param {object} opts
 * @param {HTMLElement} opts.container - onde montar o componente
 * @param {string[]} opts.options - lista de valores disponíveis
 * @param {string} [opts.placeholder]
 * @param {string} [opts.initialValue]
 * @param {(value:string)=>void} [opts.onChange]
 * @param {boolean} [opts.allowFreeText] - se true, aceita valor digitado que não está na lista
 * @param {boolean} [opts.disabled] - inicia desabilitado
 * @param {boolean} [opts.showClearButton] - exibe X para limpar seleção (padrão true)
 */
export function createCombobox({
  container,
  options,
  placeholder = 'Selecione...',
  initialValue = '',
  onChange = () => {},
  allowFreeText = false,
  disabled = false,
  showClearButton = true,
}) {
  let availableOptions = [...(options || [])];
  let currentPlaceholder = placeholder;
  let currentValue = initialValue || '';
  let highlighted = -1;

  container.classList.add('combobox');
  container.innerHTML = `
    <div class="combobox__control">
      <input type="text" autocomplete="off" placeholder="${currentPlaceholder}" />
      <button type="button" class="combobox__clear" aria-label="Limpar seleção" title="Limpar seleção" hidden>×</button>
      <button type="button" class="combobox__toggle" aria-label="Abrir opções" title="Abrir opções" tabindex="-1">⌄</button>
    </div>
    <div class="combobox__list" hidden></div>
  `;

  const control = container.querySelector('.combobox__control');
  const input = container.querySelector('input');
  const clearBtn = container.querySelector('.combobox__clear');
  const toggleBtn = container.querySelector('.combobox__toggle');
  const list = container.querySelector('.combobox__list');

  input.value = currentValue;
  setDisabledState(disabled);
  updateAffordances();

  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function updateAffordances() {
    clearBtn.hidden = !showClearButton || !currentValue || input.disabled;
    control.classList.toggle('has-value', Boolean(currentValue));
  }

  function setDisabledState(value) {
    const isDisabled = Boolean(value);
    input.disabled = isDisabled;
    toggleBtn.disabled = isDisabled;
    clearBtn.disabled = isDisabled;
    container.classList.toggle('is-disabled', isDisabled);
    if (isDisabled) list.hidden = true;
    updateAffordances();
  }

  function buildOptionButton(option) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'combobox__option';
    btn.textContent = option;
    btn.dataset.value = option;

    if (option === currentValue) {
      btn.classList.add('is-selected');
      btn.setAttribute('aria-selected', 'true');
    }

    btn.addEventListener('mousedown', (e) => {
      // Evita o blur do input antes que a seleção seja concluída.
      e.preventDefault();
      selectValue(option);
    });

    return btn;
  }

  function renderList(filterText = '') {
    if (input.disabled) return;

    const normalizedFilter = normalize(filterText);
    const filtered = availableOptions.filter((o) =>
      !normalizedFilter || normalize(o).includes(normalizedFilter)
    );

    highlighted = -1;
    list.innerHTML = '';

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'combobox__empty';
      empty.textContent = 'Nenhum resultado';
      list.appendChild(empty);
    } else {
      filtered.forEach((option) => list.appendChild(buildOptionButton(option)));
    }

    list.hidden = false;
    container.classList.add('is-open');
  }

  function hideList() {
    list.hidden = true;
    container.classList.remove('is-open');
    highlighted = -1;
  }

  function selectValue(value, notify = true) {
    const previousValue = currentValue;
    currentValue = value || '';
    input.value = currentValue;
    hideList();
    updateAffordances();

    if (notify && previousValue !== currentValue) {
      onChange(currentValue);
    }
  }

  function clearValue(notify = false) {
    const hadValue = Boolean(currentValue || input.value);
    currentValue = '';
    input.value = '';
    hideList();
    updateAffordances();
    if (notify && hadValue) onChange('');
  }

  function openAllOptions({ selectText = false } = {}) {
    if (input.disabled) return;
    renderList('');
    if (selectText && input.value) {
      // Facilita substituir a seleção atual digitando diretamente.
      requestAnimationFrame(() => input.select());
    }
  }

  // Clicar/focar nunca exige apagar a seleção anterior: a lista completa abre.
  input.addEventListener('focus', () => openAllOptions({ selectText: true }));
  input.addEventListener('mousedown', () => {
    if (document.activeElement === input) openAllOptions();
  });

  // Ao digitar, o componente vira pesquisa e filtra normalmente.
  input.addEventListener('input', () => {
    updateAffordances();
    renderList(input.value);
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      hideList();

      if (!allowFreeText && input.value !== currentValue) {
        if (!availableOptions.includes(input.value)) {
          input.value = currentValue;
        } else {
          selectValue(input.value);
        }
      } else if (allowFreeText) {
        const typed = input.value;
        if (typed !== currentValue) {
          currentValue = typed;
          updateAffordances();
          onChange(typed);
        }
      }
    }, 120);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && list.hidden) {
      openAllOptions();
    }

    const opts = Array.from(list.querySelectorAll('.combobox__option'));
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlighted = Math.min(highlighted + 1, opts.length - 1);
      opts.forEach((o, i) => o.classList.toggle('is-highlighted', i === highlighted));
      opts[highlighted]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlighted = Math.max(highlighted - 1, 0);
      opts.forEach((o, i) => o.classList.toggle('is-highlighted', i === highlighted));
      opts[highlighted]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && highlighted >= 0 && opts[highlighted]) {
      e.preventDefault();
      selectValue(opts[highlighted].dataset.value);
    } else if (e.key === 'Escape') {
      hideList();
      input.value = currentValue;
    }
  });

  toggleBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (input.disabled) return;

    const shouldOpen = list.hidden;
    input.focus();
    if (shouldOpen) openAllOptions();
    else hideList();
  });

  clearBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (input.disabled) return;
    clearValue(true);
    input.focus();
    openAllOptions();
  });

  return {
    getValue: () => currentValue,
    setValue: (value, notify = false) => {
      const previousValue = currentValue;
      currentValue = value || '';
      input.value = currentValue;
      updateAffordances();
      if (notify && previousValue !== currentValue) onChange(currentValue);
    },
    clear: (notify = false) => clearValue(notify),
    setOptions: (nextOptions, { preserveValue = false } = {}) => {
      availableOptions = [...(nextOptions || [])];
      if (!preserveValue || (currentValue && !availableOptions.includes(currentValue))) {
        clearValue(false);
      }
      if (!list.hidden) renderList('');
    },
    setDisabled: (value) => setDisabledState(value),
    setPlaceholder: (value) => {
      currentPlaceholder = value || 'Selecione...';
      input.placeholder = currentPlaceholder;
    },
    open: () => openAllOptions(),
  };
}
