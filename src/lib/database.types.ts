export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          idea_id: string | null;
          new_value: Json | null;
          old_value: Json | null;
          summary: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          idea_id?: string | null;
          new_value?: Json | null;
          old_value?: Json | null;
          summary?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          idea_id?: string | null;
          new_value?: Json | null;
          old_value?: Json | null;
          summary?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'activity_log_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_log_idea_id_fkey';
            columns: ['idea_id'];
            isOneToOne: false;
            referencedRelation: 'ideas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_log_idea_id_fkey';
            columns: ['idea_id'];
            isOneToOne: false;
            referencedRelation: 'ideas_live';
            referencedColumns: ['id'];
          },
        ];
      };
      allowed_emails: {
        Row: {
          changed_at: string;
          changed_by: string | null;
          email: string;
          invited_at: string;
          invited_by: string | null;
          status: Database['public']['Enums']['allowed_email_status'];
        };
        Insert: {
          changed_at?: string;
          changed_by?: string | null;
          email: string;
          invited_at?: string;
          invited_by?: string | null;
          status?: Database['public']['Enums']['allowed_email_status'];
        };
        Update: {
          changed_at?: string;
          changed_by?: string | null;
          email?: string;
          invited_at?: string;
          invited_by?: string | null;
          status?: Database['public']['Enums']['allowed_email_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'allowed_emails_changed_by_fkey';
            columns: ['changed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'allowed_emails_invited_by_fkey';
            columns: ['invited_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      app_settings: {
        Row: {
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: string;
        };
        Insert: {
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value: string;
        };
        Update: {
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'app_settings_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      categories: {
        Row: {
          color: string | null;
          id: string;
          is_active: boolean;
          name: string;
          sort_order: number;
        };
        Insert: {
          color?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          sort_order?: number;
        };
        Update: {
          color?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      decisions: {
        Row: {
          assignee_id: string | null;
          basis: string | null;
          content: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          deleted_by: string | null;
          due_date: string | null;
          id: string;
          idea_id: string;
          new_status: Database['public']['Enums']['idea_status'] | null;
          next_step: string | null;
          reason: string | null;
        };
        Insert: {
          assignee_id?: string | null;
          basis?: string | null;
          content: string;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          due_date?: string | null;
          id?: string;
          idea_id: string;
          new_status?: Database['public']['Enums']['idea_status'] | null;
          next_step?: string | null;
          reason?: string | null;
        };
        Update: {
          assignee_id?: string | null;
          basis?: string | null;
          content?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          due_date?: string | null;
          id?: string;
          idea_id?: string;
          new_status?: Database['public']['Enums']['idea_status'] | null;
          next_step?: string | null;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'decisions_assignee_id_fkey';
            columns: ['assignee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'decisions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'decisions_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'decisions_idea_id_fkey';
            columns: ['idea_id'];
            isOneToOne: false;
            referencedRelation: 'ideas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'decisions_idea_id_fkey';
            columns: ['idea_id'];
            isOneToOne: false;
            referencedRelation: 'ideas_live';
            referencedColumns: ['id'];
          },
        ];
      };
      files: {
        Row: {
          created_at: string;
          id: string;
          idea_id: string;
          mime_type: string;
          original_name: string;
          size_bytes: number;
          storage_path: string;
          uploaded_by: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          idea_id: string;
          mime_type: string;
          original_name: string;
          size_bytes: number;
          storage_path: string;
          uploaded_by?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          idea_id?: string;
          mime_type?: string;
          original_name?: string;
          size_bytes?: number;
          storage_path?: string;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'files_idea_id_fkey';
            columns: ['idea_id'];
            isOneToOne: false;
            referencedRelation: 'ideas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'files_idea_id_fkey';
            columns: ['idea_id'];
            isOneToOne: false;
            referencedRelation: 'ideas_live';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'files_uploaded_by_fkey';
            columns: ['uploaded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      idea_sections: {
        Row: {
          content: string;
          id: string;
          idea_id: string;
          section_key: Database['public']['Enums']['section_key'];
          updated_at: string;
          updated_by: string;
        };
        Insert: {
          content: string;
          id?: string;
          idea_id: string;
          section_key: Database['public']['Enums']['section_key'];
          updated_at?: string;
          updated_by: string;
        };
        Update: {
          content?: string;
          id?: string;
          idea_id?: string;
          section_key?: Database['public']['Enums']['section_key'];
          updated_at?: string;
          updated_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'idea_sections_idea_id_fkey';
            columns: ['idea_id'];
            isOneToOne: false;
            referencedRelation: 'ideas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'idea_sections_idea_id_fkey';
            columns: ['idea_id'];
            isOneToOne: false;
            referencedRelation: 'ideas_live';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'idea_sections_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      idea_versions: {
        Row: {
          change_type: Database['public']['Enums']['version_change_type'];
          created_at: string;
          created_by: string;
          id: string;
          idea_id: string;
          note: string | null;
          restored_from_version: number | null;
          snapshot: Json;
          version_no: number;
        };
        Insert: {
          change_type: Database['public']['Enums']['version_change_type'];
          created_at?: string;
          created_by: string;
          id?: string;
          idea_id: string;
          note?: string | null;
          restored_from_version?: number | null;
          snapshot: Json;
          version_no: number;
        };
        Update: {
          change_type?: Database['public']['Enums']['version_change_type'];
          created_at?: string;
          created_by?: string;
          id?: string;
          idea_id?: string;
          note?: string | null;
          restored_from_version?: number | null;
          snapshot?: Json;
          version_no?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'idea_versions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'idea_versions_idea_id_fkey';
            columns: ['idea_id'];
            isOneToOne: false;
            referencedRelation: 'ideas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'idea_versions_idea_id_fkey';
            columns: ['idea_id'];
            isOneToOne: false;
            referencedRelation: 'ideas_live';
            referencedColumns: ['id'];
          },
        ];
      };
      ideas: {
        Row: {
          category_id: string | null;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          deleted_by: string | null;
          id: string;
          next_step: string | null;
          next_step_due: string | null;
          owner_id: string | null;
          status: Database['public']['Enums']['idea_status'];
          summary: string;
          title: string;
          updated_at: string;
          updated_by: string;
          version_no: number;
        };
        Insert: {
          category_id?: string | null;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          id?: string;
          next_step?: string | null;
          next_step_due?: string | null;
          owner_id?: string | null;
          status?: Database['public']['Enums']['idea_status'];
          summary: string;
          title: string;
          updated_at?: string;
          updated_by: string;
          version_no?: number;
        };
        Update: {
          category_id?: string | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          id?: string;
          next_step?: string | null;
          next_step_due?: string | null;
          owner_id?: string | null;
          status?: Database['public']['Enums']['idea_status'];
          summary?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string;
          version_no?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'ideas_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ideas_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ideas_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ideas_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ideas_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      items: {
        Row: {
          answer: string | null;
          answered_at: string | null;
          answered_by: string | null;
          assignee_id: string | null;
          content: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          deleted_by: string | null;
          id: string;
          idea_id: string;
          parent_id: string | null;
          question_status: Database['public']['Enums']['question_status'] | null;
          type: Database['public']['Enums']['item_type'];
          updated_at: string;
          updated_by: string;
        };
        Insert: {
          answer?: string | null;
          answered_at?: string | null;
          answered_by?: string | null;
          assignee_id?: string | null;
          content: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          id?: string;
          idea_id: string;
          parent_id?: string | null;
          question_status?: Database['public']['Enums']['question_status'] | null;
          type: Database['public']['Enums']['item_type'];
          updated_at?: string;
          updated_by?: string;
        };
        Update: {
          answer?: string | null;
          answered_at?: string | null;
          answered_by?: string | null;
          assignee_id?: string | null;
          content?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          id?: string;
          idea_id?: string;
          parent_id?: string | null;
          question_status?: Database['public']['Enums']['question_status'] | null;
          type?: Database['public']['Enums']['item_type'];
          updated_at?: string;
          updated_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'items_answered_by_fkey';
            columns: ['answered_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'items_assignee_id_fkey';
            columns: ['assignee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'items_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'items_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'items_idea_id_fkey';
            columns: ['idea_id'];
            isOneToOne: false;
            referencedRelation: 'ideas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'items_idea_id_fkey';
            columns: ['idea_id'];
            isOneToOne: false;
            referencedRelation: 'ideas_live';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'items_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'items_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'items_live';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'items_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          display_name: string;
          email: string;
          id: string;
          is_active: boolean;
          is_admin: boolean | null;
          joined_at: string;
          last_seen_at: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          display_name: string;
          email: string;
          id: string;
          is_active?: boolean;
          is_admin?: boolean | null;
          joined_at?: string;
          last_seen_at?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          display_name?: string;
          email?: string;
          id?: string;
          is_active?: boolean;
          is_admin?: boolean | null;
          joined_at?: string;
          last_seen_at?: string | null;
        };
        Relationships: [];
      };
      resources: {
        Row: {
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          deleted_by: string | null;
          description: string | null;
          file_id: string | null;
          id: string;
          idea_id: string;
          kind: Database['public']['Enums']['resource_kind'];
          relevance: string | null;
          title: string | null;
          url: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          description?: string | null;
          file_id?: string | null;
          id?: string;
          idea_id: string;
          kind: Database['public']['Enums']['resource_kind'];
          relevance?: string | null;
          title?: string | null;
          url?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          description?: string | null;
          file_id?: string | null;
          id?: string;
          idea_id?: string;
          kind?: Database['public']['Enums']['resource_kind'];
          relevance?: string | null;
          title?: string | null;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'resources_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'resources_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'resources_file_id_fkey';
            columns: ['file_id'];
            isOneToOne: false;
            referencedRelation: 'files';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'resources_idea_id_fkey';
            columns: ['idea_id'];
            isOneToOne: false;
            referencedRelation: 'ideas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'resources_idea_id_fkey';
            columns: ['idea_id'];
            isOneToOne: false;
            referencedRelation: 'ideas_live';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      decisions_live: {
        Row: {
          assignee_id: string | null;
          basis: string | null;
          content: string | null;
          created_at: string | null;
          created_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          due_date: string | null;
          id: string | null;
          idea_id: string | null;
          new_status: Database['public']['Enums']['idea_status'] | null;
          next_step: string | null;
          reason: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'decisions_assignee_id_fkey';
            columns: ['assignee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'decisions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'decisions_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'decisions_idea_id_fkey';
            columns: ['idea_id'];
            isOneToOne: false;
            referencedRelation: 'ideas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'decisions_idea_id_fkey';
            columns: ['idea_id'];
            isOneToOne: false;
            referencedRelation: 'ideas_live';
            referencedColumns: ['id'];
          },
        ];
      };
      ideas_live: {
        Row: {
          category_id: string | null;
          created_at: string | null;
          created_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          id: string | null;
          next_step: string | null;
          next_step_due: string | null;
          owner_id: string | null;
          status: Database['public']['Enums']['idea_status'] | null;
          summary: string | null;
          title: string | null;
          updated_at: string | null;
          updated_by: string | null;
          version_no: number | null;
        };
        Insert: {
          category_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          id?: string | null;
          next_step?: string | null;
          next_step_due?: string | null;
          owner_id?: string | null;
          status?: Database['public']['Enums']['idea_status'] | null;
          summary?: string | null;
          title?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
          version_no?: number | null;
        };
        Update: {
          category_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          id?: string | null;
          next_step?: string | null;
          next_step_due?: string | null;
          owner_id?: string | null;
          status?: Database['public']['Enums']['idea_status'] | null;
          summary?: string | null;
          title?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
          version_no?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ideas_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ideas_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ideas_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ideas_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ideas_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      items_live: {
        Row: {
          answer: string | null;
          answered_at: string | null;
          answered_by: string | null;
          assignee_id: string | null;
          content: string | null;
          created_at: string | null;
          created_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          id: string | null;
          idea_id: string | null;
          parent_id: string | null;
          question_status: Database['public']['Enums']['question_status'] | null;
          type: Database['public']['Enums']['item_type'] | null;
          updated_at: string | null;
          updated_by: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'items_answered_by_fkey';
            columns: ['answered_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'items_assignee_id_fkey';
            columns: ['assignee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'items_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'items_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'items_idea_id_fkey';
            columns: ['idea_id'];
            isOneToOne: false;
            referencedRelation: 'ideas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'items_idea_id_fkey';
            columns: ['idea_id'];
            isOneToOne: false;
            referencedRelation: 'ideas_live';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'items_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'items_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'items_live';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'items_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      resources_live: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          description: string | null;
          file_id: string | null;
          id: string | null;
          idea_id: string | null;
          kind: Database['public']['Enums']['resource_kind'] | null;
          relevance: string | null;
          title: string | null;
          url: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'resources_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'resources_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'resources_file_id_fkey';
            columns: ['file_id'];
            isOneToOne: false;
            referencedRelation: 'files';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'resources_idea_id_fkey';
            columns: ['idea_id'];
            isOneToOne: false;
            referencedRelation: 'ideas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'resources_idea_id_fkey';
            columns: ['idea_id'];
            isOneToOne: false;
            referencedRelation: 'ideas_live';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      apply_sections: {
        Args: { p_actor: string; p_idea_id: string; p_sections: Json };
        Returns: undefined;
      };
      check_email_allowed: { Args: { p_email: string }; Returns: boolean };
      create_idea: {
        Args: {
          p_category_id?: string;
          p_interesting?: string;
          p_summary: string;
          p_title: string;
        };
        Returns: string;
      };
      duplicate_idea: {
        Args: { p_idea_id: string; p_title: string };
        Returns: string;
      };
      idea_snapshot: { Args: { p_idea_id: string }; Returns: Json };
      invite_partner: { Args: { p_email: string }; Returns: undefined };
      is_member: { Args: never; Returns: boolean };
      log_activity: {
        Args: {
          p_action: string;
          p_actor?: string;
          p_entity_id: string;
          p_entity_type: string;
          p_idea_id: string;
          p_new?: Json;
          p_old?: Json;
          p_summary?: string;
        };
        Returns: undefined;
      };
      record_decision: {
        Args: {
          p_assignee_id?: string;
          p_basis?: string;
          p_content: string;
          p_due_date?: string;
          p_idea_id: string;
          p_new_status?: Database['public']['Enums']['idea_status'];
          p_next_step?: string;
          p_reason?: string;
        };
        Returns: string;
      };
      remove_partner: { Args: { p_email: string }; Returns: undefined };
      restore_idea: { Args: { p_idea_id: string }; Returns: undefined };
      restore_version: {
        Args: { p_idea_id: string; p_version_no: number };
        Returns: number;
      };
      save_idea: {
        Args: {
          p_category_id: string;
          p_expected_version: number;
          p_idea_id: string;
          p_sections?: Json;
          p_summary: string;
          p_title: string;
        };
        Returns: number;
      };
      set_idea_status: {
        Args: {
          p_idea_id: string;
          p_status: Database['public']['Enums']['idea_status'];
        };
        Returns: undefined;
      };
      touch_last_seen: { Args: never; Returns: undefined };
      trash_idea: { Args: { p_idea_id: string }; Returns: undefined };
    };
    Enums: {
      allowed_email_status: 'invited' | 'joined' | 'removed';
      idea_status: 'new' | 'discussion' | 'review' | 'approved' | 'paused' | 'dropped';
      item_type: 'thought' | 'question' | 'info';
      question_status: 'open' | 'in_review' | 'answered';
      resource_kind: 'link' | 'file';
      section_key:
        | 'audience'
        | 'problem'
        | 'value'
        | 'how_it_works'
        | 'existing_solutions'
        | 'opportunity'
        | 'revenue_model'
        | 'partners_suppliers'
        | 'costs_resources'
        | 'risks';
      version_change_type: 'create' | 'edit' | 'restore';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      allowed_email_status: ['invited', 'joined', 'removed'],
      idea_status: ['new', 'discussion', 'review', 'approved', 'paused', 'dropped'],
      item_type: ['thought', 'question', 'info'],
      question_status: ['open', 'in_review', 'answered'],
      resource_kind: ['link', 'file'],
      section_key: [
        'audience',
        'problem',
        'value',
        'how_it_works',
        'existing_solutions',
        'opportunity',
        'revenue_model',
        'partners_suppliers',
        'costs_resources',
        'risks',
      ],
      version_change_type: ['create', 'edit', 'restore'],
    },
  },
} as const;
