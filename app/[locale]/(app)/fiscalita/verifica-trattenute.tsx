'use client'

import { useMemo, useState } from 'react'
import { useLocale } from 'next-intl'
import { formatData, formatEuro, formatPercent, type LocaleFormato } from '@/lib/format'
import { RippleLink } from '@/components/ripple-link'

export type RigaVerificaTrattenuta = {
  vendita_id: string
  data_vendita: string
  strumento_id: string
  strumento_nome: string
  valore: number
  plusvalenza_totale_vendita: number
  aliquota_attesa_pct: number
  tassa_attesa: number
  tassa_trattenuta_effettiva: number
  differenza: number
}

const RIGHE_PER_PAGINA = 25

export function VerificaTrattenuteTabella({ righe }: { righe: RigaVerificaTrattenuta[] }) {
  const locale = useLocale() as LocaleFormato
  const [query, setQuery] = useState('')
  const [righeVisibili, setRigheVisibili] = useState(RIGHE_PER_PAGINA)

  const anniDisponibili = useMemo(() => {
    const anni = new Set(righe.map((r) => Number(r.data_vendita.slice(0, 4))))
    return Array.from(anni).sort((a, b) => b - a)
  }, [righe])

  const [anniSelezionati, setAnniSelezionati] = useState<Set<number>>(() => new Set(anniDisponibili))

  const testo = query.trim().toLowerCase()

  const righeFiltrate = useMemo(() => {
    return righe.filter((r) => {
      const passaAnno = anniSelezionati.has(Number(r.data_vendita.slice(0, 4)))
      if (!passaAnno) return false
      if (!testo) return true
      return r.strumento_nome.toLowerCase().includes(testo)
    })
  }, [righe, testo, anniSelezionati])

  const righeMostrate = righeFiltrate.slice(0, righeVisibili)
  const ciSonoAltre = righeVisibili < righeFiltrate.length

  function toggleAnno(anno: number) {
    setAnniSelezionati((prev) => {
      const next = new Set(prev)
      if (next.has(anno)) next.delete(anno)
      else next.add(anno)
      return next
    })
  }

  return (
    <div>
      <style>{`
        .filtro-anno-verifica > summary { list-style: none; cursor: pointer; }
        .filtro-anno-verifica > summary::-webkit-details-marker { display: none; }
      `}</style>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <input
          type="text"
          placeholder="Filtra per strumento..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            padding: '6px 10px',
            border: '1px solid var(--border-default)',
            borderRadius: 0,
            width: 260,
            fontSize: 'var(--fs-table)',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
          }}
        />

        <details className="filtro-anno-verifica" style={{ position: 'relative' }}>
          <summary
            style={{
              padding: '6px 10px',
              border: '1px solid var(--border-default)',
              borderRadius: 0,
              fontSize: 'var(--fs-table)',
              display: 'inline-block',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
            }}
          >
            Filtra per anno
            {anniSelezionati.size < anniDisponibili.length ? ` (${anniSelezionati.size})` : ''}
          </summary>
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 0,
              padding: 12,
              zIndex: 10,
              minWidth: 160,
              color: 'var(--text-primary)',
            }}
          >
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 'var(--fs-table)' }}>
              <button type="button" className="link-interattivo" style={{ border: 'none', background: 'none', padding: 0 }} onClick={() => setAnniSelezionati(new Set(anniDisponibili))}>
                Seleziona tutto
              </button>
              <button type="button" className="link-interattivo" style={{ border: 'none', background: 'none', padding: 0 }} onClick={() => setAnniSelezionati(new Set())}>
                Deseleziona tutto
              </button>
            </div>
            {anniDisponibili.map((anno) => (
              <label key={anno} style={{ display: 'block', fontSize: 'var(--fs-table)', marginTop: 4 }}>
                <input
                  type="checkbox"
                  checked={anniSelezionati.has(anno)}
                  onChange={() => toggleAnno(anno)}
                  style={{ marginRight: 6, accentColor: 'var(--primary)' }}
                />
                {anno}
              </label>
            ))}
          </div>
        </details>
      </div>

      {righeFiltrate.length === 0 ? (
        <p style={{ fontSize: 'var(--fs-body)', marginTop: 12, color: 'var(--text-secondary)' }}>Nessuna vendita trovata.</p>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, color: 'var(--text-primary)', fontSize: 'var(--fs-table)' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Data</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Strumento</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Valore</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Plus/minus</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Aliquota attesa</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Tassa attesa</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Tassa trattenuta</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Differenza</th>
              </tr>
            </thead>
            <tbody>
              {righeMostrate.map((v) => {
                const scostamentoRilevante = Math.abs(Number(v.differenza)) > 0.01
                return (
                  <tr key={v.vendita_id} className="tabella-riga">
                    <td style={{ padding: 8 }}>{formatData(v.data_vendita, locale)}</td>
                    <td style={{ padding: 8 }}>
                      <RippleLink href={`/asset/${v.strumento_id}`} className="link-interattivo">
                        {v.strumento_nome}
                      </RippleLink>
                    </td>
                    <td style={{ padding: 8 }}>{formatEuro(Number(v.valore), locale)}</td>
                    <td style={{ padding: 8 }}>{formatEuro(Number(v.plusvalenza_totale_vendita), locale)}</td>
                    <td style={{ padding: 8 }}>{formatPercent(Number(v.aliquota_attesa_pct), 2, false, locale)}</td>
                    <td style={{ padding: 8 }}>{formatEuro(Number(v.tassa_attesa), locale)}</td>
                    <td style={{ padding: 8 }}>{formatEuro(Number(v.tassa_trattenuta_effettiva), locale)}</td>
                    <td
                      style={{
                        padding: 8,
                        color: scostamentoRilevante ? 'var(--warning)' : undefined,
                        fontWeight: scostamentoRilevante ? 500 : undefined,
                      }}
                    >
                      {formatEuro(Number(v.differenza), locale)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', fontSize: 'var(--fs-table)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              {righeMostrate.length} di {righeFiltrate.length}
            </span>
            {ciSonoAltre && (
              <>
                <button
                  type="button"
                  className="link-interattivo"
                  style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                  onClick={() => setRigheVisibili((v) => v + RIGHE_PER_PAGINA)}
                >
                  Mostra altre {Math.min(RIGHE_PER_PAGINA, righeFiltrate.length - righeVisibili)}
                </button>
                <button
                  type="button"
                  className="link-interattivo"
                  style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                  onClick={() => setRigheVisibili(righeFiltrate.length)}
                >
                  Mostra tutte
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}