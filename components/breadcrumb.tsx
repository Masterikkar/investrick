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
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
      }}
    >
      ← Indietro
    </button>
  )
}