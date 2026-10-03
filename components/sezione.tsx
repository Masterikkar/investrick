export function Sezione({
  children,
  chiara = false,
}: {
  children: React.ReactNode
  // true nei popup dal corpo scurito (es. OverlayRisultatoSimulazione, che
  // usa --bg-section per il proprio sfondo): la sezione deve risultare più
  // chiara del contenitore che la ospita, non più scura come nel resto
  // dell'app, dove vale l'ordine opposto (--bg-base < --bg-section <
  // --bg-surface).
  chiara?: boolean
}) {
  return (
    <div
      style={{
        background: chiara ? 'var(--bg-surface)' : 'var(--bg-section)',
        border: '1px solid var(--border-section)',
        padding: 18,
      }}
    >
      {children}
    </div>
  )
}