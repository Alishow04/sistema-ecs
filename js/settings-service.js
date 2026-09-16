// Cache em memória das listas de configuração (settings/*), para não ler o
// Firestore de novo a cada troca de tela. Vive apenas durante a sessão da
// aba — um F5 busca de novo, o que é aceitável para listas que mudam pouco.

import { readSettingsDoc } from './firebase-service.js';

const cache = {};

async function getList(name) {
  if (cache[name]) return cache[name];
  const data = await readSettingsDoc(name);
  cache[name] = (data && data.list) || [];
  return cache[name];
}

export const getResponsaveis = () => getList('responsaveis'); // [{code, name, active}]
export const getVendedores = () => getList('vendedores'); // ["Olinger - BRU", ...]
export const getProdutos = () => getList('produtos'); // ["Válvulas", ...]
export const getMarcas = () => getList('marcas'); // ["APV", ...]

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
