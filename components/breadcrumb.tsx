'use client'

import { useRouter } from 'next/navigation'

export function Breadcrumb() {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="link-dettaglio"
      style={{
        fontSize: 'var(--fs-card-link)',
        fontFamily: 'inherit',
        lineHeight: 'inherit',
        display: 'inline-block',
        background: 'none',
        border: 'none',
        margin: 0,
        padding: 0,
        cursor: 'pointer',
        appearance: 'none',
        WebkitAppearance: 'none',
      }}
    >
      ← Indietro
    </button>
  )
}