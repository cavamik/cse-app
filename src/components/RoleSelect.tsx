import { useState } from 'react'
import { useApp } from '../state/AppContext'
import { Button } from './ui'

export function RoleSelect({ value, onChange }: { value: string; onChange: (ruolo: string) => void }) {
  const { archive, addRuolo } = useApp()
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const [error, setError] = useState('')
  const options = value && !archive.ruoli.includes(value) ? [...archive.ruoli, value] : archive.ruoli

  function commit() {
    const ruolo = addRuolo(custom)
    if (!ruolo) {
      setError('Scrivi il nome del ruolo.')
      return
    }
    onChange(ruolo)
    setCustom('')
    setError('')
    setOpen(false)
  }

  return (
    <div className="space-y-2">
      <select
        className="field field-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Ruolo o specializzazione"
      >
        <option value="">Seleziona ruolo</option>
        {options.map((ruolo) => (
          <option key={ruolo} value={ruolo}>
            {ruolo}
          </option>
        ))}
      </select>
      {open ? (
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="field"
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
              placeholder="Es. Ponteggiatore"
              aria-label="Nuovo ruolo"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commit()
                }
              }}
            />
            <Button className="sm:w-auto" onClick={commit}>
              Aggiungi
            </Button>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button type="button" className="text-sm font-semibold text-muted" onClick={() => setOpen(false)}>
            Annulla
          </button>
        </div>
      ) : (
        <button type="button" className="text-sm font-semibold text-amber-deep" onClick={() => setOpen(true)}>
          + Nuovo ruolo
        </button>
      )}
    </div>
  )
}
