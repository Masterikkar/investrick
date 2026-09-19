'use client'

import { useEffect, useRef, useState } from 'react'

export type OpzioneMenuSelect = { value: string; label: string }

export function MenuSelect({
  value,
  onChange,
  options,
  placeholder = 'Seleziona...',
  name,
  disabled = false,
}: {
  value: string
  onChange: (valore: string) => void
  options: OpzioneMenuSelect[]
  placeholder?: string
  name?: string
  disabled?: boolean
}) {
  const [aperto, setAperto] = useState(false)
  const [focus, setFocus] = useState(false)
  const contenitoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aperto) return
    function handleClickFuori(e: MouseEvent) {
      if (contenitoreRef.current && !contenitoreRef.current.contains(e.target as Node)) {
        setAperto(false)
      }
    }
    document.addEventListener('mousedown', handleClickFuori)
    return () => document.removeEventListener('mousedown', handleClickFuori)
  }, [aperto])

  const etichettaSelezionata = options.find((o) => o.value === value)?.label ?? placeholder

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setAperto((a) => !a)
    } else if (e.key === 'Escape') {
      setAperto(false)
    } else if (e.key === 'ArrowDown' && !aperto) {
      e.preventDefault()
      setAperto(true)
    }
  }

  return (
    <div ref={contenitoreRef} style={{ position: 'relative' }}>
      {name && <input type="hidden" name={name} value={value} />}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setAperto((a) => !a)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          background: 'var(--bg-surface)',
          color: value ? 'var(--text-primary)' : 'var(--text-secondary)',
          border: `1px solid ${focus ? 'var(--primary-vivid)' : 'var(--border-default)'}`,
          fontFamily: 'inherit',
          fontSize: 'var(--fs-form-label)',
          lineHeight: 'inherit',
          margin: 0,
          appearance: 'none',
          WebkitAppearance: 'none',
          textAlign: 'left',
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          boxShadow: focus ? '0 0 0 3px rgba(124, 140, 255, 0.25)' : 'none',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{etichettaSelezionata}</span>
        <span style={{ color: 'var(--text-secondary)', fontSize: 11, flexShrink: 0 }}>▾</span>
      </button>

      {aperto && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            zIndex: 20,
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {options.map((o) => {
            const selezionata = o.value === value
            return (
              <div
                key={o.value}
                onClick={() => {
                  onChange(o.value)
                  setAperto(false)
                }}
                style={{
                  padding: '9px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 'var(--fs-form-label)',
                  color: 'var(--text-primary)',
                  background: selezionata ? 'var(--border-default)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <span>{o.label}</span>
                {selezionata && <span style={{ color: 'var(--primary-vivid)' }}>✓</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}