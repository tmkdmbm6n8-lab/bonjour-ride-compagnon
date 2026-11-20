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
      card_bookings: {
        Row: {
          created_at: string
          dropoff: Json
          environment: string
          fare: Json
          favorite_driver_id: string | null
          id: string
          pickup: Json
          ride_id: string | null
          rider_id: string
          route: Json
          status: string
          stripe_session_id: string | null
          vehicle_type: string
        }
        Insert: {
          created_at?: string
          dropoff: Json
          environment: string
          fare: Json
          favorite_driver_id?: string | null
          id?: string
          pickup: Json
          ride_id?: string | null
          rider_id: string
          route: Json
          status?: string
          stripe_session_id?: string | null
          vehicle_type: string
        }
        Update: {
          created_at?: string
          dropoff?: Json
          environment?: string
          fare?: Json
          favorite_driver_id?: string | null
          id?: string
          pickup?: Json
          ride_id?: string | null
          rider_id?: string
          route?: Json
          status?: string
          stripe_session_id?: string | null
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_bookings_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_bookings_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      driver_gold_subscriptions: {
        Row: {
          can_manage: boolean
          cancel_at_period_end: boolean
          driver_id: string
          environment: string
          gold_current_period_end: string | null
          gold_status: string
          gold_trial_ends_at: string | null
          revision: number
          stripe_customer_id: string
          stripe_subscription_id: string | null
          trial_used: boolean
        }
        Insert: {
          can_manage?: boolean
          cancel_at_period_end?: boolean
          driver_id: string
          environment: string
          gold_current_period_end?: string | null
          gold_status?: string
          gold_trial_ends_at?: string | null
          revision?: number
          stripe_customer_id: string
          stripe_subscription_id?: string | null
          trial_used?: boolean
        }
        Update: {
          can_manage?: boolean
          cancel_at_period_end?: boolean
          driver_id?: string
          environment?: string
          gold_current_period_end?: string | null
          gold_status?: string
          gold_trial_ends_at?: string | null
          revision?: number
          stripe_customer_id?: string
          stripe_subscription_id?: string | null
          trial_used?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "driver_gold_subscriptions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      driver_invitation_claims: {
        Row: {
          claim_expires_at: string
          claim_token_hash: string
          claimed_at: string
          completed_at: string | null
          driver_id: string
          id: string
          invitation_id: string
          rider_id: string | null
        }
        Insert: {
          claim_expires_at?: string
          claim_token_hash: string
          claimed_at?: string
          completed_at?: string | null
          driver_id: string
          id?: string
          invitation_id: string
          rider_id?: string | null
        }
        Update: {
          claim_expires_at?: string
          claim_token_hash?: string
          claimed_at?: string
          completed_at?: string | null
          driver_id?: string
          id?: string
          invitation_id?: string
          rider_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_invitation_claims_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_invitation_claims_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "driver_private_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_invitation_claims_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_private_invitations: {
        Row: {
          created_at: string
          driver_id: string
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
          used_by_rider_id: string | null
        }
        Insert: {
          created_at?: string
          driver_id: string
          expires_at: string
          id?: string
          token_hash: string
          used_at?: string | null
          used_by_rider_id?: string | null
        }
        Update: {
          created_at?: string
          driver_id?: string
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
          used_by_rider_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_private_invitations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_private_invitations_used_by_rider_id_fkey"
            columns: ["used_by_rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          accepts_classes: string[]
          documents_override: boolean
          id: string
          is_approved: boolean
          is_online: boolean
          is_priority: boolean
          location: Json | null
          payout: Json
          stats: Json
          trip_prefs: Json
          updated_at: string
          user_id: string
          vehicle: Json
          vehicle_class: string
        }
        Insert: {
          accepts_classes?: string[]
          documents_override?: boolean
          id?: string
          is_approved?: boolean
          is_online?: boolean
          is_priority?: boolean
          location?: Json | null
          payout?: Json
          stats?: Json
          trip_prefs?: Json
          updated_at?: string
          user_id: string
          vehicle?: Json
          vehicle_class?: string
        }
        Update: {
          accepts_classes?: string[]
          documents_override?: boolean
          id?: string
          is_approved?: boolean
          is_online?: boolean
          is_priority?: boolean
          location?: Json | null
          payout?: Json
          stats?: Json
          trip_prefs?: Json
          updated_at?: string
          user_id?: string
          vehicle?: Json
          vehicle_class?: string
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
      payouts: {
        Row: {
          amount: number
          created_at: string
          driver_id: string
          failure: string | null
          fee: number
          id: string
          kind: string
          paid_at: string | null
          provider_id: string | null
          status: string
          week_of: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          driver_id: string
          failure?: string | null
          fee?: number
          id?: string
          kind: string
          paid_at?: string | null
          provider_id?: string | null
          status?: string
          week_of?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          driver_id?: string
          failure?: string | null
          fee?: number
          id?: string
          kind?: string
          paid_at?: string | null
          provider_id?: string | null
          status?: string
          week_of?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payouts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
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
      push_tokens: {
        Row: {
          created_at: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ride_archive_access: {
        Row: {
          action: string
          actor: string
          created_at: string
          id: string
          ride_id: string
        }
        Insert: {
          action?: string
          actor: string
          created_at?: string
          id?: string
          ride_id: string
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          id?: string
          ride_id?: string
        }
        Relationships: []
      }
      ride_archives: {
        Row: {
          accounting: Json
          accounting_expires_at: string
          accounting_sha256: string
          booking: Json | null
          booking_day: string
          contacts: Json | null
          final_status: string
          legal_hold: boolean
          personal_erased_at: string | null
          personal_expires_at: string
          ride_created_at: string
          ride_id: string
          sealed_at: string
          version: number
        }
        Insert: {
          accounting: Json
          accounting_expires_at: string
          accounting_sha256: string
          booking?: Json | null
          booking_day: string
          contacts?: Json | null
          final_status: string
          legal_hold?: boolean
          personal_erased_at?: string | null
          personal_expires_at: string
          ride_created_at: string
          ride_id: string
          sealed_at?: string
          version?: number
        }
        Update: {
          accounting?: Json
          accounting_expires_at?: string
          accounting_sha256?: string
          booking?: Json | null
          booking_day?: string
          contacts?: Json | null
          final_status?: string
          legal_hold?: boolean
          personal_erased_at?: string | null
          personal_expires_at?: string
          ride_created_at?: string
          ride_id?: string
          sealed_at?: string
          version?: number
        }
        Relationships: []
      }
      rider_favorite_drivers: {
        Row: {
          created_at: string
          driver_id: string
          rider_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          rider_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          rider_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rider_favorite_drivers_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rider_favorite_drivers_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          favorite_driver_id: string | null
          favorite_free_cancellation: boolean | null
          favorite_wait_accepted: boolean | null
          id: string
          is_test: boolean
          live_route: Json | null
          messages: Json
          offer_driver_id: string | null
          offer_expires_at: string | null
          original_id: string | null
          payment: Json
          pickup: Json
          pin: string
          rating: Json
          rider_id: string
          rider_rating: number | null
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
          favorite_driver_id?: string | null
          favorite_free_cancellation?: boolean | null
          favorite_wait_accepted?: boolean | null
          id?: string
          is_test?: boolean
          live_route?: Json | null
          messages?: Json
          offer_driver_id?: string | null
          offer_expires_at?: string | null
          original_id?: string | null
          payment?: Json
          pickup: Json
          pin: string
          rating?: Json
          rider_id: string
          rider_rating?: number | null
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
          favorite_driver_id?: string | null
          favorite_free_cancellation?: boolean | null
          favorite_wait_accepted?: boolean | null
          id?: string
          is_test?: boolean
          live_route?: Json | null
          messages?: Json
          offer_driver_id?: string | null
          offer_expires_at?: string | null
          original_id?: string | null
          payment?: Json
          pickup?: Json
          pin?: string
          rating?: Json
          rider_id?: string
          rider_rating?: number | null
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
            foreignKeyName: "rides_favorite_driver_id_fkey"
            columns: ["favorite_driver_id"]
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
      road_alert_votes: {
        Row: {
          alert_id: string
          created_at: string
          driver_id: string
          present: boolean
        }
        Insert: {
          alert_id: string
          created_at?: string
          driver_id: string
          present: boolean
        }
        Update: {
          alert_id?: string
          created_at?: string
          driver_id?: string
          present?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "road_alert_votes_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "road_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      road_alerts: {
        Row: {
          confirmations: number
          created_at: string
          denials: number
          id: string
          is_permanent: boolean
          kind: string
          last_confirmed_at: string
          lat: number
          lng: number
          reported_by: string
          validated_by_admin: boolean
        }
        Insert: {
          confirmations?: number
          created_at?: string
          denials?: number
          id?: string
          is_permanent?: boolean
          kind: string
          last_confirmed_at?: string
          lat: number
          lng: number
          reported_by: string
          validated_by_admin?: boolean
        }
        Update: {
          confirmations?: number
          created_at?: string
          denials?: number
          id?: string
          is_permanent?: boolean
          kind?: string
          last_confirmed_at?: string
          lat?: number
          lng?: number
          reported_by?: string
          validated_by_admin?: boolean
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
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
      withdrawal_requests: {
        Row: {
          amount: number
          created_at: string
          debit: number
          driver_id: string
          fee: number
          id: string
          notification_email_sent: boolean
          notification_push_sent: boolean
          notify_attempts: number
          notify_next_at: string
          payout_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          debit: number
          driver_id: string
          fee: number
          id?: string
          notification_email_sent?: boolean
          notification_push_sent?: boolean
          notify_attempts?: number
          notify_next_at?: string
          payout_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          debit?: number
          driver_id?: string
          fee?: number
          id?: string
          notification_email_sent?: boolean
          notification_push_sent?: boolean
          notify_attempts?: number
          notify_next_at?: string
          payout_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: true
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_delete_account: { Args: { _user: string }; Returns: Json }
      admin_ride_archive: {
        Args: { _actor: string; _ride: string }
        Returns: Json
      }
      admin_ride_index: {
        Args: {
          _actor: string
          _from: string
          _limit: number
          _offset: number
          _status: string
          _to: string
        }
        Returns: Json
      }
      approve_withdrawal: {
        Args: { _actor: string; _request: string }
        Returns: Json
      }
      create_payout: {
        Args: {
          _amount: number
          _driver: string
          _fee: number
          _kind: string
          _week?: string
        }
        Returns: string
      }
      decline_ride_offer: {
        Args: { _driver: string; _ride: string }
        Returns: undefined
      }
      finish_payout: {
        Args: {
          _failure?: string
          _id: string
          _ok: boolean
          _provider?: string
        }
        Returns: undefined
      }
      finish_withdrawal_request: { Args: { _request: string }; Returns: Json }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      manage_favorite_driver: {
        Args: {
          p_action: string
          p_confirm_replacement?: boolean
          p_driver_id: string
        }
        Returns: Json
      }
      pending_withdrawal_notifications: {
        Args: { _limit: number }
        Returns: Json[]
      }
      purge_expired_personal_data: { Args: never; Returns: undefined }
      record_withdrawal_notifications: {
        Args: { _email_ok: boolean; _push_ok: boolean; _request: string }
        Returns: undefined
      }
      reject_withdrawal: {
        Args: { _actor: string; _request: string }
        Returns: Json
      }
      request_withdrawal: {
        Args: { _debit: number; _driver: string; _fee: number }
        Returns: Json
      }
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
      withdrawal_json: {
        Args: { w: Database["public"]["Tables"]["withdrawal_requests"]["Row"] }
        Returns: Json
      }
      withdrawal_request_state: { Args: { _driver: string }; Returns: Json }
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
