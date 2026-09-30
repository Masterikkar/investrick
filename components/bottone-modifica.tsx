'use client'

import { IconaModifica } from '@/components/icone'

// Pulsante matita della colonna Azioni degli storici (transazioni e movimenti
// di liquidità): stesso aspetto, condiviso in un solo punto.
export function BottoneModifica({
  onClick,
  disabled = false,
  titolo,
}: {
  onClick: () => void
  disabled?: boolean
  titolo: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={titolo}
      aria-label={titolo}
      style={{
        border: 'none',
        background: 'none',
        cursor: disabled ? 'default' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 4px',
        color: 'var(--text-secondary)',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <IconaModifica />
    </button>
  )
}
