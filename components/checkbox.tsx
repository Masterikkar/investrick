'use client'

import { IconaSpunta } from '@/components/icone'

// Checkbox personalizzata, stessa filosofia di MenuSelect: un input reale
// (accessibile, gestibile da tastiera) nascosto sotto un riquadro disegnato
// da noi, invece dell'aspetto di default del browser. L'input nativo resta
// nel DOM — solo invisibile — così label/focus/screen reader funzionano
// come con una checkbox normale.
export function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean
  onChange: (valore: boolean) => void
  label?: React.ReactNode
  disabled?: boolean
}) {
  return (
    <label
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        userSelect: 'none',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, width: 18, height: 18, margin: 0, cursor: disabled ? 'default' : 'pointer' }}
      />
      <span
        style={{
          width: 18,
          height: 18,
          flexShrink: 0,
          border: `1.5px solid ${checked ? 'var(--primary)' : 'var(--border-default)'}`,
          background: checked ? 'var(--primary)' : 'var(--bg-surface)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked && <IconaSpunta />}
      </span>
      {label !== undefined && <span style={{ fontSize: 'var(--fs-form-label)', color: 'var(--text-primary)' }}>{label}</span>}
    </label>
  )
}
