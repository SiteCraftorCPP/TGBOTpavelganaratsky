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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          client_id: string
          created_at: string
          id: string
          reminder_1h_sent: boolean
          reminder_24h_sent: boolean
          slot_id: string
          status: Database["public"]["Enums"]["booking_status"]
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          reminder_1h_sent?: boolean
          reminder_24h_sent?: boolean
          slot_id: string
          status?: Database["public"]["Enums"]["booking_status"]
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          reminder_1h_sent?: boolean
          reminder_24h_sent?: boolean
          slot_id?: string
          status?: Database["public"]["Enums"]["booking_status"]
        }
        Relationships: [
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "slots"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          telegram_id: number
          username: string | null
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          telegram_id: number
          username?: string | null
        }
        Update: {
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          telegram_id?: number
          username?: string | null
        }
        Relationships: []
      }
      diary_entries: {
        Row: {
          client_id: string
          created_at: string
          id: string
          text: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          text: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "diary_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          client_id: string
          created_at: string
          id: string
          screenshot_url: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          screenshot_url: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          screenshot_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      slots: {
        Row: {
          available_formats: string
          client_id: string | null
          comment: string | null
          created_at: string
          date: string
          format: string | null
          id: string
          status: Database["public"]["Enums"]["slot_status"]
          time: string
          updated_at: string
        }
        Insert: {
          available_formats?: string
          client_id?: string | null
          comment?: string | null
          created_at?: string
          date: string
          format?: string | null
          id?: string
          status?: Database["public"]["Enums"]["slot_status"]
          time: string
          updated_at?: string
        }
        Update: {
          available_formats?: string
          client_id?: string | null
          comment?: string | null
          created_at?: string
          date?: string
          format?: string | null
          id?: string
          status?: Database["public"]["Enums"]["slot_status"]
          time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      sos_requests: {
        Row: {
          client_id: string
          created_at: string
          id: string
          status: Database["public"]["Enums"]["sos_status"]
          text: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["sos_status"]
          text?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["sos_status"]
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sos_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      booking_status: "active" | "canceled" | "completed"
      slot_status: "free" | "booked"
      sos_status: "new" | "viewed"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      booking_status: ["active", "canceled", "completed"],
      slot_status: ["free", "booked"],
      sos_status: ["new", "viewed"],
    },
  },
} as const
