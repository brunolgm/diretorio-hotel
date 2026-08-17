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
          subdomain: string | null;
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
          hero_image_url: string | null;
          brand_code: string | null;
          platform_status: 'draft' | 'active' | 'suspended' | 'archived';
          theme_preset: string | null;
          theme_primary_color: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          subdomain?: string | null;
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
          hero_image_url?: string | null;
          brand_code?: string | null;
          platform_status?: 'draft' | 'active' | 'suspended' | 'archived';
          theme_preset?: string | null;
          theme_primary_color?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          subdomain?: string | null;
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
          hero_image_url?: string | null;
          brand_code?: string | null;
          platform_status?: 'draft' | 'active' | 'suspended' | 'archived';
          theme_preset?: string | null;
          theme_primary_color?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };

      platform_users: {
        Row: {
          user_id: string;
          role: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          role: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          role?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      platform_audit_log: {
        Row: {
          id: string;
          created_at: string;
          actor_user_id: string;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Json;
          request_id: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          actor_user_id: string;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          metadata?: Json;
          request_id?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          actor_user_id?: string;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          metadata?: Json;
          request_id?: string | null;
        };
        Relationships: [];
      };

      hotel_module_entitlements: {
        Row: { hotel_id: string; module_key: string; is_enabled: boolean; enabled_at: string | null; enabled_by: string | null; disabled_at: string | null; disabled_by: string | null; created_at: string; updated_at: string };
        Insert: { hotel_id: string; module_key: string; is_enabled?: boolean; enabled_at?: string | null; enabled_by?: string | null; disabled_at?: string | null; disabled_by?: string | null; created_at?: string; updated_at?: string };
        Update: { hotel_id?: string; module_key?: string; is_enabled?: boolean; enabled_at?: string | null; enabled_by?: string | null; disabled_at?: string | null; disabled_by?: string | null; created_at?: string; updated_at?: string };
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
          service_action_type: 'standard' | 'external_url' | 'room_restaurant_menu';
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
          service_action_type?: 'standard' | 'external_url' | 'room_restaurant_menu';
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
          service_action_type?: 'standard' | 'external_url' | 'room_restaurant_menu';
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

      hotel_announcements: {
        Row: {
          id: string;
          hotel_id: string;
          title: string;
          body: string | null;
          category: string;
          starts_at: string | null;
          ends_at: string | null;
          is_active: boolean;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          hotel_id: string;
          title: string;
          body?: string | null;
          category?: string;
          starts_at?: string | null;
          ends_at?: string | null;
          is_active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          hotel_id?: string;
          title?: string;
          body?: string | null;
          category?: string;
          starts_at?: string | null;
          ends_at?: string | null;
          is_active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'hotel_announcements_hotel_id_fkey';
            columns: ['hotel_id'];
            isOneToOne: false;
            referencedRelation: 'hotels';
            referencedColumns: ['id'];
          }
        ];
      };

      hotel_promotional_banners: {
        Row: {
          id: string;
          hotel_id: string;
          title: string;
          subtitle: string | null;
          image_url: string | null;
          cta_label: string | null;
          cta_url: string | null;
          starts_at: string | null;
          ends_at: string | null;
          is_active: boolean;
          display_order: number;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          hotel_id: string;
          title: string;
          subtitle?: string | null;
          image_url?: string | null;
          cta_label?: string | null;
          cta_url?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          is_active?: boolean;
          display_order?: number;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          hotel_id?: string;
          title?: string;
          subtitle?: string | null;
          image_url?: string | null;
          cta_label?: string | null;
          cta_url?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          is_active?: boolean;
          display_order?: number;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'hotel_promotional_banners_hotel_id_fkey';
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

      hotel_room_links: {
        Row: {
          id: string;
          hotel_id: string;
          room_number: string;
          label: string | null;
          room_token: string;
          restaurant_menu_url: string | null;
          is_active: boolean;
          notes: string | null;
          last_token_rotated_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          hotel_id: string;
          room_number: string;
          label?: string | null;
          room_token: string;
          restaurant_menu_url?: string | null;
          is_active?: boolean;
          notes?: string | null;
          last_token_rotated_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          hotel_id?: string;
          room_number?: string;
          label?: string | null;
          room_token?: string;
          restaurant_menu_url?: string | null;
          is_active?: boolean;
          notes?: string | null;
          last_token_rotated_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'hotel_room_links_hotel_id_fkey';
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

      hotel_announcement_translations: {
        Row: {
          id: string;
          announcement_id: string;
          language: string;
          title: string | null;
          body: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          announcement_id: string;
          language: string;
          title?: string | null;
          body?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          announcement_id?: string;
          language?: string;
          title?: string | null;
          body?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'hotel_announcement_translations_announcement_id_fkey';
            columns: ['announcement_id'];
            isOneToOne: false;
            referencedRelation: 'hotel_announcements';
            referencedColumns: ['id'];
          }
        ];
      };

      hotel_promotional_banner_translations: {
        Row: {
          id: string;
          banner_id: string;
          language: string;
          title: string | null;
          subtitle: string | null;
          cta_label: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          banner_id: string;
          language: string;
          title?: string | null;
          subtitle?: string | null;
          cta_label?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          banner_id?: string;
          language?: string;
          title?: string | null;
          subtitle?: string | null;
          cta_label?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'hotel_promotional_banner_translations_banner_id_fkey';
            columns: ['banner_id'];
            isOneToOne: false;
            referencedRelation: 'hotel_promotional_banners';
            referencedColumns: ['id'];
          }
        ];
      };

      admin_audit_log: {
        Row: {
          id: string;
          created_at: string;
          actor_user_id: string;
          hotel_id: string;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Json;
          request_id: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          actor_user_id: string;
          hotel_id: string;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          metadata?: Json;
          request_id?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          actor_user_id?: string;
          hotel_id?: string;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          metadata?: Json;
          request_id?: string | null;
        };
        Relationships: [];
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

    Views: {
      public_hotels: {
        Row: {
          id: string;
          name: string;
          slug: string;
          subdomain: string | null;
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
          hero_image_url: string | null;
          brand_code: string | null;
          theme_preset: string | null;
          theme_primary_color: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      create_platform_hotel_onboarding: {
        Args: { p_name: string; p_city: string; p_slug: string; p_subdomain: string; p_brand_code: string | null; p_theme_preset: string | null; p_admin_user_id: string; p_admin_email: string; p_admin_full_name: string };
        Returns: { hotel_id: string; platform_status: string; admin_user_id: string }[];
      };
      get_current_hotel_modules: {
        Args: Record<PropertyKey, never>;
        Returns: { module_key: string; is_enabled: boolean }[];
      };
      get_platform_hotel_modules: {
        Args: { p_hotel_id: string };
        Returns: { module_key: string; is_enabled: boolean; enabled_at: string | null; disabled_at: string | null }[];
      };
      update_platform_hotel_module: {
        Args: { p_hotel_id: string; p_module_key: string; p_enabled: boolean };
        Returns: { module_key: string; is_enabled: boolean; enabled_at: string | null; disabled_at: string | null }[];
      };
      is_hotel_module_enabled: {
        Args: { p_hotel_id: string; p_module_key: string };
        Returns: boolean;
      };
      get_current_platform_access: {
        Args: Record<PropertyKey, never>;
        Returns: {
          role: string;
          is_active: boolean;
        }[];
      };
      get_platform_hotel_metrics: {
        Args: Record<PropertyKey, never>;
        Returns: {
          total_hotels: number;
          hotels_by_brand: Json;
          hotels_by_status: Json;
        }[];
      };
      list_platform_hotels: {
        Args: {
          p_search?: string | null;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: {
          total_count: number;
          id: string;
          name: string;
          slug: string;
          subdomain: string | null;
          city: string | null;
          brand_code: string | null;
          theme_preset: string | null;
          logo_url: string | null;
          platform_status: 'draft' | 'active' | 'suspended' | 'archived';
        }[];
      };
      is_hotel_publicly_active: {
        Args: { target_hotel_id: string };
        Returns: boolean;
      };
      get_platform_hotel_detail: {
        Args: { p_hotel_id: string };
        Returns: {
          id: string;
          name: string;
          slug: string;
          subdomain: string | null;
          city: string | null;
          brand_code: string | null;
          theme_preset: string | null;
          logo_url: string | null;
          hero_image_url: string | null;
          platform_status: 'draft' | 'active' | 'suspended' | 'archived';
          created_at: string | null;
          updated_at: string | null;
        }[];
      };
      update_platform_hotel_brand: {
        Args: { p_hotel_id: string; p_brand_code: string | null };
        Returns: {
          hotel_id: string;
          brand_code: string | null;
          platform_status: 'draft' | 'active' | 'suspended' | 'archived';
          updated_at: string | null;
        }[];
      };
      update_platform_hotel_status: {
        Args: { p_hotel_id: string; p_status: string };
        Returns: {
          hotel_id: string;
          brand_code: string | null;
          platform_status: 'draft' | 'active' | 'suspended' | 'archived';
          updated_at: string | null;
        }[];
      };
      record_platform_audit_event: {
        Args: {
          p_actor_user_id: string;
          p_action: string;
          p_entity_type: string;
          p_entity_id?: string | null;
          p_metadata?: Json;
          p_request_id?: string | null;
        };
        Returns: string;
      };
      has_active_hotel_role: {
        Args: { target_hotel_id: string; required_role: string };
        Returns: boolean;
      };
      has_active_hotel_path_role: {
        Args: { target_hotel_id: string; required_role: string };
        Returns: boolean;
      };
      record_admin_audit_event: {
        Args: {
          p_actor_user_id: string;
          p_hotel_id: string;
          p_action: string;
          p_entity_type: string;
          p_entity_id?: string | null;
          p_metadata?: Json;
          p_request_id?: string | null;
        };
        Returns: string;
      };
      admin_update_hotel_user: {
        Args: {
          p_target_user_id: string;
          p_full_name: string;
          p_email: string;
          p_role: string;
          p_is_active: boolean;
        };
        Returns: {
          id: string;
          hotel_id: string;
          full_name: string | null;
          email: string | null;
          role: string | null;
          is_active: boolean;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
