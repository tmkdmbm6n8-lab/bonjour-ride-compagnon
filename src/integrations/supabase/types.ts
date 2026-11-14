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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          resolved_at: string | null
          status: string
          topic: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          resolved_at?: string | null
          status?: string
          topic: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          resolved_at?: string | null
          status?: string
          topic?: string
        }
        Relationships: []
      }
      driver_documents: {
        Row: {
          doc_type: string
          document_number: string
          file_name: string
          file_path: string
          id: string
          reference_date: string | null
          rejection_reason: string
          reviewed_at: string | null
          status: string
          uploaded_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          doc_type: string
          document_number?: string
          file_name?: string
          file_path: string
          id?: string
          reference_date?: string | null
          rejection_reason?: string
          reviewed_at?: string | null
          status?: string
          uploaded_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          doc_type?: string
          document_number?: string
          file_name?: string
          file_path?: string
          id?: string
          reference_date?: string | null
          rejection_reason?: string
          reviewed_at?: string | null
          status?: string
          uploaded_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          id: string
          is_approved: boolean
          is_online: boolean
          is_priority: boolean
          location: Json | null
          payout: Json
          stats: Json
          updated_at: string
          user_id: string
          vehicle: Json
        }
        Insert: {
          id?: string
          is_approved?: boolean
          is_online?: boolean
          is_priority?: boolean
          location?: Json | null
          payout?: Json
          stats?: Json
          updated_at?: string
          user_id: string
          vehicle?: Json
        }
        Update: {
          id?: string
          is_approved?: boolean
          is_online?: boolean
          is_priority?: boolean
          location?: Json | null
          payout?: Json
          stats?: Json
          updated_at?: string
          user_id?: string
          vehicle?: Json
        }
        Relationships: [
          {
            foreignKeyName: "drivers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      imported_identities: {
        Row: {
          email: string
          mapped_user_id: string | null
          original_id: string
          profile: Json
        }
        Insert: {
          email: string
          mapped_user_id?: string | null
          original_id: string
          profile: Json
        }
        Update: {
          email?: string
          mapped_user_id?: string | null
          original_id?: string
          profile?: Json
        }
        Relationships: [
          {
            foreignKeyName: "imported_identities_mapped_user_id_fkey"
            columns: ["mapped_user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          city: string
          is_active: boolean
          rule: Json
          vehicle_type: string
        }
        Insert: {
          city?: string
          is_active?: boolean
          rule: Json
          vehicle_type: string
        }
        Update: {
          city?: string
          is_active?: boolean
          rule?: Json
          vehicle_type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar: string
          balance: number
          created_at: string
          id: string
          name: string
          original_id: string | null
          phone: string
          rating: Json
          username: string
        }
        Insert: {
          avatar?: string
          balance?: number
          created_at?: string
          id: string
          name?: string
          original_id?: string | null
          phone?: string
          rating?: Json
          username?: string
        }
        Update: {
          avatar?: string
          balance?: number
          created_at?: string
          id?: string
          name?: string
          original_id?: string | null
          phone?: string
          rating?: Json
          username?: string
        }
        Relationships: []
      }
      rides: {
        Row: {
          accepted_at: string | null
          arrived_at: string | null
          completed_at: string | null
          created_at: string
          declined: string[]
          dispatch_phase: string | null
          driver_id: string | null
          dropoff: Json
          fare: Json
          id: string
          messages: Json
          offer_driver_id: string | null
          offer_expires_at: string | null
          original_id: string | null
          payment: Json
          pickup: Json
          pin: string
          rating: Json
          rider_id: string
          route: Json
          status: string
          vehicle_type: string
        }
        Insert: {
          accepted_at?: string | null
          arrived_at?: string | null
          completed_at?: string | null
          created_at?: string
          declined?: string[]
          dispatch_phase?: string | null
          driver_id?: string | null
          dropoff: Json
          fare: Json
          id?: string
          messages?: Json
          offer_driver_id?: string | null
          offer_expires_at?: string | null
          original_id?: string | null
          payment?: Json
          pickup: Json
          pin: string
          rating?: Json
          rider_id: string
          route: Json
          status?: string
          vehicle_type: string
        }
        Update: {
          accepted_at?: string | null
          arrived_at?: string | null
          completed_at?: string | null
          created_at?: string
          declined?: string[]
          dispatch_phase?: string | null
          driver_id?: string | null
          dropoff?: Json
          fare?: Json
          id?: string
          messages?: Json
          offer_driver_id?: string | null
          offer_expires_at?: string | null
          original_id?: string | null
          payment?: Json
          pickup?: Json
          pin?: string
          rating?: Json
          rider_id?: string
          route?: Json
          status?: string
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "rides_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          role: string
          user_id: string
        }
        Insert: {
          role: string
          user_id: string
        }
        Update: {
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          note: string
          provider_id: string | null
          ride_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          note?: string
          provider_id?: string | null
          ride_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          note?: string
          provider_id?: string | null
          ride_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decline_ride_offer: {
        Args: { _driver: string; _ride: string }
        Returns: undefined
      }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      purge_expired_personal_data: { Args: never; Returns: undefined }
      settle_ride: { Args: { _actor: string; _id: string }; Returns: Json }
      wallet_entry: {
        Args: {
          _amount: number
          _provider?: string
          _ride?: string
          _type: string
          _user: string
        }
        Returns: number
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
