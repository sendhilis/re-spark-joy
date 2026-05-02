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
      bank_certification_tests: {
        Row: {
          bank_id: string
          created_at: string
          environment: Database["public"]["Enums"]["bank_environment"]
          error_message: string | null
          id: string
          is_required: boolean
          latency_ms: number | null
          request_payload: Json | null
          response_payload: Json | null
          status: string
          test_code: string
          test_name: string
          test_suite_run_id: string
        }
        Insert: {
          bank_id: string
          created_at?: string
          environment?: Database["public"]["Enums"]["bank_environment"]
          error_message?: string | null
          id?: string
          is_required?: boolean
          latency_ms?: number | null
          request_payload?: Json | null
          response_payload?: Json | null
          status: string
          test_code: string
          test_name: string
          test_suite_run_id: string
        }
        Update: {
          bank_id?: string
          created_at?: string
          environment?: Database["public"]["Enums"]["bank_environment"]
          error_message?: string | null
          id?: string
          is_required?: boolean
          latency_ms?: number | null
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
          test_code?: string
          test_name?: string
          test_suite_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_certification_tests_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "participating_banks"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_connectors: {
        Row: {
          bank_code: string
          bank_name: string
          circuit_state: string
          endpoint_url: string | null
          failure_count: number
          id: string
          last_failure_at: string | null
          opened_at: string | null
          p50_latency_ms: number
          p99_latency_ms: number
          participating_bank_id: string | null
          success_count: number
          timeout_ms: number
          updated_at: string
        }
        Insert: {
          bank_code: string
          bank_name: string
          circuit_state?: string
          endpoint_url?: string | null
          failure_count?: number
          id?: string
          last_failure_at?: string | null
          opened_at?: string | null
          p50_latency_ms?: number
          p99_latency_ms?: number
          participating_bank_id?: string | null
          success_count?: number
          timeout_ms?: number
          updated_at?: string
        }
        Update: {
          bank_code?: string
          bank_name?: string
          circuit_state?: string
          endpoint_url?: string | null
          failure_count?: number
          id?: string
          last_failure_at?: string | null
          opened_at?: string | null
          p50_latency_ms?: number
          p99_latency_ms?: number
          participating_bank_id?: string | null
          success_count?: number
          timeout_ms?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_connectors_participating_bank_id_fkey"
            columns: ["participating_bank_id"]
            isOneToOne: false
            referencedRelation: "participating_banks"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_integration_profiles: {
        Row: {
          bank_id: string
          breaker_failure_threshold: number
          breaker_recovery_ms: number
          created_at: string
          environment: Database["public"]["Enums"]["bank_environment"]
          hmac_algorithm: string
          hmac_key_ref: string | null
          id: string
          ip_allowlist: string[]
          is_active: boolean
          mtls_client_cert_ref: string | null
          mtls_server_ca_ref: string | null
          pacs002_endpoint: string | null
          pacs008_endpoint: string | null
          pacs009_endpoint: string | null
          rate_limit_tps: number
          timeout_ms: number
          updated_at: string
          webhook_callback_url: string | null
        }
        Insert: {
          bank_id: string
          breaker_failure_threshold?: number
          breaker_recovery_ms?: number
          created_at?: string
          environment?: Database["public"]["Enums"]["bank_environment"]
          hmac_algorithm?: string
          hmac_key_ref?: string | null
          id?: string
          ip_allowlist?: string[]
          is_active?: boolean
          mtls_client_cert_ref?: string | null
          mtls_server_ca_ref?: string | null
          pacs002_endpoint?: string | null
          pacs008_endpoint?: string | null
          pacs009_endpoint?: string | null
          rate_limit_tps?: number
          timeout_ms?: number
          updated_at?: string
          webhook_callback_url?: string | null
        }
        Update: {
          bank_id?: string
          breaker_failure_threshold?: number
          breaker_recovery_ms?: number
          created_at?: string
          environment?: Database["public"]["Enums"]["bank_environment"]
          hmac_algorithm?: string
          hmac_key_ref?: string | null
          id?: string
          ip_allowlist?: string[]
          is_active?: boolean
          mtls_client_cert_ref?: string | null
          mtls_server_ca_ref?: string | null
          pacs002_endpoint?: string | null
          pacs008_endpoint?: string | null
          pacs009_endpoint?: string | null
          rate_limit_tps?: number
          timeout_ms?: number
          updated_at?: string
          webhook_callback_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_integration_profiles_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "participating_banks"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_lifecycle_events: {
        Row: {
          actor_user_id: string | null
          bank_id: string
          created_at: string
          from_stage: Database["public"]["Enums"]["bank_lifecycle_stage"] | null
          id: string
          notes: string | null
          to_stage: Database["public"]["Enums"]["bank_lifecycle_stage"]
        }
        Insert: {
          actor_user_id?: string | null
          bank_id: string
          created_at?: string
          from_stage?:
            | Database["public"]["Enums"]["bank_lifecycle_stage"]
            | null
          id?: string
          notes?: string | null
          to_stage: Database["public"]["Enums"]["bank_lifecycle_stage"]
        }
        Update: {
          actor_user_id?: string | null
          bank_id?: string
          created_at?: string
          from_stage?:
            | Database["public"]["Enums"]["bank_lifecycle_stage"]
            | null
          id?: string
          notes?: string | null
          to_stage?: Database["public"]["Enums"]["bank_lifecycle_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "bank_lifecycle_events_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "participating_banks"
            referencedColumns: ["id"]
          },
        ]
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
      corridor_routes: {
        Row: {
          active: boolean
          corridor_type: string
          country_code: string
          country_name: string
          created_at: string
          extra_fee_bps: number
          id: string
          notes: string | null
          partner_bank: string | null
          settlement_currency: string
          settlement_time: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          corridor_type: string
          country_code: string
          country_name: string
          created_at?: string
          extra_fee_bps?: number
          id?: string
          notes?: string | null
          partner_bank?: string | null
          settlement_currency: string
          settlement_time?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          corridor_type?: string
          country_code?: string
          country_name?: string
          created_at?: string
          extra_fee_bps?: number
          id?: string
          notes?: string | null
          partner_bank?: string | null
          settlement_currency?: string
          settlement_time?: string
          updated_at?: string
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
      fraud_rules: {
        Row: {
          action: string
          created_at: string
          description: string
          enabled: boolean
          id: string
          rule_code: string
          rule_type: string
          threshold: number
          window_seconds: number
        }
        Insert: {
          action?: string
          created_at?: string
          description: string
          enabled?: boolean
          id?: string
          rule_code: string
          rule_type: string
          threshold: number
          window_seconds?: number
        }
        Update: {
          action?: string
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          rule_code?: string
          rule_type?: string
          threshold?: number
          window_seconds?: number
        }
        Relationships: []
      }
      lipafo_alias_registry: {
        Row: {
          account_name: string
          account_ref: string | null
          bank_code: string
          created_at: string
          entity_type: string | null
          is_active: boolean | null
          lmid: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          account_name: string
          account_ref?: string | null
          bank_code: string
          created_at?: string
          entity_type?: string | null
          is_active?: boolean | null
          lmid?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_ref?: string | null
          bank_code?: string
          created_at?: string
          entity_type?: string | null
          is_active?: boolean | null
          lmid?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      lipafo_positions: {
        Row: {
          date: string
          id: string
          net_cents: number
          receiving_bank: string
          sending_bank: string
          updated_at: string
        }
        Insert: {
          date: string
          id: string
          net_cents?: number
          receiving_bank: string
          sending_bank: string
          updated_at?: string
        }
        Update: {
          date?: string
          id?: string
          net_cents?: number
          receiving_bank?: string
          sending_bank?: string
          updated_at?: string
        }
        Relationships: []
      }
      lipafo_transactions: {
        Row: {
          amount_cents: number
          completed_at: string | null
          created_at: string
          credit_ref: string | null
          currency: string
          debit_ref: string | null
          error_code: string | null
          fraud_score: number | null
          id: string
          idempotency_key: string
          latency_ms: number | null
          ltr: string | null
          receiver_bank: string
          receiver_name: string | null
          receiver_phone: string
          sender_bank: string
          sender_phone: string
          state: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          completed_at?: string | null
          created_at?: string
          credit_ref?: string | null
          currency?: string
          debit_ref?: string | null
          error_code?: string | null
          fraud_score?: number | null
          id: string
          idempotency_key: string
          latency_ms?: number | null
          ltr?: string | null
          receiver_bank: string
          receiver_name?: string | null
          receiver_phone: string
          sender_bank: string
          sender_phone: string
          state?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          completed_at?: string | null
          created_at?: string
          credit_ref?: string | null
          currency?: string
          debit_ref?: string | null
          error_code?: string | null
          fraud_score?: number | null
          id?: string
          idempotency_key?: string
          latency_ms?: number | null
          ltr?: string | null
          receiver_bank?: string
          receiver_name?: string | null
          receiver_phone?: string
          sender_bank?: string
          sender_phone?: string
          state?: string
          updated_at?: string
        }
        Relationships: []
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
      member_collateral: {
        Row: {
          agent_id: string
          available_balance: number | null
          cap_amount: number
          collateral_account: string
          created_at: string
          currency: string
          id: string
          last_topup_at: string | null
          member_bank: string
          posted_balance: number
          status: string
          updated_at: string
          utilised_amount: number
        }
        Insert: {
          agent_id: string
          available_balance?: number | null
          cap_amount?: number
          collateral_account: string
          created_at?: string
          currency?: string
          id?: string
          last_topup_at?: string | null
          member_bank: string
          posted_balance?: number
          status?: string
          updated_at?: string
          utilised_amount?: number
        }
        Update: {
          agent_id?: string
          available_balance?: number | null
          cap_amount?: number
          collateral_account?: string
          created_at?: string
          currency?: string
          id?: string
          last_topup_at?: string | null
          member_bank?: string
          posted_balance?: number
          status?: string
          updated_at?: string
          utilised_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_collateral_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "settlement_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_settlements: {
        Row: {
          created_at: string
          fee_amount: number
          gross_amount: number
          id: string
          merchant_id: string
          net_amount: number
          paid_out_at: string | null
          scheduled_payout_at: string
          settlement_date: string
          status: string
          transaction_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          fee_amount?: number
          gross_amount?: number
          id?: string
          merchant_id: string
          net_amount?: number
          paid_out_at?: string | null
          scheduled_payout_at: string
          settlement_date: string
          status?: string
          transaction_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          fee_amount?: number
          gross_amount?: number
          id?: string
          merchant_id?: string
          net_amount?: number
          paid_out_at?: string | null
          scheduled_payout_at?: string
          settlement_date?: string
          status?: string
          transaction_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_settlements_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          category: string
          contact_email: string | null
          contact_phone: string | null
          corridor_type: string
          country_code: string
          created_at: string
          id: string
          lipafo_code: string
          lmid: string | null
          mcc: string | null
          merchant_name: string
          merchant_segment: string
          monthly_volume: number
          settlement_account: string | null
          settlement_bank: string
          status: string
          till_code: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          contact_email?: string | null
          contact_phone?: string | null
          corridor_type?: string
          country_code?: string
          created_at?: string
          id?: string
          lipafo_code: string
          lmid?: string | null
          mcc?: string | null
          merchant_name: string
          merchant_segment?: string
          monthly_volume?: number
          settlement_account?: string | null
          settlement_bank?: string
          status?: string
          till_code?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          contact_email?: string | null
          contact_phone?: string | null
          corridor_type?: string
          country_code?: string
          created_at?: string
          id?: string
          lipafo_code?: string
          lmid?: string | null
          mcc?: string | null
          merchant_name?: string
          merchant_segment?: string
          monthly_volume?: number
          settlement_account?: string | null
          settlement_bank?: string
          status?: string
          till_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mpesa_global_tariff_runs: {
        Row: {
          created_at: string
          id: string
          message: string | null
          rows_imported: number
          source_url: string | null
          status: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          rows_imported?: number
          source_url?: string | null
          status: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          rows_imported?: number
          source_url?: string | null
          status?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      mpesa_global_tariffs: {
        Row: {
          band_max_kes: number
          band_min_kes: number
          corridor_code: string
          country_name: string
          created_at: string
          fee_kes: number
          fx_margin_bps: number | null
          id: string
          snapshot_at: string
          source_url: string
        }
        Insert: {
          band_max_kes: number
          band_min_kes: number
          corridor_code: string
          country_name: string
          created_at?: string
          fee_kes: number
          fx_margin_bps?: number | null
          id?: string
          snapshot_at?: string
          source_url: string
        }
        Update: {
          band_max_kes?: number
          band_min_kes?: number
          corridor_code?: string
          country_name?: string
          created_at?: string
          fee_kes?: number
          fx_margin_bps?: number | null
          id?: string
          snapshot_at?: string
          source_url?: string
        }
        Relationships: []
      }
      participating_banks: {
        Row: {
          bank_code: string
          bank_name: string
          bic: string | null
          cbk_license_number: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          go_live_at: string | null
          id: string
          kyb_documents: Json
          kyb_status: string
          legal_entity_name: string | null
          lifecycle_stage: Database["public"]["Enums"]["bank_lifecycle_stage"]
          notes: string | null
          registration_number: string | null
          sandbox_certified_at: string | null
          tech_contact_email: string | null
          tech_contact_name: string | null
          updated_at: string
        }
        Insert: {
          bank_code: string
          bank_name: string
          bic?: string | null
          cbk_license_number?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          go_live_at?: string | null
          id?: string
          kyb_documents?: Json
          kyb_status?: string
          legal_entity_name?: string | null
          lifecycle_stage?: Database["public"]["Enums"]["bank_lifecycle_stage"]
          notes?: string | null
          registration_number?: string | null
          sandbox_certified_at?: string | null
          tech_contact_email?: string | null
          tech_contact_name?: string | null
          updated_at?: string
        }
        Update: {
          bank_code?: string
          bank_name?: string
          bic?: string | null
          cbk_license_number?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          go_live_at?: string | null
          id?: string
          kyb_documents?: Json
          kyb_status?: string
          legal_entity_name?: string | null
          lifecycle_stage?: Database["public"]["Enums"]["bank_lifecycle_stage"]
          notes?: string | null
          registration_number?: string | null
          sandbox_certified_at?: string | null
          tech_contact_email?: string | null
          tech_contact_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      position_ledger_shards: {
        Row: {
          account_identifier: string
          account_type: string
          balance: number
          credit_count: number
          debit_count: number
          id: string
          shard_no: number
          updated_at: string
        }
        Insert: {
          account_identifier: string
          account_type?: string
          balance?: number
          credit_count?: number
          debit_count?: number
          id?: string
          shard_no: number
          updated_at?: string
        }
        Update: {
          account_identifier?: string
          account_type?: string
          balance?: number
          credit_count?: number
          debit_count?: number
          id?: string
          shard_no?: number
          updated_at?: string
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
      settlement_agents: {
        Row: {
          agent_code: string
          agent_name: string
          agent_type: string
          bic: string | null
          contact_email: string | null
          created_at: string
          cutoff_local: string
          id: string
          settlement_account: string
          status: string
          updated_at: string
        }
        Insert: {
          agent_code: string
          agent_name: string
          agent_type?: string
          bic?: string | null
          contact_email?: string | null
          created_at?: string
          cutoff_local?: string
          id?: string
          settlement_account: string
          status?: string
          updated_at?: string
        }
        Update: {
          agent_code?: string
          agent_name?: string
          agent_type?: string
          bic?: string | null
          contact_email?: string | null
          created_at?: string
          cutoff_local?: string
          id?: string
          settlement_account?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      settlement_confirmations: {
        Row: {
          agent_reference: string
          id: string
          instruction_id: string
          outcome: string
          raw_payload: Json
          reason: string | null
          received_at: string
          settled_amount: number | null
        }
        Insert: {
          agent_reference: string
          id?: string
          instruction_id: string
          outcome: string
          raw_payload?: Json
          reason?: string | null
          received_at?: string
          settled_amount?: number | null
        }
        Update: {
          agent_reference?: string
          id?: string
          instruction_id?: string
          outcome?: string
          raw_payload?: Json
          reason?: string | null
          received_at?: string
          settled_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "settlement_confirmations_instruction_id_fkey"
            columns: ["instruction_id"]
            isOneToOne: false
            referencedRelation: "settlement_instructions"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_dispatches: {
        Row: {
          amount: number
          beneficiary_bank: string
          created_at: string
          dispatched_at: string | null
          float_revenue: number
          id: string
          position_id: string | null
          reference: string
          scheduled_at: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          beneficiary_bank: string
          created_at?: string
          dispatched_at?: string | null
          float_revenue?: number
          id?: string
          position_id?: string | null
          reference: string
          scheduled_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          beneficiary_bank?: string
          created_at?: string
          dispatched_at?: string | null
          float_revenue?: number
          id?: string
          position_id?: string | null
          reference?: string
          scheduled_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_dispatches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "settlement_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_instructions: {
        Row: {
          agent_id: string
          agent_reference: string | null
          amount: number
          confirmed_at: string | null
          created_at: string
          creditor_bank: string
          currency: string
          cycle_date: string
          debtor_bank: string
          dispatched_at: string | null
          id: string
          instruction_ref: string
          message_type: string
          payload: Json
          rejection_reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          agent_reference?: string | null
          amount: number
          confirmed_at?: string | null
          created_at?: string
          creditor_bank: string
          currency?: string
          cycle_date: string
          debtor_bank: string
          dispatched_at?: string | null
          id?: string
          instruction_ref: string
          message_type?: string
          payload?: Json
          rejection_reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          agent_reference?: string | null
          amount?: number
          confirmed_at?: string | null
          created_at?: string
          creditor_bank?: string
          currency?: string
          cycle_date?: string
          debtor_bank?: string
          dispatched_at?: string | null
          id?: string
          instruction_ref?: string
          message_type?: string
          payload?: Json
          rejection_reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_instructions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "settlement_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_positions: {
        Row: {
          created_at: string
          cutoff_at: string
          id: string
          inbound_volume: number
          net_position: number
          outbound_volume: number
          participating_bank: string
          position_date: string
          status: string
          transaction_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          cutoff_at?: string
          id?: string
          inbound_volume?: number
          net_position?: number
          outbound_volume?: number
          participating_bank: string
          position_date: string
          status?: string
          transaction_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          cutoff_at?: string
          id?: string
          inbound_volume?: number
          net_position?: number
          outbound_volume?: number
          participating_bank?: string
          position_date?: string
          status?: string
          transaction_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      settlement_runs: {
        Row: {
          banks_settled: number
          checkpoint_at: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          events_processed: number
          id: string
          last_processed_event_id: number
          run_date: string
          started_at: string | null
          status: string
          total_volume: number
        }
        Insert: {
          banks_settled?: number
          checkpoint_at?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          events_processed?: number
          id?: string
          last_processed_event_id?: number
          run_date: string
          started_at?: string | null
          status?: string
          total_volume?: number
        }
        Update: {
          banks_settled?: number
          checkpoint_at?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          events_processed?: number
          id?: string
          last_processed_event_id?: number
          run_date?: string
          started_at?: string | null
          status?: string
          total_volume?: number
        }
        Relationships: []
      }
      switch_events: {
        Row: {
          created_at: string
          event_type: string
          from_state: string | null
          id: number
          intent_id: string | null
          payload: Json
          span_id: string
          to_state: string | null
          trace_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          from_state?: string | null
          id?: number
          intent_id?: string | null
          payload?: Json
          span_id: string
          to_state?: string | null
          trace_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          from_state?: string | null
          id?: number
          intent_id?: string | null
          payload?: Json
          span_id?: string
          to_state?: string | null
          trace_id?: string
        }
        Relationships: []
      }
      trace_spans: {
        Row: {
          attributes: Json
          duration_ms: number | null
          id: number
          operation: string
          parent_span_id: string | null
          service: string
          span_id: string
          started_at: string
          status: string
          trace_id: string
        }
        Insert: {
          attributes?: Json
          duration_ms?: number | null
          id?: number
          operation: string
          parent_span_id?: string | null
          service: string
          span_id: string
          started_at?: string
          status?: string
          trace_id: string
        }
        Update: {
          attributes?: Json
          duration_ms?: number | null
          id?: number
          operation?: string
          parent_span_id?: string | null
          service?: string
          span_id?: string
          started_at?: string
          status?: string
          trace_id?: string
        }
        Relationships: []
      }
      transaction_intents: {
        Row: {
          amount: number
          attempt_count: number
          completed_at: string | null
          created_at: string
          currency: string
          id: string
          idempotency_key: string
          last_error: string | null
          payee_bank: string | null
          payee_identifier: string
          payer_identifier: string
          rail: string
          state: string
          trace_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          payee_bank?: string | null
          payee_identifier: string
          payer_identifier: string
          rail?: string
          state?: string
          trace_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          payee_bank?: string | null
          payee_identifier?: string
          payer_identifier?: string
          rail?: string
          state?: string
          trace_id?: string
          updated_at?: string
          user_id?: string | null
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
      velocity_counters: {
        Row: {
          bucket: string
          count: number
          id: string
          subject: string
          total_amount: number
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          id?: string
          subject: string
          total_amount?: number
          window_start: string
        }
        Update: {
          bucket?: string
          count?: number
          id?: string
          subject?: string
          total_amount?: number
          window_start?: string
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
      bank_environment: "sandbox" | "production"
      bank_lifecycle_stage:
        | "application"
        | "kyb_legal"
        | "technical_setup"
        | "sandbox_certification"
        | "production_live"
        | "suspended"
        | "rejected"
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
      bank_environment: ["sandbox", "production"],
      bank_lifecycle_stage: [
        "application",
        "kyb_legal",
        "technical_setup",
        "sandbox_certification",
        "production_live",
        "suspended",
        "rejected",
      ],
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
