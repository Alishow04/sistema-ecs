// Helpers de UI compartilhados entre views — mantém app.js/views enxutos.

export function showToast(message, type = 'default') {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const el = document.createElement('div');
  el.className = `toast${type !== 'default' ? ` toast--${type}` : ''}`;
  el.textContent = message;
  region.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

/** Abre um modal simples a partir de HTML já pronto. Devolve função close(). */
export function openModal(innerHtml) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal">${innerHtml}</div>`;

  function close() {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', onKey);

  document.body.appendChild(backdrop);
  backdrop.querySelectorAll('[data-modal-close]').forEach((btn) => {
    btn.addEventListener('click', close);
  });

  return close;
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/**
 * Modal de confirmação no estilo do app, em vez do window.confirm() nativo
 * do navegador (que destoa visualmente do resto da interface).
 * @returns {Promise<boolean>}
 */
export function confirmDialog(message, { confirmLabel = 'Confirmar', cancelLabel = 'Cancelar' } = {}) {
  return new Promise((resolve) => {
    const close = openModal(`
      <div class="modal__body">
        <p style="margin-bottom:20px;">${escapeHtml(message)}</p>
        <div class="confirm-card__actions" style="justify-content:flex-end;">
          <button type="button" class="btn btn--secondary" data-confirm-cancel>${cancelLabel}</button>
          <button type="button" class="btn btn--primary" data-confirm-ok>${confirmLabel}</button>
        </div>
      </div>
    `);

    const modalEl = document.querySelector('.modal-backdrop:last-of-type');
    modalEl.querySelector('[data-confirm-cancel]').addEventListener('click', () => {
      close();
      resolve(false);
    });
    modalEl.querySelector('[data-confirm-ok]').addEventListener('click', () => {
      close();
      resolve(true);
    });
  });
}
