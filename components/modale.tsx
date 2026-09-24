'use client'

import { useEffect } from 'react'

export function Modale({
  aperto,
  onChiudi,
  titolo,
  children,
  mostraChiusura = true,
}: {
  aperto: boolean
  onChiudi: () => void
  titolo: string
  children: React.ReactNode
  // La × in alto a destra. false solo quando il contenuto ha già un suo
  // pulsante per annullare (es. il dialogo di conferma); Esc e clic fuori
  // chiudono comunque.
  mostraChiusura?: boolean
}) {
  useEffect(() => {
    if (!aperto) return

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onChiudi()
    }
    document.addEventListener('keydown', handleKey)
    const overflowPrecedente = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = overflowPrecedente
    }
  }, [aperto, onChiudi])

  if (!aperto) return null

  return (
    <div
      onClick={onChiudi}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10, 13, 22, 0.75)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '48px 24px',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-section)',
          border: '1px solid var(--border-section)',
          width: '100%',
          maxWidth: 480,
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, margin: 0 }}>{titolo}</h2>
          {mostraChiusura && (
            <button
              type="button"
              onClick={onChiudi}
              aria-label="Chiudi"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: 20,
                lineHeight: 1,
                cursor: 'pointer',
                padding: 4,
              }}
            >
              ×
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}