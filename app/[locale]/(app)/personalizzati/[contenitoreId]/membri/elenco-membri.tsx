'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { formatEuro, type LocaleFormato } from '@/lib/format'
import { traduciCategoria } from '@/lib/i18n-categorie'
import { RippleLink } from '@/components/ripple-link'
import { aggiungiMembro, rimuoviMembro } from './actions'

export type StrumentoSelezionabile = {
  id: string
  nome: string
  ticker: string | null
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
  const locale = useLocale() as LocaleFormato

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)', fontSize: 'var(--fs-table)' }}>
      <thead>
        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
          <th style={stileTh}>{t('colonnaStrumento')}</th>
          <th style={stileTh}>{t('colonnaCategoria')}</th>
          <th style={stileTh}>{t('colonnaValore')}</th>
          <th style={stileTh} />
        </tr>
      </thead>
      <tbody>
        {strumenti.map((s) => (
          <tr key={s.id} className="tabella-riga">
            <td style={{ padding: 8 }}>
              <RippleLink href={`/asset/${s.id}`} className="link-dettaglio">
                {s.nome}
              </RippleLink>
              {s.ticker && <span style={{ color: 'var(--text-secondary)' }}> ({s.ticker})</span>}
            </td>
            <td style={{ padding: 8 }}>{traduciCategoria(tCategorie, s.categoria)}</td>
            <td style={{ padding: 8 }}>{formatEuro(s.valore, locale)}</td>
            <td style={{ padding: 8, textAlign: 'right' }}>
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
  const [ricerca, setRicerca] = useState('')

  const filtro = ricerca.trim().toLowerCase()
  const disponibiliFiltrati = filtro
    ? disponibili.filter((s) => s.nome.toLowerCase().includes(filtro) || (s.ticker ?? '').toLowerCase().includes(filtro))
    : disponibili

  return (
    <>
      <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginTop: 0, marginBottom: 12 }}>
        {t('titoloMembri', { numero: membri.length })}
      </h2>
      {membri.length === 0 ? (
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', margin: 0 }}>{t('alertNessunMembro')}</p>
      ) : (
        <Tabella contenitoreId={contenitoreId} strumenti={membri} azione={rimuoviMembro} etichettaBottone={t('bottoneRimuovi')} />
      )}

      <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginTop: 40, marginBottom: 12 }}>{t('titoloDisponibili')}</h2>
      {disponibili.length === 0 ? (
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', margin: 0 }}>{t('alertNessunDisponibile')}</p>
      ) : (
        <>
          <input
            type="search"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            placeholder={t('placeholderCerca')}
            style={{
              display: 'block',
              width: '100%',
              maxWidth: 360,
              marginBottom: 12,
              padding: '6px 10px',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              fontSize: 'var(--fs-form-label)',
            }}
          />
          <Tabella
            contenitoreId={contenitoreId}
            strumenti={disponibiliFiltrati}
            azione={aggiungiMembro}
            etichettaBottone={t('bottoneAggiungi')}
          />
        </>
      )}
    </>
  )
}
