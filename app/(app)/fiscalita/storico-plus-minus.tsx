'use client'

import { useMemo, useState } from 'react'
import { formatEuro, formatEuroSigned, formatPercent } from '@/lib/format'
import { RippleLink } from '@/components/ripple-link'
import type { RigaVerificaTrattenuta } from './verifica-trattenute'

export type RigaNonRealizzata = {
  key: string
  strumento_id: string
  strumento_nome: string
  contenitore_nome: string
  plus_minus: number
  rendimento_pct: number
}

type Modalita = 'realizzate' | 'non-realizzate'

const RIGHE_PER_PAGINA = 25

export function StoricoPlusMinus({
  righeRealizzate,
  righeNonRealizzate,
}: {
  righeRealizzate: RigaVerificaTrattenuta[]
  righeNonRealizzate: RigaNonRealizzata[]
}) {
  const [modalita, setModalita] = useState<Modalita>('realizzate')
  const [query, setQuery] = useState('')
  const [righeVisibili, setRigheVisibili] = useState(RIGHE_PER_PAGINA)

  const anniDisponibili = useMemo(() => {
    const anni = new Set(righeRealizzate.map((r) => Number(r.data_vendita.slice(0, 4))))
    return Array.from(anni).sort((a, b) => b - a)
  }, [righeRealizzate])

  const [anniSelezionati, setAnniSelezionati] = useState<Set<number>>(() => new Set(anniDisponibili))

  const testo = query.trim().toLowerCase()

  const righeRealizzateFiltrate = useMemo(() => {
    return righeRealizzate.filter((r) => {
      const passaAnno = anniSelezionati.has(Number(r.data_vendita.slice(0, 4)))
      if (!passaAnno) return false
      if (!testo) return true
      return r.strumento_nome.toLowerCase().includes(testo)
    })
  }, [righeRealizzate, testo, anniSelezionati])

  const righeNonRealizzateFiltrate = useMemo(() => {
    if (!testo) return righeNonRealizzate
    return righeNonRealizzate.filter((r) => r.strumento_nome.toLowerCase().includes(testo))
  }, [righeNonRealizzate, testo])

  const righeFiltrateCorrenti: (RigaVerificaTrattenuta | RigaNonRealizzata)[] =
    modalita === 'realizzate' ? righeRealizzateFiltrate : righeNonRealizzateFiltrate
  const righeMostrate = righeFiltrateCorrenti.slice(0, righeVisibili)
  const ciSonoAltre = righeVisibili < righeFiltrateCorrenti.length

  function toggleAnno(anno: number) {
    setAnniSelezionati((prev) => {
      const next = new Set(prev)
      if (next.has(anno)) next.delete(anno)
      else next.add(anno)
      return next
    })
  }

  function cambiaModalita(nuova: Modalita) {
    setModalita(nuova)
    setRigheVisibili(RIGHE_PER_PAGINA)
  }

  return (
    <div>
      <style>{`
        .filtro-anno-storico > summary { list-style: none; cursor: pointer; }
        .filtro-anno-storico > summary::-webkit-details-marker { display: none; }
      `}</style>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex' }}>
          <button
            type="button"
            onClick={() => cambiaModalita('realizzate')}
            style={{
              padding: '6px 14px',
              border: modalita === 'realizzate' ? 'none' : '1px solid var(--border-default)',
              background: modalita === 'realizzate' ? 'var(--primary)' : 'var(--bg-surface)',
              color: modalita === 'realizzate' ? '#fff' : 'var(--text-secondary)',
              fontSize: 'var(--fs-table)',
              cursor: 'pointer',
            }}
          >
            Realizzate
          </button>
          <button
            type="button"
            onClick={() => cambiaModalita('non-realizzate')}
            style={{
              padding: '6px 14px',
              border: modalita === 'non-realizzate' ? 'none' : '1px solid var(--border-default)',
              background: modalita === 'non-realizzate' ? 'var(--primary)' : 'var(--bg-surface)',
              color: modalita === 'non-realizzate' ? '#fff' : 'var(--text-secondary)',
              fontSize: 'var(--fs-table)',
              cursor: 'pointer',
            }}
          >
            Non realizzate
          </button>
        </div>

        <input
          type="text"
          placeholder="Filtra per strumento..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            padding: '6px 10px',
            border: '1px solid var(--border-default)',
            width: 220,
            fontSize: 'var(--fs-table)',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
          }}
        />

        {modalita === 'realizzate' && (
          <details className="filtro-anno-storico" style={{ position: 'relative' }}>
            <summary
              style={{
                padding: '6px 10px',
                border: '1px solid var(--border-default)',
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
        )}

        <div style={{ marginLeft: 'auto', fontSize: 'var(--fs-card-link)' }}>
          <RippleLink href="/gestione/fiscalita" className="link-interattivo">
            Esporta questi dati →
          </RippleLink>
        </div>
      </div>

      {righeFiltrateCorrenti.length === 0 ? (
        <p style={{ fontSize: 'var(--fs-body)', marginTop: 12, color: 'var(--text-secondary)' }}>
          {modalita === 'realizzate' ? 'Nessuna vendita trovata.' : 'Nessuna posizione trovata.'}
        </p>
      ) : modalita === 'realizzate' ? (
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
              {(righeMostrate as RigaVerificaTrattenuta[]).map((v) => {
                const scostamentoRilevante = Math.abs(Number(v.differenza)) > 0.01
                return (
                  <tr key={v.vendita_id} className="tabella-riga">
                    <td style={{ padding: 8 }}>{new Date(v.data_vendita).toLocaleDateString('it-IT')}</td>
                    <td style={{ padding: 8 }}>
                      <RippleLink href={`/asset/${v.strumento_id}`} className="link-interattivo">
                        {v.strumento_nome}
                      </RippleLink>
                    </td>
                    <td style={{ padding: 8 }}>{formatEuro(Number(v.valore))}</td>
                    <td style={{ padding: 8 }}>{formatEuro(Number(v.plusvalenza_totale_vendita))}</td>
                    <td style={{ padding: 8 }}>{formatPercent(Number(v.aliquota_attesa_pct), 2)}</td>
                    <td style={{ padding: 8 }}>{formatEuro(Number(v.tassa_attesa))}</td>
                    <td style={{ padding: 8 }}>{formatEuro(Number(v.tassa_trattenuta_effettiva))}</td>
                    <td
                      style={{
                        padding: 8,
                        color: scostamentoRilevante ? 'var(--warning)' : undefined,
                        fontWeight: scostamentoRilevante ? 500 : undefined,
                      }}
                    >
                      {formatEuro(Number(v.differenza))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', fontSize: 'var(--fs-table)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              {righeMostrate.length} di {righeFiltrateCorrenti.length}
            </span>
            {ciSonoAltre && (
              <>
                <button
                  type="button"
                  className="link-interattivo"
                  style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                  onClick={() => setRigheVisibili((v) => v + RIGHE_PER_PAGINA)}
                >
                  Mostra altre {Math.min(RIGHE_PER_PAGINA, righeFiltrateCorrenti.length - righeVisibili)}
                </button>
                <button
                  type="button"
                  className="link-interattivo"
                  style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                  onClick={() => setRigheVisibili(righeFiltrateCorrenti.length)}
                >
                  Mostra tutte
                </button>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, color: 'var(--text-primary)', fontSize: 'var(--fs-table)' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Strumento</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Contenitore</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Plus/minus</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Rendimento</th>
              </tr>
            </thead>
            <tbody>
              {(righeMostrate as RigaNonRealizzata[]).map((n) => (
                <tr key={n.key} className="tabella-riga">
                  <td style={{ padding: 8 }}>
                    <RippleLink href={`/asset/${n.strumento_id}`} className="link-interattivo">
                      {n.strumento_nome}
                    </RippleLink>
                  </td>
                  <td style={{ padding: 8 }}>{n.contenitore_nome}</td>
                  <td style={{ padding: 8, color: n.plus_minus >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {formatEuroSigned(n.plus_minus)}
                  </td>
                  <td style={{ padding: 8, color: n.rendimento_pct >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {formatPercent(n.rendimento_pct, 2, true)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', fontSize: 'var(--fs-table)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              {righeMostrate.length} di {righeFiltrateCorrenti.length}
            </span>
            {ciSonoAltre && (
              <>
                <button
                  type="button"
                  className="link-interattivo"
                  style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                  onClick={() => setRigheVisibili((v) => v + RIGHE_PER_PAGINA)}
                >
                  Mostra altre {Math.min(RIGHE_PER_PAGINA, righeFiltrateCorrenti.length - righeVisibili)}
                </button>
                <button
                  type="button"
                  className="link-interattivo"
                  style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                  onClick={() => setRigheVisibili(righeFiltrateCorrenti.length)}
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