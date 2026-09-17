export function Sezione({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--bg-section)',
        border: '1px solid var(--border-section)',
        padding: 18,
      }}
    >
      {children}
    </div>
  )
}