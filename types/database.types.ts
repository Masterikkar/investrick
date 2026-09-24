export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      contenitori: {
        Row: {
          created_at: string
          data_attivazione: string | null
          id: string
          nome: string
          note: string | null
          target_attivo: boolean
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_attivazione?: string | null
          id?: string
          nome: string
          note?: string | null
          target_attivo?: boolean
          tipo: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          data_attivazione?: string | null
          id?: string
          nome?: string
          note?: string | null
          target_attivo?: boolean
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fonti_prezzo_scraping: {
        Row: {
          created_at: string
          id: string
          strumento_id: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          strumento_id: string
          url: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          strumento_id?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fonti_prezzo_scraping_strumento_id_fkey"
            columns: ["strumento_id"]
            isOneToOne: false
            referencedRelation: "strumenti"
            referencedColumns: ["id"]
          },
        ]
      }
      importazioni: {
        Row: {
          categoria: string
          created_at: string
          data_caricamento: string
          dettaglio_errori: Json | null
          id: string
          nome_file: string
          righe_errore: number | null
          righe_importate: number | null
          righe_totali: number | null
          stato: string
          storage_path: string | null
          user_id: string
        }
        Insert: {
          categoria: string
          created_at?: string
          data_caricamento?: string
          dettaglio_errori?: Json | null
          id?: string
          nome_file: string
          righe_errore?: number | null
          righe_importate?: number | null
          righe_totali?: number | null
          stato?: string
          storage_path?: string | null
          user_id?: string
        }
        Update: {
          categoria?: string
          created_at?: string
          data_caricamento?: string
          dettaglio_errori?: Json | null
          id?: string
          nome_file?: string
          righe_errore?: number | null
          righe_importate?: number | null
          righe_totali?: number | null
          stato?: string
          storage_path?: string | null
          user_id?: string
        }
        Relationships: []
      }
      impostazioni_aliquote_categoria: {
        Row: {
          aliquota_default: number
          categoria: string
          user_id: string
        }
        Insert: {
          aliquota_default: number
          categoria: string
          user_id?: string
        }
        Update: {
          aliquota_default?: number
          categoria?: string
          user_id?: string
        }
        Relationships: []
      }
      impostazioni_utente: {
        Row: {
          created_at: string
          soglia_ribilanciamento_pp: number
          updated_at: string
          user_id: string
          valuta_base: string
        }
        Insert: {
          created_at?: string
          soglia_ribilanciamento_pp?: number
          updated_at?: string
          user_id?: string
          valuta_base?: string
        }
        Update: {
          created_at?: string
          soglia_ribilanciamento_pp?: number
          updated_at?: string
          user_id?: string
          valuta_base?: string
        }
        Relationships: []
      }
      movimenti_liquidita: {
        Row: {
          contenitore_id: string | null
          created_at: string
          data: string
          id: string
          importazione_id: string | null
          importo: number
          strumento_id: string
          tassa_trattenuta: number
          tipo_movimento: string
          user_id: string
        }
        Insert: {
          contenitore_id?: string | null
          created_at?: string
          data: string
          id?: string
          importazione_id?: string | null
          importo: number
          strumento_id: string
          tassa_trattenuta?: number
          tipo_movimento: string
          user_id?: string
        }
        Update: {
          contenitore_id?: string | null
          created_at?: string
          data?: string
          id?: string
          importazione_id?: string | null
          importo?: number
          strumento_id?: string
          tassa_trattenuta?: number
          tipo_movimento?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimenti_liquidita_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "contenitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimenti_liquidita_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "v_valore_per_contenitore"
            referencedColumns: ["contenitore_id"]
          },
          {
            foreignKeyName: "movimenti_liquidita_importazione_id_fkey"
            columns: ["importazione_id"]
            isOneToOne: false
            referencedRelation: "importazioni"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimenti_liquidita_strumento_id_fkey"
            columns: ["strumento_id"]
            isOneToOne: false
            referencedRelation: "strumenti"
            referencedColumns: ["id"]
          },
        ]
      }
      prezzi_storici: {
        Row: {
          created_at: string
          data: string
          fonte: string
          id: string
          prezzo: number
          strumento_id: string
          valuta: string
        }
        Insert: {
          created_at?: string
          data: string
          fonte?: string
          id?: string
          prezzo: number
          strumento_id: string
          valuta?: string
        }
        Update: {
          created_at?: string
          data?: string
          fonte?: string
          id?: string
          prezzo?: number
          strumento_id?: string
          valuta?: string
        }
        Relationships: [
          {
            foreignKeyName: "prezzi_storici_strumento_id_fkey"
            columns: ["strumento_id"]
            isOneToOne: false
            referencedRelation: "strumenti"
            referencedColumns: ["id"]
          },
        ]
      }
      storico_valorizzazioni: {
        Row: {
          capitale_investito: number | null
          contenitore_chiave: string | null
          contenitore_id: string | null
          created_at: string
          data: string
          id: string
          prezzo: number
          quantita: number
          strumento_id: string
          valore: number | null
        }
        Insert: {
          capitale_investito?: number | null
          contenitore_chiave?: string | null
          contenitore_id?: string | null
          created_at?: string
          data: string
          id?: string
          prezzo: number
          quantita: number
          strumento_id: string
          valore?: number | null
        }
        Update: {
          capitale_investito?: number | null
          contenitore_chiave?: string | null
          contenitore_id?: string | null
          created_at?: string
          data?: string
          id?: string
          prezzo?: number
          quantita?: number
          strumento_id?: string
          valore?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "storico_valorizzazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "contenitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storico_valorizzazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "v_valore_per_contenitore"
            referencedColumns: ["contenitore_id"]
          },
          {
            foreignKeyName: "storico_valorizzazioni_strumento_id_fkey"
            columns: ["strumento_id"]
            isOneToOne: false
            referencedRelation: "strumenti"
            referencedColumns: ["id"]
          },
        ]
      }
      strumenti: {
        Row: {
          aliquota_tassazione: number
          categoria: string
          cedola_percentuale: number | null
          codice_prezzo: string | null
          created_at: string
          data_scadenza: string | null
          frequenza_cedola: string | null
          id: string
          isin: string | null
          nome: string
          note: string | null
          provider: string | null
          tasso_percentuale: number | null
          ticker: string | null
          tipo: string
          updated_at: string
          user_id: string
          valuta: string
        }
        Insert: {
          aliquota_tassazione: number
          categoria: string
          cedola_percentuale?: number | null
          codice_prezzo?: string | null
          created_at?: string
          data_scadenza?: string | null
          frequenza_cedola?: string | null
          id?: string
          isin?: string | null
          nome: string
          note?: string | null
          provider?: string | null
          tasso_percentuale?: number | null
          ticker?: string | null
          tipo: string
          updated_at?: string
          user_id?: string
          valuta?: string
        }
        Update: {
          aliquota_tassazione?: number
          categoria?: string
          cedola_percentuale?: number | null
          codice_prezzo?: string | null
          created_at?: string
          data_scadenza?: string | null
          frequenza_cedola?: string | null
          id?: string
          isin?: string | null
          nome?: string
          note?: string | null
          provider?: string | null
          tasso_percentuale?: number | null
          ticker?: string | null
          tipo?: string
          updated_at?: string
          user_id?: string
          valuta?: string
        }
        Relationships: [
          {
            foreignKeyName: "strumenti_categoria_tipo_fkey"
            columns: ["categoria", "tipo"]
            isOneToOne: false
            referencedRelation: "tipi_strumento"
            referencedColumns: ["categoria", "tipo"]
          },
        ]
      }
      target_allocazioni: {
        Row: {
          attivo: boolean
          categoria: string
          contenitore_id: string | null
          created_at: string
          id: string
          target_percentuale: number
          updated_at: string
          user_id: string
        }
        Insert: {
          attivo?: boolean
          categoria: string
          contenitore_id?: string | null
          created_at?: string
          id?: string
          target_percentuale: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          attivo?: boolean
          categoria?: string
          contenitore_id?: string | null
          created_at?: string
          id?: string
          target_percentuale?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "target_allocazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "contenitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "target_allocazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "v_valore_per_contenitore"
            referencedColumns: ["contenitore_id"]
          },
        ]
      }
      target_allocazioni_strumento: {
        Row: {
          contenitore_id: string
          created_at: string
          id: string
          strumento_id: string
          target_percentuale_categoria: number
          updated_at: string
          user_id: string
        }
        Insert: {
          contenitore_id: string
          created_at?: string
          id?: string
          strumento_id: string
          target_percentuale_categoria: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          contenitore_id?: string
          created_at?: string
          id?: string
          strumento_id?: string
          target_percentuale_categoria?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "target_allocazioni_strumento_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "contenitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "target_allocazioni_strumento_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "v_valore_per_contenitore"
            referencedColumns: ["contenitore_id"]
          },
          {
            foreignKeyName: "target_allocazioni_strumento_strumento_id_fkey"
            columns: ["strumento_id"]
            isOneToOne: false
            referencedRelation: "strumenti"
            referencedColumns: ["id"]
          },
        ]
      }
      tipi_strumento: {
        Row: {
          categoria: string
          tipo: string
        }
        Insert: {
          categoria: string
          tipo: string
        }
        Update: {
          categoria?: string
          tipo?: string
        }
        Relationships: []
      }
      transazioni: {
        Row: {
          categoria: string
          commissione: number
          contenitore_id: string | null
          created_at: string
          data: string
          id: string
          importazione_id: string | null
          operazione: string
          prezzo_unitario: number
          quantita: number
          strumento_id: string | null
          tassa_trattenuta: number
          user_id: string
          valore_totale: number | null
          valuta: string
        }
        Insert: {
          categoria: string
          commissione?: number
          contenitore_id?: string | null
          created_at?: string
          data: string
          id?: string
          importazione_id?: string | null
          operazione: string
          prezzo_unitario: number
          quantita: number
          strumento_id?: string | null
          tassa_trattenuta?: number
          user_id?: string
          valore_totale?: number | null
          valuta?: string
        }
        Update: {
          categoria?: string
          commissione?: number
          contenitore_id?: string | null
          created_at?: string
          data?: string
          id?: string
          importazione_id?: string | null
          operazione?: string
          prezzo_unitario?: number
          quantita?: number
          strumento_id?: string | null
          tassa_trattenuta?: number
          user_id?: string
          valore_totale?: number | null
          valuta?: string
        }
        Relationships: [
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "contenitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "v_valore_per_contenitore"
            referencedColumns: ["contenitore_id"]
          },
          {
            foreignKeyName: "transazioni_importazione_id_fkey"
            columns: ["importazione_id"]
            isOneToOne: false
            referencedRelation: "importazioni"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transazioni_strumento_id_fkey"
            columns: ["strumento_id"]
            isOneToOne: false
            referencedRelation: "strumenti"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_abbinamenti_fifo: {
        Row: {
          acquisto_id: string | null
          commissione_acquisto_quota: number | null
          commissione_vendita_quota: number | null
          contenitore_id: string | null
          data_acquisto: string | null
          data_vendita: string | null
          plusvalenza: number | null
          prezzo_acquisto: number | null
          prezzo_vendita: number | null
          quantita_abbinata: number | null
          strumento_id: string | null
          vendita_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "contenitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "v_valore_per_contenitore"
            referencedColumns: ["contenitore_id"]
          },
          {
            foreignKeyName: "transazioni_strumento_id_fkey"
            columns: ["strumento_id"]
            isOneToOne: false
            referencedRelation: "strumenti"
            referencedColumns: ["id"]
          },
        ]
      }
      v_abbinamenti_fifo_dettaglio: {
        Row: {
          acquisto_id: string | null
          commissione_acquisto_quota: number | null
          commissione_vendita_quota: number | null
          contenitore_id: string | null
          contenitore_tipo: string | null
          data_acquisto: string | null
          data_vendita: string | null
          imponibile: boolean | null
          operazione_vendita: string | null
          plusvalenza: number | null
          prezzo_acquisto: number | null
          prezzo_vendita: number | null
          quantita_abbinata: number | null
          strumento_id: string | null
          vendita_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "contenitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "v_valore_per_contenitore"
            referencedColumns: ["contenitore_id"]
          },
          {
            foreignKeyName: "transazioni_strumento_id_fkey"
            columns: ["strumento_id"]
            isOneToOne: false
            referencedRelation: "strumenti"
            referencedColumns: ["id"]
          },
        ]
      }
      v_capitale_investito: {
        Row: {
          capitale_investito: number | null
          commissioni: number | null
          contenitore_id: string | null
          prezzo_medio_unitario: number | null
          quantita_posseduta: number | null
          strumento_id: string | null
          tasse: number | null
          valore_quote_costo: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "contenitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "v_valore_per_contenitore"
            referencedColumns: ["contenitore_id"]
          },
          {
            foreignKeyName: "transazioni_strumento_id_fkey"
            columns: ["strumento_id"]
            isOneToOne: false
            referencedRelation: "strumenti"
            referencedColumns: ["id"]
          },
        ]
      }
      v_costo_liquidita: {
        Row: {
          contenitore_id: string | null
          costo_totale: number | null
          strumento_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimenti_liquidita_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "contenitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimenti_liquidita_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "v_valore_per_contenitore"
            referencedColumns: ["contenitore_id"]
          },
          {
            foreignKeyName: "movimenti_liquidita_strumento_id_fkey"
            columns: ["strumento_id"]
            isOneToOne: false
            referencedRelation: "strumenti"
            referencedColumns: ["id"]
          },
        ]
      }
      v_costo_per_contenitore: {
        Row: {
          contenitore_id: string | null
          costo_totale: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "contenitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "v_valore_per_contenitore"
            referencedColumns: ["contenitore_id"]
          },
        ]
      }
      v_costo_per_strumento: {
        Row: {
          categoria: string | null
          contenitore_id: string | null
          costo_totale: number | null
          strumento_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "contenitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "v_valore_per_contenitore"
            referencedColumns: ["contenitore_id"]
          },
          {
            foreignKeyName: "transazioni_strumento_id_fkey"
            columns: ["strumento_id"]
            isOneToOne: false
            referencedRelation: "strumenti"
            referencedColumns: ["id"]
          },
        ]
      }
      v_eventi_costo: {
        Row: {
          categoria: string | null
          contenitore_id: string | null
          data: string | null
          importo_costo: number | null
          strumento_id: string | null
          transazione_id: string | null
          user_id: string | null
        }
        Insert: {
          categoria?: string | null
          contenitore_id?: string | null
          data?: string | null
          importo_costo?: never
          strumento_id?: string | null
          transazione_id?: string | null
          user_id?: string | null
        }
        Update: {
          categoria?: string | null
          contenitore_id?: string | null
          data?: string | null
          importo_costo?: never
          strumento_id?: string | null
          transazione_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "contenitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "v_valore_per_contenitore"
            referencedColumns: ["contenitore_id"]
          },
          {
            foreignKeyName: "transazioni_strumento_id_fkey"
            columns: ["strumento_id"]
            isOneToOne: false
            referencedRelation: "strumenti"
            referencedColumns: ["id"]
          },
        ]
      }
      v_interessi_liquidita: {
        Row: {
          contenitore_id: string | null
          interessi_lordi: number | null
          interessi_totali: number | null
          strumento_id: string | null
          tasse_trattenute: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimenti_liquidita_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "contenitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimenti_liquidita_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "v_valore_per_contenitore"
            referencedColumns: ["contenitore_id"]
          },
          {
            foreignKeyName: "movimenti_liquidita_strumento_id_fkey"
            columns: ["strumento_id"]
            isOneToOne: false
            referencedRelation: "strumenti"
            referencedColumns: ["id"]
          },
        ]
      }
      v_lotti_residui: {
        Row: {
          acquisto_id: string | null
          commissione_residua: number | null
          contenitore_id: string | null
          data_acquisto: string | null
          prezzo_acquisto: number | null
          quantita_residua: number | null
          strumento_id: string | null
          tassa_residua: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "contenitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "v_valore_per_contenitore"
            referencedColumns: ["contenitore_id"]
          },
          {
            foreignKeyName: "transazioni_strumento_id_fkey"
            columns: ["strumento_id"]
            isOneToOne: false
            referencedRelation: "strumenti"
            referencedColumns: ["id"]
          },
        ]
      }
      v_non_realizzato_dettaglio: {
        Row: {
          capitale_investito: number | null
          categoria: string | null
          contenitore_id: string | null
          contenitore_tipo: string | null
          strumento_id: string | null
          valore: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "contenitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "v_valore_per_contenitore"
            referencedColumns: ["contenitore_id"]
          },
          {
            foreignKeyName: "transazioni_strumento_id_fkey"
            columns: ["strumento_id"]
            isOneToOne: false
            referencedRelation: "strumenti"
            referencedColumns: ["id"]
          },
        ]
      }
      v_non_realizzato_inizio_anno: {
        Row: {
          capitale_investito: number | null
          categoria: string | null
          contenitore_id: string | null
          contenitore_tipo: string | null
          strumento_id: string | null
          valore: number | null
        }
        Relationships: [
          {
            foreignKeyName: "storico_valorizzazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "contenitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storico_valorizzazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "v_valore_per_contenitore"
            referencedColumns: ["contenitore_id"]
          },
          {
            foreignKeyName: "storico_valorizzazioni_strumento_id_fkey"
            columns: ["strumento_id"]
            isOneToOne: false
            referencedRelation: "strumenti"
            referencedColumns: ["id"]
          },
        ]
      }
      v_plusvalenze_realizzate: {
        Row: {
          anno: number | null
          contenitore_id: string | null
          plusvalenza_esente_polizza: number | null
          plusvalenza_imponibile: number | null
          strumento_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "contenitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "v_valore_per_contenitore"
            referencedColumns: ["contenitore_id"]
          },
          {
            foreignKeyName: "transazioni_strumento_id_fkey"
            columns: ["strumento_id"]
            isOneToOne: false
            referencedRelation: "strumenti"
            referencedColumns: ["id"]
          },
        ]
      }
      v_posizioni_correnti: {
        Row: {
          categoria: string | null
          contenitore_id: string | null
          quantita_corrente: number | null
          strumento_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "contenitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "v_valore_per_contenitore"
            referencedColumns: ["contenitore_id"]
          },
          {
            foreignKeyName: "transazioni_strumento_id_fkey"
            columns: ["strumento_id"]
            isOneToOne: false
            referencedRelation: "strumenti"
            referencedColumns: ["id"]
          },
        ]
      }
      v_prezzo_attuale: {
        Row: {
          data: string | null
          prezzo: number | null
          strumento_id: string | null
          valuta: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prezzi_storici_strumento_id_fkey"
            columns: ["strumento_id"]
            isOneToOne: false
            referencedRelation: "strumenti"
            referencedColumns: ["id"]
          },
        ]
      }
      v_realizzato_per_anno: {
        Row: {
          anno: number | null
          imponibile_dividendi: number | null
          imponibile_vendite: number | null
          netto_dividendi: number | null
          netto_switch_polizze: number | null
          netto_vendite: number | null
          realizzato_netto_totale: number | null
          tasse_dividendi: number | null
          tasse_totali: number | null
          tasse_vendite: number | null
        }
        Relationships: []
      }
      v_ricavi_da_vendite: {
        Row: {
          contenitore_id: string | null
          netto_dopo_tasse_stimato: number | null
          plusvalenza_totale: number | null
          quantita_venduta: number | null
          ricavo_totale: number | null
          strumento_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "contenitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "v_valore_per_contenitore"
            referencedColumns: ["contenitore_id"]
          },
          {
            foreignKeyName: "transazioni_strumento_id_fkey"
            columns: ["strumento_id"]
            isOneToOne: false
            referencedRelation: "strumenti"
            referencedColumns: ["id"]
          },
        ]
      }
      v_riepilogo_posizione: {
        Row: {
          capitale_investito: number | null
          contenitore_id: string | null
          prezzo_attuale: number | null
          prezzo_medio_unitario: number | null
          quantita_posseduta: number | null
          rendimento_pct: number | null
          strumento_id: string | null
          valore: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "contenitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "v_valore_per_contenitore"
            referencedColumns: ["contenitore_id"]
          },
          {
            foreignKeyName: "transazioni_strumento_id_fkey"
            columns: ["strumento_id"]
            isOneToOne: false
            referencedRelation: "strumenti"
            referencedColumns: ["id"]
          },
        ]
      }
      v_saldo_liquidita: {
        Row: {
          contenitore_id: string | null
          saldo_corrente: number | null
          strumento_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimenti_liquidita_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "contenitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimenti_liquidita_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "v_valore_per_contenitore"
            referencedColumns: ["contenitore_id"]
          },
          {
            foreignKeyName: "movimenti_liquidita_strumento_id_fkey"
            columns: ["strumento_id"]
            isOneToOne: false
            referencedRelation: "strumenti"
            referencedColumns: ["id"]
          },
        ]
      }
      v_scostamento_target: {
        Row: {
          categoria: string | null
          contenitore_id: string | null
          contenitore_nome: string | null
          contenitore_tipo: string | null
          peso_attuale_pct: number | null
          scostamento_pp: number | null
          target_id: string | null
          target_percentuale: number | null
          user_id: string | null
          valore_categoria: number | null
          valore_contenitore_totale: number | null
        }
        Relationships: [
          {
            foreignKeyName: "target_allocazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "contenitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "target_allocazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "v_valore_per_contenitore"
            referencedColumns: ["contenitore_id"]
          },
        ]
      }
      v_storico_valorizzazioni_dettaglio: {
        Row: {
          capitale_investito: number | null
          categoria: string | null
          contenitore_id: string | null
          contenitore_tipo: string | null
          data: string | null
          strumento_id: string | null
          valore: number | null
        }
        Relationships: [
          {
            foreignKeyName: "storico_valorizzazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "contenitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storico_valorizzazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "v_valore_per_contenitore"
            referencedColumns: ["contenitore_id"]
          },
          {
            foreignKeyName: "storico_valorizzazioni_strumento_id_fkey"
            columns: ["strumento_id"]
            isOneToOne: false
            referencedRelation: "strumenti"
            referencedColumns: ["id"]
          },
        ]
      }
      v_storico_valorizzazioni_per_categoria: {
        Row: {
          capitale_investito_totale: number | null
          categoria: string | null
          data: string | null
          valore_totale: number | null
        }
        Relationships: []
      }
      v_storico_valorizzazioni_per_contenitore: {
        Row: {
          capitale_investito_totale: number | null
          contenitore_id: string | null
          data: string | null
          valore_totale: number | null
        }
        Relationships: [
          {
            foreignKeyName: "storico_valorizzazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "contenitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storico_valorizzazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "v_valore_per_contenitore"
            referencedColumns: ["contenitore_id"]
          },
        ]
      }
      v_storico_valorizzazioni_per_strumento: {
        Row: {
          capitale_investito_totale: number | null
          data: string | null
          strumento_id: string | null
          valore_totale: number | null
        }
        Relationships: [
          {
            foreignKeyName: "storico_valorizzazioni_strumento_id_fkey"
            columns: ["strumento_id"]
            isOneToOne: false
            referencedRelation: "strumenti"
            referencedColumns: ["id"]
          },
        ]
      }
      v_storico_valorizzazioni_totale: {
        Row: {
          capitale_investito_totale: number | null
          data: string | null
          valore_totale: number | null
        }
        Relationships: []
      }
      v_tasse_trattenute_annuali: {
        Row: {
          anno: number | null
          tassa_trattenuta_totale: number | null
        }
        Relationships: []
      }
      v_valore_categoria_per_contenitore: {
        Row: {
          categoria: string | null
          contenitore_id: string | null
          user_id: string | null
          valore_categoria: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "contenitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "v_valore_per_contenitore"
            referencedColumns: ["contenitore_id"]
          },
        ]
      }
      v_valore_per_categoria: {
        Row: {
          categoria: string | null
          valore_totale: number | null
        }
        Relationships: []
      }
      v_valore_per_contenitore: {
        Row: {
          contenitore_id: string | null
          nome: string | null
          tipo: string | null
          user_id: string | null
          valore_totale: number | null
        }
        Relationships: []
      }
      v_valore_posizioni_attuale: {
        Row: {
          categoria: string | null
          contenitore_id: string | null
          prezzo_attuale: number | null
          quantita_corrente: number | null
          strumento_id: string | null
          user_id: string | null
          valore_attuale: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "contenitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "v_valore_per_contenitore"
            referencedColumns: ["contenitore_id"]
          },
          {
            foreignKeyName: "transazioni_strumento_id_fkey"
            columns: ["strumento_id"]
            isOneToOne: false
            referencedRelation: "strumenti"
            referencedColumns: ["id"]
          },
        ]
      }
      v_valore_totale_portafoglio: {
        Row: {
          valore_totale: number | null
        }
        Relationships: []
      }
      v_variazione_giornaliera: {
        Row: {
          data: string | null
          prezzo: number | null
          prezzo_precedente: number | null
          strumento_id: string | null
          variazione_pct: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prezzi_storici_strumento_id_fkey"
            columns: ["strumento_id"]
            isOneToOne: false
            referencedRelation: "strumenti"
            referencedColumns: ["id"]
          },
        ]
      }
      v_verifica_trattenute: {
        Row: {
          aliquota_attesa_pct: number | null
          contenitore_id: string | null
          data_vendita: string | null
          differenza: number | null
          plusvalenza_totale_vendita: number | null
          strumento_id: string | null
          tassa_attesa: number | null
          tassa_trattenuta_effettiva: number | null
          vendita_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "contenitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transazioni_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "v_valore_per_contenitore"
            referencedColumns: ["contenitore_id"]
          },
          {
            foreignKeyName: "transazioni_strumento_id_fkey"
            columns: ["strumento_id"]
            isOneToOne: false
            referencedRelation: "strumenti"
            referencedColumns: ["id"]
          },
        ]
      }
      v_verifica_trattenute_interessi: {
        Row: {
          aliquota_attesa_pct: number | null
          contenitore_id: string | null
          data_movimento: string | null
          differenza: number | null
          interesse_lordo: number | null
          movimento_id: string | null
          strumento_id: string | null
          tassa_attesa: number | null
          tassa_trattenuta_effettiva: number | null
        }
        Relationships: [
          {
            foreignKeyName: "movimenti_liquidita_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "contenitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimenti_liquidita_contenitore_id_fkey"
            columns: ["contenitore_id"]
            isOneToOne: false
            referencedRelation: "v_valore_per_contenitore"
            referencedColumns: ["contenitore_id"]
          },
          {
            foreignKeyName: "movimenti_liquidita_strumento_id_fkey"
            columns: ["strumento_id"]
            isOneToOne: false
            referencedRelation: "strumenti"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calcola_fifo_posizione: {
        Args: { p_contenitore_id: string; p_strumento_id: string }
        Returns: {
          acquisto_id: string
          commissione_acquisto_quota: number
          commissione_vendita_quota: number
          data_acquisto: string
          data_vendita: string
          plusvalenza: number
          prezzo_acquisto: number
          prezzo_vendita: number
          quantita_abbinata: number
          vendita_id: string
        }[]
      }
      calcola_lotti_residui_posizione: {
        Args: { p_contenitore_id: string; p_strumento_id: string }
        Returns: {
          acquisto_id: string
          commissione_residua: number
          data_acquisto: string
          prezzo_acquisto: number
          quantita_residua: number
          tassa_residua: number
        }[]
      }
      capitale_investito_a_data: {
        Args: {
          p_contenitore_id: string
          p_data_limite: string
          p_strumento_id: string
        }
        Returns: number
      }
      elimina_strumento: {
        Args: { p_strumento_id: string }
        Returns: {
          movimenti_eliminati: number
          transazioni_eliminate: number
        }[]
      }
      ricostruisci_storico_valorizzazioni: {
        Args: never
        Returns: {
          righe_fantasma_rimosse: number
          righe_liquidita: number
          righe_mercato: number
          righe_orfane_rimosse: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
