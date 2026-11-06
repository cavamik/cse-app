import type { Archive, CatalogoItem } from '../types'

export const RUOLI_INIZIALI = [
  'Edile',
  'Meccanico',
  'Elettrico',
  'Tinteggiatore',
  'Cartongessi',
  'Idraulico',
  'Impianti',
  'Scavi e movimento terra',
  'Coperture',
  'Serramenti',
  'Pavimenti e rivestimenti',
  'Fabbro',
  'Lattoniere',
  'Smaltimento e bonifiche',
]

export const APPRESTAMENTI_INIZIALI = [
  'Ponteggio metallico',
  'Gru a torre',
  'Recinzione di cantiere',
  'Trabattello',
  'Sistema anticaduta / Linea vita',
  'Parapetti provvisori',
  'Scale portatili',
  'Reti di sicurezza',
  'Autogrù',
  'Piattaforma di lavoro elevabile (PLE)',
  'Impianto elettrico di cantiere',
  'Quadro elettrico di cantiere',
  'Cassette di medicazione',
  'Estintori',
  'Segnaletica di sicurezza',
  'Andatoie e passerelle',
  'Armature di scavo',
  'Castello di carico',
  'Betoniera',
  'Silos',
  'Accessi e viabilità di cantiere',
  'Servizi igienico-assistenziali',
]

function slug(nome: string) {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function catalogoIniziale(): CatalogoItem[] {
  return APPRESTAMENTI_INIZIALI.map((nome) => ({ id: `app-${slug(nome)}`, nome }))
}

export function createSeed(): Archive {
  return {
    version: 1,
    cantieri: [],
    imprese: [],
    ruoli: [...RUOLI_INIZIALI],
    apprestamenti: catalogoIniziale(),
    verbali: [],
  }
}
