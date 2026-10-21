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
      addresses: {
        Row: {
          created_at: string
          id: string
          label: string
          lat: number | null
          line: string
          lng: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string
          lat?: number | null
          line: string
          lng?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          lat?: number | null
          line?: string
          lng?: number | null
          user_id?: string
        }
        Relationships: []
      }
      carts: {
        Row: {
          lines: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          lines?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          lines?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          max_off: number
          min_order: number
          pct: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          max_off?: number
          min_order?: number
          pct: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          max_off?: number
          min_order?: number
          pct?: number
        }
        Relationships: []
      }
      orders: {
        Row: {
          address: string
          call_at: string | null
          call_from: string | null
          cancelled_at: string | null
          coupon: string | null
          created_at: string
          delivered_at: string | null
          delivery_fee: number
          discount: number
          id: string
          id_checked: boolean
          idempotency_key: string | null
          instructions: string
          item_total: number
          lat: number | null
          lines: Json
          lng: number | null
          packaging: number
          payment: string
          rider_at: string | null
          rider_id: string | null
          rider_lat: number | null
          rider_lng: number | null
          stage: number
          status: string
          store_ok: boolean
          taxes: number
          total: number
          user_id: string
        }
        Insert: {
          address: string
          call_at?: string | null
          call_from?: string | null
          cancelled_at?: string | null
          coupon?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_fee?: number
          discount?: number
          id: string
          id_checked?: boolean
          idempotency_key?: string | null
          instructions?: string
          item_total: number
          lat?: number | null
          lines: Json
          lng?: number | null
          packaging?: number
          payment?: string
          rider_at?: string | null
          rider_id?: string | null
          rider_lat?: number | null
          rider_lng?: number | null
          stage?: number
          status?: string
          store_ok?: boolean
          taxes?: number
          total: number
          user_id: string
        }
        Update: {
          address?: string
          call_at?: string | null
          call_from?: string | null
          cancelled_at?: string | null
          coupon?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_fee?: number
          discount?: number
          id?: string
          id_checked?: boolean
          idempotency_key?: string | null
          instructions?: string
          item_total?: number
          lat?: number | null
          lines?: Json
          lng?: number | null
          packaging?: number
          payment?: string
          rider_at?: string | null
          rider_id?: string | null
          rider_lat?: number | null
          rider_lng?: number | null
          stage?: number
          status?: string
          store_ok?: boolean
          taxes?: number
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          available: boolean
          category: string
          created_at: string
          description: string
          extras: Json
          id: string
          image_key: string | null
          image_url: string | null
          menthol: boolean
          name: string
          price: number
          sizes: Json
          sort: number
        }
        Insert: {
          available?: boolean
          category?: string
          created_at?: string
          description?: string
          extras?: Json
          id: string
          image_key?: string | null
          image_url?: string | null
          menthol?: boolean
          name: string
          price: number
          sizes?: Json
          sort?: number
        }
        Update: {
          available?: boolean
          category?: string
          created_at?: string
          description?: string
          extras?: Json
          id?: string
          image_key?: string | null
          image_url?: string | null
          menthol?: boolean
          name?: string
          price?: number
          sizes?: Json
          sort?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          areas: string
          close_hour: number
          delivery_fee: number
          eta: number
          id: number
          max_km: number
          min_order: number
          open_hour: number
          packaging: number
          tax_pct: number
          updated_at: string
        }
        Insert: {
          areas?: string
          close_hour?: number
          delivery_fee?: number
          eta?: number
          id?: number
          max_km?: number
          min_order?: number
          open_hour?: number
          packaging?: number
          tax_pct?: number
          updated_at?: string
        }
        Update: {
          areas?: string
          close_hour?: number
          delivery_fee?: number
          eta?: number
          id?: number
          max_km?: number
          min_order?: number
          open_hour?: number
          packaging?: number
          tax_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          created_at: string
          id: string
          message: string
          order_id: string | null
          status: string
          topic: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          order_id?: string | null
          status?: string
          topic: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          order_id?: string | null
          status?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
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
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      order_customer: {
        Args: { _order_id: string }
        Returns: {
          full_name: string
          phone: string
        }[]
      }
      order_rider_name: { Args: { _order_id: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "rider" | "manager"
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
    Enums: {
      app_role: ["admin", "rider", "manager"],
    },
  },
} as const
