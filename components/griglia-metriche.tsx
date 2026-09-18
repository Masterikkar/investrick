// Griglia a colonne fisse per gruppi di card-metrica: a differenza di un
// flex-wrap con minWidth (che cambia numero di colonne ad ogni pixel di
// ridimensionamento, causando un'altezza naturale instabile), qui il numero
// di colonne cambia solo a soglie precise — l'altezza resta prevedibile per
// tutto l'intervallo "normale" di finestra desktop.
export function GrigliaMetriche({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        .griglia-metriche {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        @media (max-width: 900px) {
          .griglia-metriche {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 480px) {
          .griglia-metriche {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      <div className="griglia-metriche">{children}</div>
    </>
  )
}