// Combobox pesquisável simples, sem dependências externas.
// Usado nos campos Vendedor / Filial / Produto / Marca do formulário Novo ECS.

/**
 * @param {object} opts
 * @param {HTMLElement} opts.container - onde montar o componente
 * @param {string[]} opts.options - lista de valores disponíveis
 * @param {string} [opts.placeholder]
 * @param {string} [opts.initialValue]
 * @param {(value:string)=>void} [opts.onChange]
 * @param {boolean} [opts.allowFreeText] - se true, aceita valor digitado que não está na lista
 * @param {boolean} [opts.disabled] - inicia desabilitado
 */
export function createCombobox({
  container,
  options,
  placeholder = 'Selecione...',
  initialValue = '',
  onChange = () => {},
  allowFreeText = false,
  disabled = false,
}) {
  let availableOptions = [...(options || [])];
  let currentPlaceholder = placeholder;

  container.classList.add('combobox');
  container.innerHTML = `
    <input type="text" autocomplete="off" placeholder="${currentPlaceholder}" value="${initialValue}" />
    <div class="combobox__list" hidden></div>
  `;

  const input = container.querySelector('input');
  const list = container.querySelector('.combobox__list');
  let currentValue = initialValue;
  let highlighted = -1;

  input.disabled = disabled;

  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function renderList(filterText) {
    if (input.disabled) return;
    const filtered = availableOptions.filter((o) => normalize(o).includes(normalize(filterText)));
    highlighted = -1;

    if (filtered.length === 0) {
      list.innerHTML = `<div class="combobox__empty">Nenhum resultado</div>`;
    } else {
      list.innerHTML = filtered
        .map((o) => `<button type="button" class="combobox__option">${o}</button>`)
        .join('');
      list.querySelectorAll('.combobox__option').forEach((btn) => {
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          selectValue(btn.textContent);
        });
      });
    }
    list.hidden = false;
  }

  function selectValue(value) {
    currentValue = value;
    input.value = value;
    list.hidden = true;
    onChange(value);
  }

  function clearValue(notify = false) {
    currentValue = '';
    input.value = '';
    list.hidden = true;
    if (notify) onChange('');
  }

  input.addEventListener('focus', () => renderList(input.value));
  input.addEventListener('input', () => renderList(input.value));

  input.addEventListener('blur', () => {
    setTimeout(() => {
      list.hidden = true;
      if (!allowFreeText && input.value !== currentValue) {
        if (!availableOptions.includes(input.value)) {
          input.value = currentValue;
        } else {
          selectValue(input.value);
        }
      } else if (allowFreeText) {
        currentValue = input.value;
        onChange(input.value);
      }
    }, 120);
  });

  input.addEventListener('keydown', (e) => {
    const opts = Array.from(list.querySelectorAll('.combobox__option'));
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlighted = Math.min(highlighted + 1, opts.length - 1);
      opts.forEach((o, i) => o.classList.toggle('is-highlighted', i === highlighted));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlighted = Math.max(highlighted - 1, 0);
      opts.forEach((o, i) => o.classList.toggle('is-highlighted', i === highlighted));
    } else if (e.key === 'Enter' && highlighted >= 0 && opts[highlighted]) {
      e.preventDefault();
      selectValue(opts[highlighted].textContent);
    } else if (e.key === 'Escape') {
      list.hidden = true;
    }
  });

  return {
    getValue: () => currentValue,
    setValue: (value, notify = false) => {
      currentValue = value || '';
      input.value = currentValue;
      if (notify) onChange(currentValue);
    },
    clear: (notify = false) => clearValue(notify),
    setOptions: (nextOptions, { preserveValue = false } = {}) => {
      availableOptions = [...(nextOptions || [])];
      if (!preserveValue || (currentValue && !availableOptions.includes(currentValue))) {
        clearValue(false);
      }
    },
    setDisabled: (value) => {
      input.disabled = Boolean(value);
      if (input.disabled) list.hidden = true;
    },
    setPlaceholder: (value) => {
      currentPlaceholder = value || 'Selecione...';
      input.placeholder = currentPlaceholder;
    },
  };
}
