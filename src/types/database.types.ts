/* ------------------------------------------------------------------ */
/*  Supabase Database types — manually defined from 00002 migration   */
/*  Replace with auto-generated types once `pnpm db:gen-types` works  */
/* ------------------------------------------------------------------ */

export interface Database {
  public: {
    Tables: {
      /* 1. cases */
      cases: {
        Row: {
          id: string;
          user_id: string;
          status: Database['public']['Enums']['case_status'];
          wedge: Database['public']['Enums']['wedge_type'];
          jurisdiction: string;
          diagnostic_state: Record<string, unknown> | null;
          payment_status: Database['public']['Enums']['payment_status'];
          paddle_transaction_id: string | null;
          preview_shown_at: string | null;
          refusal_trigger: string | null;
          total_ai_cost: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: Database['public']['Enums']['case_status'];
          wedge: Database['public']['Enums']['wedge_type'];
          jurisdiction: string;
          diagnostic_state?: Record<string, unknown> | null;
          payment_status?: Database['public']['Enums']['payment_status'];
          paddle_transaction_id?: string | null;
          preview_shown_at?: string | null;
          refusal_trigger?: string | null;
          total_ai_cost?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          status?: Database['public']['Enums']['case_status'];
          wedge?: Database['public']['Enums']['wedge_type'];
          jurisdiction?: string;
          diagnostic_state?: Record<string, unknown> | null;
          payment_status?: Database['public']['Enums']['payment_status'];
          paddle_transaction_id?: string | null;
          preview_shown_at?: string | null;
          refusal_trigger?: string | null;
          total_ai_cost?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };

      /* 2. documents */
      documents: {
        Row: {
          id: string;
          case_id: string;
          file_path: string;
          content_type: string | null;
          parse_status: Database['public']['Enums']['parse_status'];
          parsed_json: Record<string, unknown> | null;
          confirmed_json: Record<string, unknown> | null;
          authenticity_ack: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          case_id: string;
          file_path: string;
          content_type?: string | null;
          parse_status?: Database['public']['Enums']['parse_status'];
          parsed_json?: Record<string, unknown> | null;
          confirmed_json?: Record<string, unknown> | null;
          authenticity_ack?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          case_id?: string;
          file_path?: string;
          content_type?: string | null;
          parse_status?: Database['public']['Enums']['parse_status'];
          parsed_json?: Record<string, unknown> | null;
          confirmed_json?: Record<string, unknown> | null;
          authenticity_ack?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };

      /* 3. letters */
      letters: {
        Row: {
          id: string;
          case_id: string;
          content: string;
          pdf_url: string | null;
          grounding_context_ids: string[] | null;
          citation_validation: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          case_id: string;
          content: string;
          pdf_url?: string | null;
          grounding_context_ids?: string[] | null;
          citation_validation?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          case_id?: string;
          content?: string;
          pdf_url?: string | null;
          grounding_context_ids?: string[] | null;
          citation_validation?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };

      /* 4. sequences */
      sequences: {
        Row: {
          id: string;
          case_id: string;
          vertical: string;
          current_step: number;
          next_send_at: string | null;
          steps: Record<string, unknown>;
          grounding_context_ids: string[] | null;
          citation_validation: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          case_id: string;
          vertical: string;
          current_step?: number;
          next_send_at?: string | null;
          steps: Record<string, unknown>;
          grounding_context_ids?: string[] | null;
          citation_validation?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          case_id?: string;
          vertical?: string;
          current_step?: number;
          next_send_at?: string | null;
          steps?: Record<string, unknown>;
          grounding_context_ids?: string[] | null;
          citation_validation?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };

      /* 5. packets */
      packets: {
        Row: {
          id: string;
          case_id: string;
          venue: string;
          type: string;
          bundle_url: string | null;
          template_version: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          case_id: string;
          venue: string;
          type: string;
          bundle_url?: string | null;
          template_version: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          case_id?: string;
          venue?: string;
          type?: string;
          bundle_url?: string | null;
          template_version?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };

      /* 6. deadline_events */
      deadline_events: {
        Row: {
          id: string;
          case_id: string;
          deadline_date: string;
          timezone: string;
          anchor_event: string;
          prompt_message: string;
          fired_at: string | null;
          dismissed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          deadline_date: string;
          timezone: string;
          anchor_event: string;
          prompt_message: string;
          fired_at?: string | null;
          dismissed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          case_id?: string;
          deadline_date?: string;
          timezone?: string;
          anchor_event?: string;
          prompt_message?: string;
          fired_at?: string | null;
          dismissed_at?: string | null;
          created_at?: string;
        };
      };

      /* 7. case_status_history */
      case_status_history: {
        Row: {
          id: string;
          case_id: string;
          previous_status: Database['public']['Enums']['case_status'];
          new_status: Database['public']['Enums']['case_status'];
          changed_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          previous_status: Database['public']['Enums']['case_status'];
          new_status: Database['public']['Enums']['case_status'];
          changed_at?: string;
        };
        Update: {
          id?: string;
          case_id?: string;
          previous_status?: Database['public']['Enums']['case_status'];
          new_status?: Database['public']['Enums']['case_status'];
          changed_at?: string;
        };
      };

      /* 8. outcomes */
      outcomes: {
        Row: {
          id: string;
          case_id: string;
          stage: string;
          outcome_category: string;
          recovered_amount: number | null;
          testimonial: string | null;
          consent: Record<string, unknown> | null;
          outcome_verified: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          stage: string;
          outcome_category: string;
          recovered_amount?: number | null;
          testimonial?: string | null;
          consent?: Record<string, unknown> | null;
          outcome_verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          case_id?: string;
          stage?: string;
          outcome_category?: string;
          recovered_amount?: number | null;
          testimonial?: string | null;
          consent?: Record<string, unknown> | null;
          outcome_verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      /* 9. subscriptions */
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          paddle_subscription_id: string;
          plan: string;
          status: string;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          paddle_subscription_id: string;
          plan: string;
          status?: string;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          paddle_subscription_id?: string;
          plan?: string;
          status?: string;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      /* 10. waitlist_entries */
      waitlist_entries: {
        Row: {
          id: string;
          email: string;
          state: string;
          wedge: Database['public']['Enums']['wedge_type'];
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          state: string;
          wedge: Database['public']['Enums']['wedge_type'];
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          state?: string;
          wedge?: Database['public']['Enums']['wedge_type'];
          created_at?: string;
        };
      };

      /* 11. audit_log */
      audit_log: {
        Row: {
          id: string;
          case_id: string | null;
          user_id: string | null;
          correlation_id: string | null;
          generation_inputs_hash: string | null;
          grounding_context_ids: string[] | null;
          model_version: string | null;
          prompt_version: string | null;
          citation_validation_result: Record<string, unknown> | null;
          ai_cost: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id?: string | null;
          user_id?: string | null;
          correlation_id?: string | null;
          generation_inputs_hash?: string | null;
          grounding_context_ids?: string[] | null;
          model_version?: string | null;
          prompt_version?: string | null;
          citation_validation_result?: Record<string, unknown> | null;
          ai_cost?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          case_id?: string | null;
          user_id?: string | null;
          correlation_id?: string | null;
          generation_inputs_hash?: string | null;
          grounding_context_ids?: string[] | null;
          model_version?: string | null;
          prompt_version?: string | null;
          citation_validation_result?: Record<string, unknown> | null;
          ai_cost?: number | null;
          created_at?: string;
        };
      };

      /* 12. webhook_events */
      webhook_events: {
        Row: {
          id: string;
          event_id: string;
          provider: string;
          payload: Record<string, unknown>;
          processed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          provider: string;
          payload: Record<string, unknown>;
          processed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          provider?: string;
          payload?: Record<string, unknown>;
          processed_at?: string | null;
          created_at?: string;
        };
      };

      /* 13. tavily_cache */
      tavily_cache: {
        Row: {
          id: string;
          query_hash: string;
          domain_filter: string | null;
          results: Record<string, unknown>;
          fetched_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          query_hash: string;
          domain_filter?: string | null;
          results: Record<string, unknown>;
          fetched_at?: string;
          expires_at: string;
        };
        Update: {
          id?: string;
          query_hash?: string;
          domain_filter?: string | null;
          results?: Record<string, unknown>;
          fetched_at?: string;
          expires_at?: string;
        };
      };

      /* 14. login_attempts */
      login_attempts: {
        Row: {
          id: string;
          user_id: string | null;
          ip_address: string;
          user_agent: string | null;
          success: boolean;
          attempted_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          ip_address: string;
          user_agent?: string | null;
          success: boolean;
          attempted_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          ip_address?: string;
          user_agent?: string | null;
          success?: boolean;
          attempted_at?: string;
        };
      };
    };

    Enums: {
      case_status:
        | 'intake'
        | 'generated'
        | 'sent'
        | 'awaiting'
        | 'escalation_drafted'
        | 'resolved'
        | 'closed';
      payment_status: 'pending' | 'paid' | 'refunded';
      parse_status: 'pending' | 'parsed' | 'confirmed' | 'failed';
      wedge_type: 'deposit' | 'subscription';
    };
  };
}

/* ------------------------------------------------------------------ */
/*  Convenience type helpers                                          */
/* ------------------------------------------------------------------ */

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];
