// Sparkline puramente decorativo — sem eixos, sem números, sem tooltip.
// Existe justamente para dar uma noção de "tem atividade acontecendo" sem
// expor a contagem exata (ver decisão de produto no Dashboard: números
// pessoais/diários podem virar meta implícita e gerar ansiedade).

/**
 * @param {number[]} values - contagens em ordem cronológica (mais antigo primeiro)
 * @param {object} [opts]
 */
export function renderSparklineSvg(values, {
  width = 600,
  height = 56,
  color = 'var(--fiedler-blue)',
  fillOpacity = 0.14,
} = {}) {
  if (!values || values.length === 0) {
    return `<div class="hint">Sem atividade recente.</div>`;
  }

  const max = Math.max(...values, 1);
  const padding = 4;
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;

  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - padding - (v / max) * (height - padding * 2);
    return [x, y];
  });

  const linePath = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"
         style="width:100%; height:${height}px; display:block;" aria-hidden="true">
      <path d="${areaPath}" fill="${color}" fill-opacity="${fillOpacity}" stroke="none"></path>
      <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
  `;
}
