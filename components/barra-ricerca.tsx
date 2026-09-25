'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { RippleLink } from '@/components/ripple-link'
import { traduciCategoria } from '@/lib/i18n-categorie'

type Strumento = { id: string; nome: string; categoria: string; ticker: string | null }
type Contenitore = { id: string; nome: string; tipo: string }

type Risultato = {
  key: string
  label: string
  sottotitolo: string
  href: string
}

// Dove porta un gruppo trovato: la pagina elenco del suo tipo, o per un
// Personalizzato la gestione dei suoi membri (che non ha ancora un dettaglio).
function hrefGruppo(c: { id: string; tipo: string }): string {
  if (c.tipo === 'PAC') return '/pac'
  if (c.tipo === 'Polizza') return '/polizze'
  if (c.tipo === 'Personalizzato') return `/personalizzati/${c.id}/membri`
  return '/'
}

export function BarraRicerca({
  strumenti,
  contenitori,
}: {
  strumenti: Strumento[]
  contenitori: Contenitore[]
}) {
  const t = useTranslations('BarraRicerca')
  const tCategorie = useTranslations('Categorie')
  const tPaginaContenitore = useTranslations('PaginaContenitore')
  const [query, setQuery] = useState('')
  const [aperto, setAperto] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setAperto(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  // Stesse etichette del tipo di gruppo usate in Gestione strumenti.
  function etichettaTipo(tipo: string): string {
    if (tipo === 'Polizza') return tPaginaContenitore('etichettaPolizza')
    if (tipo === 'Personalizzato') return tPaginaContenitore('etichettaPersonalizzato')
    return tipo
  }

  const testo = query.trim().toLowerCase()

  const risultati: Risultato[] = testo
    ? [
        ...strumenti
          .filter(
            (s) =>
              s.nome.toLowerCase().includes(testo) || (s.ticker ?? '').toLowerCase().includes(testo)
          )
          .map((s) => ({
            key: `asset-${s.id}`,
            label: s.nome,
            sottotitolo: t('sottotitoloAsset', { categoria: traduciCategoria(tCategorie, s.categoria) }),
            href: `/asset/${s.id}`,
          })),
        ...contenitori
          .filter((c) => c.nome.toLowerCase().includes(testo))
          .map((c) => ({
            key: `contenitore-${c.id}`,
            label: c.nome,
            sottotitolo: t('sottotitoloGruppo', { tipo: etichettaTipo(c.tipo) }),
            href: hrefGruppo(c),
          })),
      ].slice(0, 8)
    : []

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        placeholder={t('placeholder')}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setAperto(true)
        }}
        onFocus={() => setAperto(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setAperto(false)
        }}
        style={{
          padding: '6px 10px',
          border: '1px solid var(--border-default)',
          borderRadius: 0,
          width: 220,
          fontSize: 'var(--fs-search)',
          background: 'var(--bg-surface)',
          color: 'var(--text-primary)',
        }}
      />

      {aperto && testo && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 0,
            minWidth: 260,
            maxHeight: 320,
            overflowY: 'auto',
            zIndex: 20,
            color: 'var(--text-primary)',
          }}
        >
          {risultati.length === 0 ? (
            <div style={{ padding: 12, color: 'var(--text-secondary)', fontSize: 'var(--fs-search)' }}>Nessun risultato.</div>
          ) : (
            risultati.map((r) => (
              <RippleLink
                key={r.key}
                href={r.href}
                className="riga-interattiva"
                onClick={() => {
                  setAperto(false)
                  setQuery('')
                }}
                style={{
                  display: 'block',
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--border-default)',
                }}
              >
                <div style={{ fontSize: 'var(--fs-search)' }}>{r.label}</div>
                <div style={{ fontSize: 'var(--fs-search-sub)', color: 'var(--text-secondary)' }}>{r.sottotitolo}</div>
              </RippleLink>
            ))
          )}
        </div>
      )}
    </div>
  )
}