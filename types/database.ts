export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      hotels: {
        Row: {
          id: string;
          name: string;
          slug: string;
          city: string | null;
          booking_url: string | null;
          website_url: string | null;
          instagram_url: string | null;
          whatsapp_number: string | null;
          wifi_name: string | null;
          wifi_password: string | null;
          breakfast_hours: string | null;
          checkin_time: string | null;
          checkout_time: string | null;
          logo_url: string | null;
          theme_preset: string | null;
          theme_primary_color: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          city?: string | null;
          booking_url?: string | null;
          website_url?: string | null;
          instagram_url?: string | null;
          whatsapp_number?: string | null;
          wifi_name?: string | null;
          wifi_password?: string | null;
          breakfast_hours?: string | null;
          checkin_time?: string | null;
          checkout_time?: string | null;
          logo_url?: string | null;
          theme_preset?: string | null;
          theme_primary_color?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          city?: string | null;
          booking_url?: string | null;
          website_url?: string | null;
          instagram_url?: string | null;
          whatsapp_number?: string | null;
          wifi_name?: string | null;
          wifi_password?: string | null;
          breakfast_hours?: string | null;
          checkin_time?: string | null;
          checkout_time?: string | null;
          logo_url?: string | null;
          theme_preset?: string | null;
          theme_primary_color?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };

      hotel_sections: {
        Row: {
          id: string;
          hotel_id: string;
          title: string;
          icon: string | null;
          content: string | null;
          cta: string | null;
          url: string | null;
          category: string | null;
          enabled: boolean | null;
          sort_order: number | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          hotel_id: string;
          title: string;
          icon?: string | null;
          content?: string | null;
          cta?: string | null;
          url?: string | null;
          category?: string | null;
          enabled?: boolean | null;
          sort_order?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          hotel_id?: string;
          title?: string;
          icon?: string | null;
          content?: string | null;
          cta?: string | null;
          url?: string | null;
          category?: string | null;
          enabled?: boolean | null;
          sort_order?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'hotel_sections_hotel_id_fkey';
            columns: ['hotel_id'];
            isOneToOne: false;
            referencedRelation: 'hotels';
            referencedColumns: ['id'];
          }
        ];
      };

      hotel_departments: {
        Row: {
          id: string;
          hotel_id: string;
          name: string;
          description: string | null;
          hours: string | null;
          action: string | null;
          url: string | null;
          enabled: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          hotel_id: string;
          name: string;
          description?: string | null;
          hours?: string | null;
          action?: string | null;
          url?: string | null;
          enabled?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          hotel_id?: string;
          name?: string;
          description?: string | null;
          hours?: string | null;
          action?: string | null;
          url?: string | null;
          enabled?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'hotel_departments_hotel_id_fkey';
            columns: ['hotel_id'];
            isOneToOne: false;
            referencedRelation: 'hotels';
            referencedColumns: ['id'];
          }
        ];
      };

      hotel_policies: {
        Row: {
          id: string;
          hotel_id: string;
          title: string;
          description: string | null;
          enabled: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          hotel_id: string;
          title: string;
          description?: string | null;
          enabled?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          hotel_id?: string;
          title?: string;
          description?: string | null;
          enabled?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'hotel_policies_hotel_id_fkey';
            columns: ['hotel_id'];
            isOneToOne: false;
            referencedRelation: 'hotels';
            referencedColumns: ['id'];
          }
        ];
      };

      hotel_analytics_events: {
        Row: {
          id: string;
          hotel_id: string;
          hotel_slug: string;
          event_type: string;
          session_id: string | null;
          language: string | null;
          target_url: string | null;
          department_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          hotel_id: string;
          hotel_slug: string;
          event_type: string;
          session_id?: string | null;
          language?: string | null;
          target_url?: string | null;
          department_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          hotel_id?: string;
          hotel_slug?: string;
          event_type?: string;
          session_id?: string | null;
          language?: string | null;
          target_url?: string | null;
          department_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'hotel_analytics_events_department_id_fkey';
            columns: ['department_id'];
            isOneToOne: false;
            referencedRelation: 'hotel_departments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'hotel_analytics_events_hotel_id_fkey';
            columns: ['hotel_id'];
            isOneToOne: false;
            referencedRelation: 'hotels';
            referencedColumns: ['id'];
          }
        ];
      };

      hotel_section_translations: {
        Row: {
          id: string;
          section_id: string;
          language: string;
          title: string | null;
          content: string | null;
          cta: string | null;
          category: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          section_id: string;
          language: string;
          title?: string | null;
          content?: string | null;
          cta?: string | null;
          category?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          section_id?: string;
          language?: string;
          title?: string | null;
          content?: string | null;
          cta?: string | null;
          category?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'hotel_section_translations_section_id_fkey';
            columns: ['section_id'];
            isOneToOne: false;
            referencedRelation: 'hotel_sections';
            referencedColumns: ['id'];
          }
        ];
      };

      hotel_department_translations: {
        Row: {
          id: string;
          department_id: string;
          language: string;
          name: string | null;
          description: string | null;
          action: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          department_id: string;
          language: string;
          name?: string | null;
          description?: string | null;
          action?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          department_id?: string;
          language?: string;
          name?: string | null;
          description?: string | null;
          action?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'hotel_department_translations_department_id_fkey';
            columns: ['department_id'];
            isOneToOne: false;
            referencedRelation: 'hotel_departments';
            referencedColumns: ['id'];
          }
        ];
      };

      hotel_policy_translations: {
        Row: {
          id: string;
          policy_id: string;
          language: string;
          title: string | null;
          description: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          policy_id: string;
          language: string;
          title?: string | null;
          description?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          policy_id?: string;
          language?: string;
          title?: string | null;
          description?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'hotel_policy_translations_policy_id_fkey';
            columns: ['policy_id'];
            isOneToOne: false;
            referencedRelation: 'hotel_policies';
            referencedColumns: ['id'];
          }
        ];
      };

      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          role: string | null;
          hotel_id: string | null;
          is_active: boolean;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          role?: string | null;
          hotel_id?: string | null;
          is_active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          role?: string | null;
          hotel_id?: string | null;
          is_active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_hotel_id_fkey';
            columns: ['hotel_id'];
            isOneToOne: false;
            referencedRelation: 'hotels';
            referencedColumns: ['id'];
          }
        ];
      };
    };

    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
