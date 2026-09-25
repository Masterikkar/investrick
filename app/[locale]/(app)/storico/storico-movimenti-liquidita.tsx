'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { formatData, formatEuro, type LocaleFormato } from '@/lib/format'
import { RippleLink } from '@/components/ripple-link'
import { CHIAVE_TRADUZIONE_TIPO_MOVIMENTO_LIQUIDITA } from '@/lib/i18n-tipi-movimento-liquidita'
import { aggiornaContenitoreMovimentoLiquidita, eliminaMovimentoLiquidita } from '../gestione/transazioni/actions'
import { useConferma } from '@/components/conferma'

export type RigaStoricoMovimentoLiquidita = {
  id: string
  data: string
  tipo_movimento: string
  contenitore_id: string | null
  importo: number
  tassa_trattenuta: number
  strumento_id: string
  strumento_nome: string
}

type Contenitore = { id: string; nome: string }

const RIGHE_PER_PAGINA = 100

export function StoricoMovimentiLiquidita({
  movimenti,
  contenitori,
}: {
  movimenti: RigaStoricoMovimentoLiquidita[]
  contenitori: Contenitore[]
}) {
  const t = useTranslations('PaginaStorico')
  const locale = useLocale() as LocaleFormato
  const tFiltroTabellaStorico = useTranslations('FiltroTabellaStorico')
  const tTipiMovimento = useTranslations('TipiMovimentoLiquidita')
  const tContenitori = useTranslations('Contenitori')
  const tPaginaFiscalita = useTranslations('PaginaFiscalita')
  const tGestioneStrumenti = useTranslations('PaginaGestioneStrumenti')
  const conferma = useConferma()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [erroreId, setErroreId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [righeVisibili, setRigheVisibili] = useState(RIGHE_PER_PAGINA)

  const anniDisponibili = useMemo(() => {
    const anni = new Set(movimenti.map((m) => Number(m.data.slice(0, 4))))
    return Array.from(anni).sort((a, b) => b - a)
  }, [movimenti])

  const [anniSelezionati, setAnniSelezionati] = useState<Set<number>>(() => new Set(anniDisponibili))

  function nomeContenitore(id: string | null) {
    if (id === null) return '—'
    return contenitori.find((c) => c.id === id)?.nome ?? '—'
  }

  function etichettaTipoMovimento(tipo: string): string {
    const chiave = CHIAVE_TRADUZIONE_TIPO_MOVIMENTO_LIQUIDITA[tipo]
    return chiave ? tTipiMovimento(chiave) : tipo
  }

  const testo = query.trim().toLowerCase()

  const righeFiltrate = useMemo(() => {
    return movimenti.filter((m) => {
      const passaAnno = anniSelezionati.has(Number(m.data.slice(0, 4)))
      if (!passaAnno) return false
      if (!testo) return true
      return m.strumento_nome.toLowerCase().includes(testo)
    })
  }, [movimenti, testo, anniSelezionati])

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

  function handleSposta(movimentoId: string, valoreSelezionato: string) {
    if (!valoreSelezionato) return
    setErroreId(null)
    setPendingId(movimentoId)

    const nuovoContenitoreId = valoreSelezionato === 'diretto' ? null : valoreSelezionato

    startTransition(async () => {
      const risultato = await aggiornaContenitoreMovimentoLiquidita(movimentoId, nuovoContenitoreId)
      setPendingId(null)
      if ('errore' in risultato) {
        setErroreId(movimentoId)
      } else {
        router.refresh()
      }
    })
  }

  async function handleElimina(riga: RigaStoricoMovimentoLiquidita) {
    const base = t('descrizioneOperazioneData', {
      operazione: etichettaTipoMovimento(riga.tipo_movimento),
      data: formatData(riga.data, locale),
    })
    const descrizione = `${base} — ${riga.strumento_nome}`

    const confermato = await conferma({
      titolo: t('titoloEliminaMovimento'),
      messaggio: t('confermaEliminazioneMovimento', { descrizione }),
      etichettaConferma: tGestioneStrumenti('bottoneElimina'),
      pericoloso: true,
    })
    if (!confermato) return

    setErroreId(null)
    setPendingId(riga.id)

    startTransition(async () => {
      const risultato = await eliminaMovimentoLiquidita(riga.id)
      setPendingId(null)
      if ('errore' in risultato) {
        setErroreId(riga.id)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div>
      <style>{`
        .filtro-anno > summary { list-style: none; cursor: pointer; }
        .filtro-anno > summary::-webkit-details-marker { display: none; }
      `}</style>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <input
          type="text"
          placeholder={tFiltroTabellaStorico('placeholderFiltraStrumento')}
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

        <details className="filtro-anno" style={{ position: 'relative' }}>
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
            {tFiltroTabellaStorico('filtroPerAnno')}
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
                {tFiltroTabellaStorico('selezionaTutto')}
              </button>
              <button type="button" className="link-interattivo" style={{ border: 'none', background: 'none', padding: 0 }} onClick={() => setAnniSelezionati(new Set())}>
                {tFiltroTabellaStorico('deselezionaTutto')}
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

      {erroreId && (
        <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-body)', marginTop: 8 }}>
          {t('alertErroreOperazione')}
        </p>
      )}

      {righeFiltrate.length === 0 ? (
        <p style={{ fontSize: 'var(--fs-body)', marginTop: 12, color: 'var(--text-secondary)' }}>{t('alertNessunaTransazioneTrovata')}</p>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, color: 'var(--text-primary)', fontSize: 'var(--fs-table)' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaFiscalita('colonnaData')}</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaFiscalita('colonnaStrumento')}</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaTipoMovimento')}</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tContenitori('colonnaGruppo')}</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaImporto')}</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaFiscalita('colonnaTassaTrattenuta')}</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaAzioni')}</th>
              </tr>
            </thead>
            <tbody>
              {righeMostrate.map((m) => {
                const inCorso = pendingId === m.id
                return (
                  <tr key={m.id} className="tabella-riga">
                    <td style={{ padding: 8 }}>{formatData(m.data, locale)}</td>
                    <td style={{ padding: 8 }}>
                      <RippleLink href={`/liquidita/${m.strumento_id}`} className="link-interattivo">
                        {m.strumento_nome}
                      </RippleLink>
                    </td>
                    <td style={{ padding: 8 }}>{etichettaTipoMovimento(m.tipo_movimento)}</td>
                    <td style={{ padding: 8 }}>{nomeContenitore(m.contenitore_id)}</td>
                    <td style={{ padding: 8 }}>{formatEuro(m.importo, locale)}</td>
                    <td style={{ padding: 8 }}>{formatEuro(m.tassa_trattenuta, locale)}</td>
                    <td style={{ padding: 8 }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <div style={{ position: 'relative', display: 'inline-flex' }}>
                          <button
                            type="button"
                            disabled={inCorso}
                            title={t('titleSpostaContenitore')}
                            style={{
                              border: 'none',
                              background: 'none',
                              cursor: inCorso ? 'default' : 'pointer',
                              fontSize: 16,
                              padding: '2px 4px',
                              opacity: inCorso ? 0.4 : 1,
                              color: 'var(--text-secondary)',
                            }}
                          >
                            →
                          </button>
                          <select
                            value=""
                            disabled={inCorso}
                            onChange={(e) => handleSposta(m.id, e.target.value)}
                            aria-label={t('titleSpostaContenitore')}
                            style={{
                              position: 'absolute',
                              inset: 0,
                              opacity: 0,
                              cursor: inCorso ? 'default' : 'pointer',
                            }}
                          >
                            <option value="">{t('optionSpostaIn')}</option>
                            {m.contenitore_id !== null && <option value="diretto">{tContenitori('nessunGruppo')}</option>}
                            {contenitori
                              .filter((c) => c.id !== m.contenitore_id)
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.nome}
                                </option>
                              ))}
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleElimina(m)}
                          disabled={inCorso}
                          title={t('titoloEliminaMovimento')}
                          style={{
                            border: 'none',
                            background: 'none',
                            cursor: inCorso ? 'default' : 'pointer',
                            fontSize: 16,
                            padding: '2px 4px',
                            color: 'var(--danger)',
                            opacity: inCorso ? 0.4 : 1,
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', fontSize: 'var(--fs-table)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              {tFiltroTabellaStorico('conteggioRighe', { mostrate: righeMostrate.length, totali: righeFiltrate.length })}
            </span>
            {ciSonoAltre && (
              <>
                <button
                  type="button"
                  className="link-interattivo"
                  style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                  onClick={() => setRigheVisibili((v) => v + RIGHE_PER_PAGINA)}
                >
                  {tFiltroTabellaStorico('paginazioneMostraAltre', { n: Math.min(RIGHE_PER_PAGINA, righeFiltrate.length - righeVisibili) })}
                </button>
                <button
                  type="button"
                  className="link-interattivo"
                  style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                  onClick={() => setRigheVisibili(righeFiltrate.length)}
                >
                  {tFiltroTabellaStorico('paginazioneMostraTutte')}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}