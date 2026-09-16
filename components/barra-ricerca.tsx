'use client'

import { useEffect, useRef, useState } from 'react'
import { RippleLink } from '@/components/ripple-link'

type Strumento = { id: string; nome: string; categoria: string; ticker: string | null }
type Contenitore = { id: string; nome: string; tipo: string }

type Risultato = {
  key: string
  label: string
  sottotitolo: string
  href: string
}

const ROUTE_PER_TIPO_CONTENITORE: Record<string, string> = {
  PAC: '/pac',
  Polizza: '/polizze',
  Liquidita: '/liquidita',
}

export function BarraRicerca({
  strumenti,
  contenitori,
}: {
  strumenti: Strumento[]
  contenitori: Contenitore[]
}) {
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
            sottotitolo: `Asset · ${s.categoria}`,
            href: `/asset/${s.id}`,
          })),
        ...contenitori
          .filter((c) => c.nome.toLowerCase().includes(testo))
          .map((c) => ({
            key: `contenitore-${c.id}`,
            label: c.nome,
            sottotitolo: `Contenitore · ${c.tipo}`,
            href: ROUTE_PER_TIPO_CONTENITORE[c.tipo] ?? '/',
          })),
      ].slice(0, 8)
    : []

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        placeholder="Cerca asset o contenitori..."
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
          fontSize: 14,
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
            <div style={{ padding: 12, color: 'var(--text-secondary)', fontSize: 14 }}>Nessun risultato.</div>
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
                <div style={{ fontSize: 14 }}>{r.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.sottotitolo}</div>
              </RippleLink>
            ))
          )}
        </div>
      )}
    </div>
  )
}