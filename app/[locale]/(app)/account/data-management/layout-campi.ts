// Costanti di layout condivise tra i form di questa cartella (Nuovo asset e
// Aggiungi contenitore): estratte qui, invece che duplicate in ogni file,
// perché il campo Note — e ora anche Nome — di entrambi i form deve
// restare alla stessa larghezza anche se in futuro uno dei due cambia
// struttura, senza dover ricalcolare a mano in due punti.

export const LARGHEZZA_STANDARD = 160
export const GAP_CAMPI = 12
// Riga di riferimento: 4 campi standard affiancati = 4*160 + 3*12 = 676px.
export const LARGHEZZA_RIGA_QUATTRO_CAMPI = LARGHEZZA_STANDARD * 4 + GAP_CAMPI * 3
// Larghezza di "Nome" quando condivide la riga con altri due campi standard
// (Categoria+Tipo nel form asset, Tipo+Data nel form contenitore): in
// entrambi i casi il bordo destro della riga deve allinearsi ai 676px di
// riferimento, quindi la formula — e il risultato, 332px — sono identici.
export const LARGHEZZA_NOME = LARGHEZZA_RIGA_QUATTRO_CAMPI - (LARGHEZZA_STANDARD * 2 + GAP_CAMPI * 2)
