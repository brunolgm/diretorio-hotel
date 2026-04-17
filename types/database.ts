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

      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          role: string | null;
          hotel_id: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          role?: string | null;
          hotel_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          role?: string | null;
          hotel_id?: string | null;
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