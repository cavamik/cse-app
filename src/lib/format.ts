const MESI = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
]

function parts(iso: string) {
  const [year, month, day] = iso.split('-')
  if (!year || !month || !day) return null
  return { year, month, day }
}

export function formatDateIT(iso: string) {
  const value = parts(iso)
  if (!value) return iso || '—'
  return `${value.day}/${value.month}/${value.year}`
}

export function formatDateLongIT(iso: string) {
  const value = parts(iso)
  const month = value ? MESI[Number(value.month) - 1] : undefined
  if (!value || !month) return iso || '—'
  return `${Number(value.day)} ${month} ${value.year}`
}
