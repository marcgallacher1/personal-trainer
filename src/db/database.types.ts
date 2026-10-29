export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bodyweight_logs: {
        Row: {
          created_at: string
          date: string
          deleted_at: string | null
          id: string
          kg: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          deleted_at?: string | null
          id?: string
          kg: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          date?: string
          deleted_at?: string | null
          id?: string
          kg?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cardio_entries: {
        Row: {
          activity: string
          avg_hr: number | null
          calories: number | null
          completed_at: string
          created_at: string
          deleted_at: string | null
          distance_km: number | null
          duration_seconds: number
          id: string
          notes: string | null
          order: number
          session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity: string
          avg_hr?: number | null
          calories?: number | null
          completed_at?: string
          created_at?: string
          deleted_at?: string | null
          distance_km?: number | null
          duration_seconds: number
          id?: string
          notes?: string | null
          order?: number
          session_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          activity?: string
          avg_hr?: number | null
          calories?: number | null
          completed_at?: string
          created_at?: string
          deleted_at?: string | null
          distance_km?: number | null
          duration_seconds?: number
          id?: string
          notes?: string | null
          order?: number
          session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cardio_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_muscles: {
        Row: {
          deleted_at: string | null
          exercise_id: string
          muscle_id: string
          updated_at: string
          user_id: string | null
          weight: number
        }
        Insert: {
          deleted_at?: string | null
          exercise_id: string
          muscle_id: string
          updated_at?: string
          user_id?: string | null
          weight: number
        }
        Update: {
          deleted_at?: string | null
          exercise_id?: string
          muscle_id?: string
          updated_at?: string
          user_id?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "exercise_muscles_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_muscles_muscle_id_fkey"
            columns: ["muscle_id"]
            isOneToOne: false
            referencedRelation: "muscles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string
          default_rest_seconds: number
          deleted_at: string | null
          equipment: string
          id: string
          is_compound: boolean
          is_custom: boolean
          log_type: string
          name: string
          notes: string | null
          pattern: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          default_rest_seconds?: number
          deleted_at?: string | null
          equipment: string
          id?: string
          is_compound?: boolean
          is_custom?: boolean
          log_type?: string
          name: string
          notes?: string | null
          pattern: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          default_rest_seconds?: number
          deleted_at?: string | null
          equipment?: string
          id?: string
          is_compound?: boolean
          is_custom?: boolean
          log_type?: string
          name?: string
          notes?: string | null
          pattern?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      muscle_targets: {
        Row: {
          created_at: string
          deleted_at: string | null
          max_sets: number
          min_sets: number
          muscle_id: string
          priority: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          max_sets?: number
          min_sets?: number
          muscle_id: string
          priority?: boolean
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          max_sets?: number
          min_sets?: number
          muscle_id?: string
          priority?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "muscle_targets_muscle_id_fkey"
            columns: ["muscle_id"]
            isOneToOne: false
            referencedRelation: "muscles"
            referencedColumns: ["id"]
          },
        ]
      }
      muscles: {
        Row: {
          body_side: string
          id: string
          name: string
          region: string
          sort_order: number
        }
        Insert: {
          body_side: string
          id: string
          name: string
          region: string
          sort_order?: number
        }
        Update: {
          body_side?: string
          id?: string
          name?: string
          region?: string
          sort_order?: number
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          error: string | null
          id: string
          idempotency_key: string
          payload: Json | null
          sent_at: string
          status: string
          type: string
          user_id: string
        }
        Insert: {
          error?: string | null
          id?: string
          idempotency_key: string
          payload?: Json | null
          sent_at?: string
          status: string
          type: string
          user_id: string
        }
        Update: {
          error?: string | null
          id?: string
          idempotency_key?: string
          payload?: Json | null
          sent_at?: string
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_rules: {
        Row: {
          conditions_json: Json
          created_at: string
          custom_messages: string[]
          deleted_at: string | null
          enabled: boolean
          followups_json: Json
          id: string
          paused_until: string | null
          times_json: Json
          timing_mode: string
          tone: string
          type: string
          tz: string
          updated_at: string
          user_id: string
          weekdays: number[]
        }
        Insert: {
          conditions_json?: Json
          created_at?: string
          custom_messages?: string[]
          deleted_at?: string | null
          enabled?: boolean
          followups_json?: Json
          id?: string
          paused_until?: string | null
          times_json?: Json
          timing_mode?: string
          tone?: string
          type: string
          tz?: string
          updated_at?: string
          user_id?: string
          weekdays?: number[]
        }
        Update: {
          conditions_json?: Json
          created_at?: string
          custom_messages?: string[]
          deleted_at?: string | null
          enabled?: boolean
          followups_json?: Json
          id?: string
          paused_until?: string | null
          times_json?: Json
          timing_mode?: string
          tone?: string
          type?: string
          tz?: string
          updated_at?: string
          user_id?: string
          weekdays?: number[]
        }
        Relationships: []
      }
      plan_changes: {
        Row: {
          created_at: string
          deleted_at: string | null
          diff_json: Json
          id: string
          kind: string
          plan_id: string
          proposed_at: string
          resolved_at: string | null
          status: string
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          diff_json?: Json
          id?: string
          kind: string
          plan_id: string
          proposed_at?: string
          resolved_at?: string | null
          status?: string
          summary: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          diff_json?: Json
          id?: string
          kind?: string
          plan_id?: string
          proposed_at?: string
          resolved_at?: string | null
          status?: string
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_changes_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_exercises: {
        Row: {
          alternatives: string[]
          created_at: string
          deleted_at: string | null
          exercise_id: string
          group_id: string | null
          group_type: string | null
          id: string
          notes: string | null
          order: number
          plan_session_id: string
          progression_config: Json
          progression_rule: string
          rest_seconds: number | null
          tempo: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alternatives?: string[]
          created_at?: string
          deleted_at?: string | null
          exercise_id: string
          group_id?: string | null
          group_type?: string | null
          id?: string
          notes?: string | null
          order?: number
          plan_session_id: string
          progression_config?: Json
          progression_rule?: string
          rest_seconds?: number | null
          tempo?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          alternatives?: string[]
          created_at?: string
          deleted_at?: string | null
          exercise_id?: string
          group_id?: string | null
          group_type?: string | null
          id?: string
          notes?: string | null
          order?: number
          plan_session_id?: string
          progression_config?: Json
          progression_rule?: string
          rest_seconds?: number | null
          tempo?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_exercises_plan_session_id_fkey"
            columns: ["plan_session_id"]
            isOneToOne: false
            referencedRelation: "plan_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_ratings: {
        Row: {
          created_at: string
          deleted_at: string | null
          fixes_json: Json
          gaps_json: Json
          id: string
          plan_id: string
          score: number
          source: string
          subscores_json: Json
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          fixes_json?: Json
          gaps_json?: Json
          id?: string
          plan_id: string
          score: number
          source?: string
          subscores_json: Json
          updated_at?: string
          user_id?: string
          version: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          fixes_json?: Json
          gaps_json?: Json
          id?: string
          plan_id?: string
          score?: number
          source?: string
          subscores_json?: Json
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_ratings_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_schedule: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          plan_id: string
          plan_session_id: string | null
          planned_time: string | null
          rotation_index: number | null
          tz: string
          updated_at: string
          user_id: string
          week_of_block: number | null
          weekday: number | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          plan_id: string
          plan_session_id?: string | null
          planned_time?: string | null
          rotation_index?: number | null
          tz?: string
          updated_at?: string
          user_id?: string
          week_of_block?: number | null
          weekday?: number | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          plan_id?: string
          plan_session_id?: string | null
          planned_time?: string | null
          rotation_index?: number | null
          tz?: string
          updated_at?: string
          user_id?: string
          week_of_block?: number | null
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_schedule_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_schedule_plan_session_id_fkey"
            columns: ["plan_session_id"]
            isOneToOne: false
            referencedRelation: "plan_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_sessions: {
        Row: {
          colour: string | null
          created_at: string
          deleted_at: string | null
          emoji: string | null
          est_minutes: number | null
          id: string
          name: string
          notes: string | null
          order: number
          plan_id: string
          updated_at: string
          user_id: string
          warmup_notes: string | null
        }
        Insert: {
          colour?: string | null
          created_at?: string
          deleted_at?: string | null
          emoji?: string | null
          est_minutes?: number | null
          id?: string
          name: string
          notes?: string | null
          order?: number
          plan_id: string
          updated_at?: string
          user_id?: string
          warmup_notes?: string | null
        }
        Update: {
          colour?: string | null
          created_at?: string
          deleted_at?: string | null
          emoji?: string | null
          est_minutes?: number | null
          id?: string
          name?: string
          notes?: string | null
          order?: number
          plan_id?: string
          updated_at?: string
          user_id?: string
          warmup_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_set_targets: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          order: number
          pct_e1rm: number | null
          plan_exercise_id: string
          reps_max: number | null
          reps_min: number | null
          set_type: string
          target_rir: number | null
          target_rpe: number | null
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          order?: number
          pct_e1rm?: number | null
          plan_exercise_id: string
          reps_max?: number | null
          reps_min?: number | null
          set_type?: string
          target_rir?: number | null
          target_rpe?: number | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          order?: number
          pct_e1rm?: number | null
          plan_exercise_id?: string
          reps_max?: number | null
          reps_min?: number | null
          set_type?: string
          target_rir?: number | null
          target_rpe?: number | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_set_targets_plan_exercise_id_fkey"
            columns: ["plan_exercise_id"]
            isOneToOne: false
            referencedRelation: "plan_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_versions: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          note: string | null
          plan_id: string
          snapshot_json: Json
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          note?: string | null
          plan_id: string
          snapshot_json: Json
          updated_at?: string
          user_id?: string
          version: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          note?: string | null
          plan_id?: string
          snapshot_json?: Json
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_versions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          archived: boolean
          block_start_date: string | null
          block_weeks: number | null
          created_at: string
          current_version: number
          deleted_at: string | null
          deload_week: number | null
          goal: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          rotation_anchor_date: string | null
          schedule_mode: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          block_start_date?: string | null
          block_weeks?: number | null
          created_at?: string
          current_version?: number
          deleted_at?: string | null
          deload_week?: number | null
          goal?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          rotation_anchor_date?: string | null
          schedule_mode?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          archived?: boolean
          block_start_date?: string | null
          block_weeks?: number | null
          created_at?: string
          current_version?: number
          deleted_at?: string | null
          deload_week?: number | null
          goal?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          rotation_anchor_date?: string | null
          schedule_mode?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bodyweight_kg: number | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          experience_level: string | null
          goal: string | null
          id: string
          notifications_paused_until: string | null
          onboarded_at: string | null
          protein_g_per_kg: number
          quiet_end: string | null
          quiet_start: string | null
          settings: Json
          timezone: string
          units: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bodyweight_kg?: number | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          experience_level?: string | null
          goal?: string | null
          id: string
          notifications_paused_until?: string | null
          onboarded_at?: string | null
          protein_g_per_kg?: number
          quiet_end?: string | null
          quiet_start?: string | null
          settings?: Json
          timezone?: string
          units?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bodyweight_kg?: number | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          experience_level?: string | null
          goal?: string | null
          id?: string
          notifications_paused_until?: string | null
          onboarded_at?: string | null
          protein_g_per_kg?: number
          quiet_end?: string | null
          quiet_start?: string | null
          settings?: Json
          timezone?: string
          units?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      protein_logs: {
        Row: {
          created_at: string
          date: string
          deleted_at: string | null
          grams: number
          id: string
          label: string | null
          logged_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          deleted_at?: string | null
          grams: number
          id?: string
          label?: string | null
          logged_at?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          date?: string
          deleted_at?: string | null
          grams?: number
          id?: string
          label?: string | null
          logged_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          deleted_at: string | null
          endpoint: string
          id: string
          last_success_at: string | null
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          deleted_at?: string | null
          endpoint: string
          id?: string
          last_success_at?: string | null
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Update: {
          auth?: string
          created_at?: string
          deleted_at?: string | null
          endpoint?: string
          id?: string
          last_success_at?: string | null
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      session_exercises: {
        Row: {
          created_at: string
          deleted_at: string | null
          exercise_id: string
          group_id: string | null
          group_type: string | null
          id: string
          notes: string | null
          order: number
          plan_exercise_id: string | null
          rest_seconds: number | null
          session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          exercise_id: string
          group_id?: string | null
          group_type?: string | null
          id?: string
          notes?: string | null
          order?: number
          plan_exercise_id?: string | null
          rest_seconds?: number | null
          session_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          exercise_id?: string
          group_id?: string | null
          group_type?: string | null
          id?: string
          notes?: string | null
          order?: number
          plan_exercise_id?: string | null
          rest_seconds?: number | null
          session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercises_plan_exercise_id_fkey"
            columns: ["plan_exercise_id"]
            isOneToOne: false
            referencedRelation: "plan_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercises_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          deleted_at: string | null
          ended_at: string | null
          id: string
          name: string | null
          notes: string | null
          plan_id: string | null
          plan_session_id: string | null
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          ended_at?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          plan_id?: string | null
          plan_session_id?: string | null
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          ended_at?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          plan_id?: string | null
          plan_session_id?: string | null
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_plan_session_id_fkey"
            columns: ["plan_session_id"]
            isOneToOne: false
            referencedRelation: "plan_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sets: {
        Row: {
          completed_at: string
          created_at: string
          deleted_at: string | null
          duration_seconds: number | null
          exercise_id: string
          id: string
          is_pr: boolean
          order: number
          plan_set_target_id: string | null
          reps: number
          rir: number | null
          rpe: number | null
          session_exercise_id: string | null
          session_id: string
          set_type: string
          updated_at: string
          user_id: string
          weight_kg: number
        }
        Insert: {
          completed_at?: string
          created_at?: string
          deleted_at?: string | null
          duration_seconds?: number | null
          exercise_id: string
          id?: string
          is_pr?: boolean
          order?: number
          plan_set_target_id?: string | null
          reps: number
          rir?: number | null
          rpe?: number | null
          session_exercise_id?: string | null
          session_id: string
          set_type?: string
          updated_at?: string
          user_id?: string
          weight_kg?: number
        }
        Update: {
          completed_at?: string
          created_at?: string
          deleted_at?: string | null
          duration_seconds?: number | null
          exercise_id?: string
          id?: string
          is_pr?: boolean
          order?: number
          plan_set_target_id?: string | null
          reps?: number
          rir?: number | null
          rpe?: number | null
          session_exercise_id?: string | null
          session_id?: string
          set_type?: string
          updated_at?: string
          user_id?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sets_plan_set_target_id_fkey"
            columns: ["plan_set_target_id"]
            isOneToOne: false
            referencedRelation: "plan_set_targets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sets_session_exercise_id_fkey"
            columns: ["session_exercise_id"]
            isOneToOne: false
            referencedRelation: "session_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_reports: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          iso_week: string
          llm_summary_text: string | null
          recommendations_json: Json
          stats_json: Json
          summary_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          iso_week: string
          llm_summary_text?: string | null
          recommendations_json?: Json
          stats_json: Json
          summary_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          iso_week?: string
          llm_summary_text?: string | null
          recommendations_json?: Json
          stats_json?: Json
          summary_text?: string | null
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
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

