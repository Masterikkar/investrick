// Sezione del contenuto di una tab: titolo in grassetto, divisore sottile, righe sotto.
export function SezioneImpostazioni({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: 'var(--bg-section)',
        border: '1px solid var(--border-section)',
        borderRadius: 0,
      }}
    >
      <h2
        style={{
          fontSize: 'var(--fs-h2)',
          fontWeight: 600,
          margin: 0,
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        {titolo}
      </h2>
      <div style={{ padding: 18 }}>{children}</div>
    </section>
  )
}
