'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { formatEuro, type LocaleFormato } from '@/lib/format'
import { traduciCategoria } from '@/lib/i18n-categorie'
import { RippleLink } from '@/components/ripple-link'
import { Sezione } from '@/components/sezione'
import { stileCampoFiltro } from '@/components/tabella-ordinabile'
import { aggiungiMembro, rimuoviMembro } from './actions'

export type StrumentoSelezionabile = {
  id: string
  nome: string
  ticker: string | null
  isin: string | null
  categoria: string
  valore: number
}

const stileTh: React.CSSProperties = { padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }

const stileBottone: React.CSSProperties = {
  fontSize: 'var(--fs-button-outline)',
  color: 'var(--text-primary)',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  padding: '4px 12px',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

function Tabella({
  contenitoreId,
  strumenti,
  azione,
  etichettaBottone,
}: {
  contenitoreId: string
  strumenti: StrumentoSelezionabile[]
  azione: (formData: FormData) => Promise<void>
  etichettaBottone: string
}) {
  const t = useTranslations('PaginaContenitore')
  const tCategorie = useTranslations('Categorie')
  const tTabella = useTranslations('TabellaOrdinabile')
  const locale = useLocale() as LocaleFormato

  return (
    // Larghezza sul contenuto, non su tutta la sezione: su schermi larghi il
    // pulsante resta accanto ai dati invece di finire in fondo a destra.
    <table style={{ borderCollapse: 'collapse', color: 'var(--text-primary)', fontSize: 'var(--fs-table)' }}>
      <thead>
        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
          <th style={stileTh}>{t('colonnaStrumento')}</th>
          <th style={stileTh}>{t('colonnaCategoria')}</th>
          <th style={stileTh}>{t('colonnaValore')}</th>
          <th style={stileTh} />
        </tr>
      </thead>
      <tbody>
        {strumenti.length === 0 && (
          <tr>
            <td colSpan={4} style={{ padding: 8, color: 'var(--text-secondary)' }}>
              {tTabella('alertNessunDato')}
            </td>
          </tr>
        )}
        {strumenti.map((s) => (
          <tr key={s.id} className="tabella-riga">
            <td style={{ padding: 8 }}>
              {/* RippleLink è un inline-block con overflow nascosto: da solo si
                  allinea al ticker col bordo inferiore, non con il testo. */}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <RippleLink href={`/asset/${s.id}`} className="link-dettaglio">
                  {s.nome}
                </RippleLink>
                {s.ticker && <span style={{ color: 'var(--text-secondary)' }}>({s.ticker})</span>}
              </span>
            </td>
            <td style={{ padding: 8 }}>{traduciCategoria(tCategorie, s.categoria)}</td>
            <td style={{ padding: 8 }}>{formatEuro(s.valore, locale)}</td>
            <td style={{ padding: '8px 8px 8px 24px' }}>
              <form action={azione}>
                <input type="hidden" name="contenitore_id" value={contenitoreId} />
                <input type="hidden" name="strumento_id" value={s.id} />
                <button type="submit" style={stileBottone}>
                  {etichettaBottone}
                </button>
              </form>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Stessi campi del filtro delle tabelle posizioni: nome, ticker e ISIN.
function filtraPerPosizione(strumenti: StrumentoSelezionabile[], ricerca: string): StrumentoSelezionabile[] {
  const testo = ricerca.trim().toLowerCase()
  if (!testo) return strumenti
  return strumenti.filter((s) =>
    [s.nome, s.ticker, s.isin].some((v) => (v ?? '').toLowerCase().includes(testo))
  )
}

export function ElencoMembri({
  contenitoreId,
  membri,
  disponibili,
}: {
  contenitoreId: string
  membri: StrumentoSelezionabile[]
  disponibili: StrumentoSelezionabile[]
}) {
  const t = useTranslations('PaginaMembriGruppo')
  const tFiltro = useTranslations('FiltroTabellaStorico')
  const [ricercaMembri, setRicercaMembri] = useState('')
  const [ricercaDisponibili, setRicercaDisponibili] = useState('')

  const membriFiltrati = filtraPerPosizione(membri, ricercaMembri)
  const disponibiliFiltrati = filtraPerPosizione(disponibili, ricercaDisponibili)

  const campoFiltro = (valore: string, aggiorna: (v: string) => void) => (
    <input
      type="text"
      value={valore}
      onChange={(e) => aggiorna(e.target.value)}
      placeholder={tFiltro('placeholderFiltraPosizione')}
      style={{ ...stileCampoFiltro, display: 'block', marginBottom: 12 }}
    />
  )

  return (
    <>
      <section>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginTop: 0, marginBottom: 12 }}>
          {t('titoloMembri', { numero: membri.length })}
        </h2>
        <Sezione>
          {membri.length === 0 ? (
            <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', margin: 0 }}>{t('alertNessunMembro')}</p>
          ) : (
            <>
              {campoFiltro(ricercaMembri, setRicercaMembri)}
              <Tabella
                contenitoreId={contenitoreId}
                strumenti={membriFiltrati}
                azione={rimuoviMembro}
                etichettaBottone={t('bottoneRimuovi')}
              />
            </>
          )}
        </Sezione>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginTop: 0, marginBottom: 12 }}>{t('titoloDisponibili')}</h2>
        <Sezione>
          {disponibili.length === 0 ? (
            <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', margin: 0 }}>{t('alertNessunDisponibile')}</p>
          ) : (
            <>
              {campoFiltro(ricercaDisponibili, setRicercaDisponibili)}
              <Tabella
                contenitoreId={contenitoreId}
                strumenti={disponibiliFiltrati}
                azione={aggiungiMembro}
                etichettaBottone={t('bottoneAggiungi')}
              />
            </>
          )}
        </Sezione>
      </section>
    </>
  )
}
