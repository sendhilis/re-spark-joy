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
      agent_transactions: {
        Row: {
          agent_id: string
          amount: number
          created_at: string
          id: string
          notes: string | null
          status: string
          transaction_code: string | null
          transaction_type: string
          user_id: string | null
        }
        Insert: {
          agent_id: string
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          transaction_code?: string | null
          transaction_type: string
          user_id?: string | null
        }
        Update: {
          agent_id?: string
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          transaction_code?: string | null
          transaction_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_transactions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "bank_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_agents: {
        Row: {
          agent_code: string
          agent_name: string
          bank_partner: string
          county: string
          created_at: string
          daily_transaction_limit: number
          float_balance: number
          id: string
          latitude: number | null
          location: string
          longitude: number | null
          max_float: number
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agent_code: string
          agent_name: string
          bank_partner?: string
          county?: string
          created_at?: string
          daily_transaction_limit?: number
          float_balance?: number
          id?: string
          latitude?: number | null
          location: string
          longitude?: number | null
          max_float?: number
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agent_code?: string
          agent_name?: string
          bank_partner?: string
          county?: string
          created_at?: string
          daily_transaction_limit?: number
          float_balance?: number
          id?: string
          latitude?: number | null
          location?: string
          longitude?: number | null
          max_float?: number
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      flagged_transactions: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          status: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flagged_transactions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_applications: {
        Row: {
          amount: number
          created_at: string
          duration_months: number
          id: string
          interest_rate: number
          loan_type: string
          monthly_payment: number | null
          notes: string | null
          purpose: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          duration_months: number
          id?: string
          interest_rate?: number
          loan_type: string
          monthly_payment?: number | null
          notes?: string | null
          purpose?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          duration_months?: number
          id?: string
          interest_rate?: number
          loan_type?: string
          monthly_payment?: number | null
          notes?: string | null
          purpose?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          pension_metadata: Json | null
          recipient: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          pension_metadata?: Json | null
          recipient?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          wallet_type?: Database["public"]["Enums"]["wallet_type"]
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          pension_metadata?: Json | null
          recipient?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
          wallet_type?: Database["public"]["Enums"]["wallet_type"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      virtual_cards: {
        Row: {
          card_holder: string
          card_number: string
          created_at: string
          current_spent: number
          cvv: string
          expiry_month: number
          expiry_year: number
          id: string
          is_frozen: boolean
          spending_limit: number
          updated_at: string
          user_id: string
        }
        Insert: {
          card_holder: string
          card_number: string
          created_at?: string
          current_spent?: number
          cvv: string
          expiry_month: number
          expiry_year: number
          id?: string
          is_frozen?: boolean
          spending_limit?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          card_holder?: string
          card_number?: string
          created_at?: string
          current_spent?: number
          cvv?: string
          expiry_month?: number
          expiry_year?: number
          id?: string
          is_frozen?: boolean
          spending_limit?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          type: Database["public"]["Enums"]["wallet_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          type: Database["public"]["Enums"]["wallet_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          type?: Database["public"]["Enums"]["wallet_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      transaction_status: "completed" | "pending" | "failed"
      transaction_type:
        | "sent"
        | "received"
        | "bill"
        | "school"
        | "save"
        | "qr_payment"
        | "virtual_card"
        | "card_linking"
        | "mpesa"
        | "pension_contribution"
      wallet_type:
        | "main"
        | "education"
        | "medical"
        | "holiday"
        | "retirement"
        | "pension"
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
      app_role: ["admin", "moderator", "user"],
      transaction_status: ["completed", "pending", "failed"],
      transaction_type: [
        "sent",
        "received",
        "bill",
        "school",
        "save",
        "qr_payment",
        "virtual_card",
        "card_linking",
        "mpesa",
        "pension_contribution",
      ],
      wallet_type: [
        "main",
        "education",
        "medical",
        "holiday",
        "retirement",
        "pension",
      ],
    },
  },
} as const
