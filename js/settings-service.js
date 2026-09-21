// Cache em memória das listas de configuração (settings/*), para não ler o
// Firestore de novo a cada troca de tela. Vive apenas durante a sessão da
// aba — um F5 busca de novo, o que é aceitável para listas que mudam pouco.

import { readSettingsDoc, writeSettingsDoc } from './firebase-service.js';

const cache = {};

async function getList(name) {
  if (cache[name]) return cache[name];
  const data = await readSettingsDoc(name);
  cache[name] = (data && data.list) || [];
  return cache[name];
}

/** Grava uma lista de configuração e já atualiza o cache local (usado em Configurações). */
export async function saveList(name, list) {
  await writeSettingsDoc(name, list);
  cache[name] = list;
}

export const getResponsaveis = () => getList('responsaveis'); // [{code, name, active}]
export const getVendedores = () => getList('vendedores'); // ["Olinger - BRU", ...]
export const getMarcas = () => getList('marcas'); // ["APV", ...]

/**
 * Configuração de produtos por marca.
 * Formato novo: [{ name: "Válvulas", brand: "APV" }, ...]
 *
 * Compatibilidade: versões antigas gravavam apenas strings. Elas são
 * normalizadas como brand:"" para aparecerem em Configurações como itens
 * legados sem marca, sem atribuir uma marca automaticamente.
 */
export async function getProdutosConfig() {
  const raw = await getList('produtos');
  return raw
    .map((item) => {
      if (typeof item === 'string') return { name: item, brand: '' };
      if (item && typeof item === 'object') {
        return {
          name: String(item.name || item.product || '').trim(),
          brand: String(item.brand || '').trim(),
        };
      }
      return null;
    })
    .filter((item) => item && item.name);
}

/**
 * Lista plana e sem duplicidades dos nomes dos produtos.
 * Mantida para filtros/relatórios que não dependem da marca selecionada.
 */
export async function getProdutos() {
  const items = await getProdutosConfig();
  return Array.from(new Set(items.map((p) => p.name))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** Produtos disponíveis para uma marca específica. */
export async function getProdutosPorMarca(brand) {
  if (!brand) return [];
  const items = await getProdutosConfig();
  return Array.from(new Set(
    items
      .filter((p) => p.brand === brand)
      .map((p) => p.name)
  )).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** Filiais no formato [{ name: "Matriz", state: "SC" }, ...] */
export const getFiliais = () => getList('filiais');

/** Dado o nome da filial selecionada, devolve o UF amarrado a ela (ou ''). */
export async function getEstadoDaFilial(filialName) {
  const filiais = await getFiliais();
  const found = filiais.find((f) => f.name === filialName);
  return found ? found.state : '';
}

/** Lista de UFs distintos entre as filiais cadastradas — usada no filtro "Estado" do Histórico. */
export async function getEstadosDisponiveis() {
  const filiais = await getFiliais();
  return Array.from(new Set(filiais.map((f) => f.state).filter(Boolean))).sort();
}

/** Responsáveis ativos, no formato usado pelos filtros ([{code, name}]). */
export async function getResponsaveisAtivos() {
  const responsaveis = await getResponsaveis();
  return responsaveis.filter((r) => r.active !== false);
}

/** Força recarregar tudo do Firestore na próxima chamada (usar após editar em Configurações). */
export function invalidateSettingsCache() {
  Object.keys(cache).forEach((k) => delete cache[k]);
}
