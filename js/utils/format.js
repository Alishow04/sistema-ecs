// Utilitários puros de formatação — sem dependência de Firestore/DOM,
// fáceis de testar isoladamente.

/** Monta o código visível, ex: buildEcsCode('AK', 2026, 1900) -> "ECS-AK-26-1900" */
export function buildEcsCode(creatorCode, year, sequence) {
  const yy = String(year).slice(-2);
  const seq = String(sequence).padStart(4, '0');
  return `ECS-${creatorCode}-${yy}-${seq}`;
}

/** "2026-09-15" -> "15/09/2026" */
export function formatDateBR(isoDate) {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

/** Timestamp do Firestore -> "15/09/2026 11:40" */
export function formatDateTimeBR(timestamp) {
  if (!timestamp) return '—';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

/** Data local do navegador no formato yyyy-mm-dd, para preencher o campo Data por padrão. */
export function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
