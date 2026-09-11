'use client'

import { useState, useMemo } from 'react'
import { salvaTarget } from './actions'

const CATEGORIE = ['Azioni', 'Obbligazioni', 'Materie prime', 'Crypto', 'Multiasset'] as const

export function FormTarget({
  contenitoreId,
  targetAttivoIniziale,
  percentualiIniziali,
}: {
  contenitoreId: string
  targetAttivoIniziale: boolean
  percentualiIniziali: Record<string, number>
}) {
  const [targetAttivo, setTargetAttivo] = useState(targetAttivoIniziale)
  const [percentuali, setPercentuali] = useState<Record<string, number>>(percentualiIniziali)

  const somma = useMemo(
    () => CATEGORIE.reduce((acc, cat) => acc + (percentuali[cat] ?? 0), 0),
    [percentuali]
  )

  const sommaOk = Math.abs(somma - 100) < 0.01
  const puoSalvare = !targetAttivo || sommaOk

  function handleChange(categoria: string, valore: string) {
    setPercentuali((prev) => ({ ...prev, [categoria]: valore === '' ? 0 : Number(valore) }))
  }

  return (
    <form
      action={salvaTarget}
      style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 420 }}
    >
      <input type="hidden" name="contenitore_id" value={contenitoreId} />

      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          name="target_attivo"
          checked={targetAttivo}
          onChange={(e) => setTargetAttivo(e.target.checked)}
        />
        Target attivo per questo contenitore
      </label>

      {!targetAttivo && (
        <p style={{ color: '#666', fontSize: 13, margin: 0 }}>
          Con il target disattivato, questo contenitore non comparirà negli alert di ribilanciamento
          né nella barra di composizione, indipendentemente dai valori sotto.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {CATEGORIE.map((cat) => (
          <label key={cat}>
            {cat}
            <input
              type="number"
              name={`percentuale_${cat}`}
              min="0"
              max="100"
              step="any"
              value={percentuali[cat] ?? 0}
              onChange={(e) => handleChange(cat, e.target.value)}
              style={{ width: '100%' }}
            />
          </label>
        ))}
      </div>

      <div style={{ fontSize: 14, color: targetAttivo ? (sommaOk ? '#0a7d2c' : '#c0392b') : '#666' }}>
        Somma: {somma.toFixed(2)}%{targetAttivo && !sommaOk ? ' — deve fare 100%' : ''}
      </div>

      <button type="submit" disabled={!puoSalvare}>
        Salva target
      </button>
    </form>
  )
}