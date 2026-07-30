/**
 * AUTO-GENERATED from Prop OS migrations (1A foundation + 1E activation read).
 * Re-run: npm run gen:prop-os-db-types
 * Do not hand-edit.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PropOsDatabase = {
  public: {
    Tables: {
      prop_account_events: {
        Row: {
      id: string;
      user_id: string;
      challenge_id: string;
      kind: string;
      occurred_at: string;
      payload: Json;
      schema_version: string;
      created_at: string;
        };
        Insert: {
      id?: string;
      user_id: string;
      challenge_id: string;
      kind: string;
      occurred_at?: string;
      payload?: Json;
      schema_version?: string;
      created_at?: string;
        };
        Update: {
      id?: string;
      user_id?: string;
      challenge_id?: string;
      kind?: string;
      occurred_at?: string;
      payload?: Json;
      schema_version?: string;
      created_at?: string;
        };
        Relationships: [];
      };
      prop_accounts: {
        Row: {
      id: string | null;
      user_id: string;
      firm_key: string | null;
      label: string;
      account_size_minor: number;
      currency: string;
      firm_timezone: string;
      status: string;
      source: string;
      schema_version: string;
      created_at: string;
      archived_at: string | null;
      updated_at: string;
        };
        Insert: {
      id?: string | null;
      user_id: string;
      firm_key?: string | null;
      label: string;
      account_size_minor: number;
      currency?: string;
      firm_timezone: string;
      status: string;
      source: string;
      schema_version?: string;
      created_at?: string;
      archived_at?: string | null;
      updated_at?: string;
        };
        Update: {
      id?: string | null;
      user_id?: string;
      firm_key?: string | null;
      label?: string;
      account_size_minor?: number;
      currency?: string;
      firm_timezone?: string;
      status?: string;
      source?: string;
      schema_version?: string;
      created_at?: string;
      archived_at?: string | null;
      updated_at?: string;
        };
        Relationships: [];
      };
      prop_challenge_rule_snapshots: {
        Row: {
      id: string | null;
      user_id: string;
      challenge_id: string;
      rule_set_version: string;
      snapshot: Json;
      template_key: string | null;
      template_version_at_capture: string | null;
      captured_at: string;
      schema_version: string;
        };
        Insert: {
      id?: string | null;
      user_id: string;
      challenge_id: string;
      rule_set_version: string;
      snapshot: Json;
      template_key?: string | null;
      template_version_at_capture?: string | null;
      captured_at?: string;
      schema_version?: string;
        };
        Update: {
      id?: string | null;
      user_id?: string;
      challenge_id?: string;
      rule_set_version?: string;
      snapshot?: Json;
      template_key?: string | null;
      template_version_at_capture?: string | null;
      captured_at?: string;
      schema_version?: string;
        };
        Relationships: [];
      };
      prop_challenge_transitions: {
        Row: {
      id: string | null;
      user_id: string;
      challenge_id: string;
      from_status: string | null;
      to_status: string;
      reason_code: string;
      evidence: Json;
      actor: string;
      at: string;
      schema_version: string;
      created_at: string;
        };
        Insert: {
      id?: string | null;
      user_id: string;
      challenge_id: string;
      from_status?: string | null;
      to_status: string;
      reason_code: string;
      evidence?: Json;
      actor: string;
      at: string;
      schema_version?: string;
      created_at?: string;
        };
        Update: {
      id?: string | null;
      user_id?: string;
      challenge_id?: string;
      from_status?: string | null;
      to_status?: string;
      reason_code?: string;
      evidence?: Json;
      actor?: string;
      at?: string;
      schema_version?: string;
      created_at?: string;
        };
        Relationships: [];
      };
      prop_challenges: {
        Row: {
      id: string | null;
      user_id: string;
      account_id: string;
      phase: string;
      status: string;
      rule_set_version: string;
      starting_balance_minor: number;
      started_at: string;
      ended_at: string | null;
      reset_of_challenge_id: string | null;
      breach_locked: boolean;
      schema_version: string;
      created_at: string;
      updated_at: string;
        };
        Insert: {
      id?: string | null;
      user_id: string;
      account_id: string;
      phase: string;
      status: string;
      rule_set_version: string;
      starting_balance_minor: number;
      started_at?: string;
      ended_at?: string | null;
      reset_of_challenge_id?: string | null;
      breach_locked?: boolean;
      schema_version?: string;
      created_at?: string;
      updated_at?: string;
        };
        Update: {
      id?: string | null;
      user_id?: string;
      account_id?: string;
      phase?: string;
      status?: string;
      rule_set_version?: string;
      starting_balance_minor?: number;
      started_at?: string;
      ended_at?: string | null;
      reset_of_challenge_id?: string | null;
      breach_locked?: boolean;
      schema_version?: string;
      created_at?: string;
      updated_at?: string;
        };
        Relationships: [];
      };
      prop_correction_events: {
        Row: {
      id: string | null;
      user_id: string;
      kind: string;
      payload: Json;
      reason: string;
      at: string;
      actor: string;
      schema_version: string;
      created_at: string;
        };
        Insert: {
      id?: string | null;
      user_id: string;
      kind: string;
      payload?: Json;
      reason: string;
      at: string;
      actor: string;
      schema_version?: string;
      created_at?: string;
        };
        Update: {
      id?: string | null;
      user_id?: string;
      kind?: string;
      payload?: Json;
      reason?: string;
      at?: string;
      actor?: string;
      schema_version?: string;
      created_at?: string;
        };
        Relationships: [];
      };
      prop_data_quality_flags: {
        Row: {
      id: string | null;
      user_id: string;
      subject_type: string;
      subject_id: string;
      flag: string;
      severity: string;
      details: Json;
      backfill_version: string | null;
      detected_at: string;
      schema_version: string;
        };
        Insert: {
      id?: string | null;
      user_id: string;
      subject_type: string;
      subject_id: string;
      flag: string;
      severity: string;
      details?: Json;
      backfill_version?: string | null;
      detected_at?: string;
      schema_version?: string;
        };
        Update: {
      id?: string | null;
      user_id?: string;
      subject_type?: string;
      subject_id?: string;
      flag?: string;
      severity?: string;
      details?: Json;
      backfill_version?: string | null;
      detected_at?: string;
      schema_version?: string;
        };
        Relationships: [];
      };
      prop_engine_snapshots: {
        Row: {
      id: string | null;
      user_id: string;
      challenge_id: string;
      calculation_version: string;
      rule_set_version: string;
      input_revision: string;
      calculated_at: string;
      status: string;
      payload: Json;
      confidence: Json;
      limitations: Json;
      readiness_model_version: string | null;
      confidence_policy_version: string;
      fixture_contract_version: string | null;
      backfill_version: string | null;
      migration_plan_version: string | null;
      schema_version: string;
      created_at: string;
        };
        Insert: {
      id?: string | null;
      user_id: string;
      challenge_id: string;
      calculation_version: string;
      rule_set_version: string;
      input_revision: string;
      calculated_at?: string;
      status: string;
      payload?: Json;
      confidence: Json;
      limitations?: Json;
      readiness_model_version?: string | null;
      confidence_policy_version: string;
      fixture_contract_version?: string | null;
      backfill_version?: string | null;
      migration_plan_version?: string | null;
      schema_version?: string;
      created_at?: string;
        };
        Update: {
      id?: string | null;
      user_id?: string;
      challenge_id?: string;
      calculation_version?: string;
      rule_set_version?: string;
      input_revision?: string;
      calculated_at?: string;
      status?: string;
      payload?: Json;
      confidence?: Json;
      limitations?: Json;
      readiness_model_version?: string | null;
      confidence_policy_version?: string;
      fixture_contract_version?: string | null;
      backfill_version?: string | null;
      migration_plan_version?: string | null;
      schema_version?: string;
      created_at?: string;
        };
        Relationships: [];
      };
      prop_executions: {
        Row: {
      id: string;
      user_id: string;
      challenge_id: string | null;
      account_id: string | null;
      trade_client_id: string | null;
      occurred_at: string;
      broker_sequence: number | null;
      realized_pnl_minor: number | null;
      fees_minor: number | null;
      contracts: number | null;
      voided: boolean;
      corrects_event_id: string | null;
      source: string;
      schema_version: string;
      created_at: string;
        };
        Insert: {
      id?: string;
      user_id: string;
      challenge_id?: string | null;
      account_id?: string | null;
      trade_client_id?: string | null;
      occurred_at?: string;
      broker_sequence?: number | null;
      realized_pnl_minor?: number | null;
      fees_minor?: number | null;
      contracts?: number | null;
      voided?: boolean;
      corrects_event_id?: string | null;
      source: string;
      schema_version?: string;
      created_at?: string;
        };
        Update: {
      id?: string;
      user_id?: string;
      challenge_id?: string | null;
      account_id?: string | null;
      trade_client_id?: string | null;
      occurred_at?: string;
      broker_sequence?: number | null;
      realized_pnl_minor?: number | null;
      fees_minor?: number | null;
      contracts?: number | null;
      voided?: boolean;
      corrects_event_id?: string | null;
      source?: string;
      schema_version?: string;
      created_at?: string;
        };
        Relationships: [];
      };
      prop_os_user_preferences: {
        Row: {
      user_id: string | null;
      default_account_id: string | null;
      updated_at: string;
      schema_version: string;
        };
        Insert: {
      user_id?: string | null;
      default_account_id?: string | null;
      updated_at?: string;
      schema_version?: string;
        };
        Update: {
      user_id?: string | null;
      default_account_id?: string | null;
      updated_at?: string;
      schema_version?: string;
        };
        Relationships: [];
      };
      prop_score_snapshots: {
        Row: {
      id: string | null;
      user_id: string;
      challenge_id: string;
      calculation_version: string;
      rule_set_version: string;
      input_revision: string;
      calculated_at: string;
      status: string;
      payload: Json;
      confidence: Json;
      limitations: Json;
      readiness_model_version: string | null;
      confidence_policy_version: string;
      fixture_contract_version: string | null;
      backfill_version: string | null;
      migration_plan_version: string | null;
      schema_version: string;
      created_at: string;
        };
        Insert: {
      id?: string | null;
      user_id: string;
      challenge_id: string;
      calculation_version: string;
      rule_set_version: string;
      input_revision: string;
      calculated_at?: string;
      status: string;
      payload?: Json;
      confidence: Json;
      limitations?: Json;
      readiness_model_version?: string | null;
      confidence_policy_version: string;
      fixture_contract_version?: string | null;
      backfill_version?: string | null;
      migration_plan_version?: string | null;
      schema_version?: string;
      created_at?: string;
        };
        Update: {
      id?: string | null;
      user_id?: string;
      challenge_id?: string;
      calculation_version?: string;
      rule_set_version?: string;
      input_revision?: string;
      calculated_at?: string;
      status?: string;
      payload?: Json;
      confidence?: Json;
      limitations?: Json;
      readiness_model_version?: string | null;
      confidence_policy_version?: string;
      fixture_contract_version?: string | null;
      backfill_version?: string | null;
      migration_plan_version?: string | null;
      schema_version?: string;
      created_at?: string;
        };
        Relationships: [];
      };
      prop_trade_assignments: {
        Row: {
      id: string | null;
      user_id: string;
      trade_client_id: string;
      account_id: string | null;
      challenge_id: string | null;
      assignment_state: string;
      assigned_at: string | null;
      assigned_by: string | null;
      provenance: Json;
      schema_version: string;
      created_at: string;
      updated_at: string;
        };
        Insert: {
      id?: string | null;
      user_id: string;
      trade_client_id: string;
      account_id?: string | null;
      challenge_id?: string | null;
      assignment_state: string;
      assigned_at?: string | null;
      assigned_by?: string | null;
      provenance?: Json;
      schema_version?: string;
      created_at?: string;
      updated_at?: string;
        };
        Update: {
      id?: string | null;
      user_id?: string;
      trade_client_id?: string;
      account_id?: string | null;
      challenge_id?: string | null;
      assignment_state?: string;
      assigned_at?: string | null;
      assigned_by?: string | null;
      provenance?: Json;
      schema_version?: string;
      created_at?: string;
      updated_at?: string;
        };
        Relationships: [];
      };
      prop_violation_records: {
        Row: {
      id: string | null;
      user_id: string;
      challenge_id: string;
      code: string;
      at: string;
      trade_client_id: string | null;
      severity: string;
      irreversible: boolean;
      cleared_by_event_id: string | null;
      schema_version: string;
      created_at: string;
        };
        Insert: {
      id?: string | null;
      user_id: string;
      challenge_id: string;
      code: string;
      at: string;
      trade_client_id?: string | null;
      severity: string;
      irreversible: boolean;
      cleared_by_event_id?: string | null;
      schema_version?: string;
      created_at?: string;
        };
        Update: {
      id?: string | null;
      user_id?: string;
      challenge_id?: string;
      code?: string;
      at?: string;
      trade_client_id?: string | null;
      severity?: string;
      irreversible?: boolean;
      cleared_by_event_id?: string | null;
      schema_version?: string;
      created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      prop_os_forbid_mutation: { Args: Record<string, never>; Returns: unknown };
      prop_os_forbid_delete: { Args: Record<string, never>; Returns: unknown };
      prop_os_enforce_challenge_account_owner: { Args: Record<string, never>; Returns: unknown };
      prop_os_enforce_assignment_owner: { Args: Record<string, never>; Returns: unknown };
      prop_os_enforce_challenge_no_silent_overwrite: { Args: Record<string, never>; Returns: unknown };
      prop_os_enforce_pref_default_owner: { Args: Record<string, never>; Returns: unknown };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type PropOsTableName = keyof PropOsDatabase["public"]["Tables"];
