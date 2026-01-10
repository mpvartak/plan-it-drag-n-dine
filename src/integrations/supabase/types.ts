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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
          user_id: string
          week_start_date: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
          user_id: string
          week_start_date: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          user_id?: string
          week_start_date?: string
        }
        Relationships: []
      }
      daily_eating_out: {
        Row: {
          cost: number | null
          created_at: string
          description: string
          id: string
          log_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          description: string
          id?: string
          log_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          description?: string
          id?: string
          log_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_grocery_purchases: {
        Row: {
          cost: number | null
          created_at: string
          id: string
          item_name: string
          log_date: string
          quantity: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          id?: string
          item_name: string
          log_date: string
          quantity?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          id?: string
          item_name?: string
          log_date?: string
          quantity?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_meal_logs: {
        Row: {
          created_at: string
          id: string
          is_unplanned: boolean | null
          item_id: string
          item_name: string
          log_date: string
          meal_type: string | null
          status: string
          substitute_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_unplanned?: boolean | null
          item_id: string
          item_name: string
          log_date: string
          meal_type?: string | null
          status: string
          substitute_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_unplanned?: boolean | null
          item_id?: string
          item_name?: string
          log_date?: string
          meal_type?: string | null
          status?: string
          substitute_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_waste_logs: {
        Row: {
          created_at: string
          id: string
          item_name: string
          log_date: string
          quantity: string | null
          reason: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          log_date: string
          quantity?: string | null
          reason: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          log_date?: string
          quantity?: string | null
          reason?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          created_at: string
          feedback_type: string
          id: string
          message: string
          page_url: string | null
          status: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback_type: string
          id?: string
          message: string
          page_url?: string | null
          status?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          feedback_type?: string
          id?: string
          message?: string
          page_url?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      grocery_lists: {
        Row: {
          created_at: string
          id: string
          ingredients: Json
          updated_at: string
          user_id: string
          week_start_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          ingredients?: Json
          updated_at?: string
          user_id: string
          week_start_date: string
        }
        Update: {
          created_at?: string
          id?: string
          ingredients?: Json
          updated_at?: string
          user_id?: string
          week_start_date?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          created_at: string
          expiration_date: string | null
          id: string
          location: Database["public"]["Enums"]["inventory_location"]
          name: string
          notes: string | null
          quantity: number
          ready_to_eat: boolean
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expiration_date?: string | null
          id?: string
          location?: Database["public"]["Enums"]["inventory_location"]
          name: string
          notes?: string | null
          quantity?: number
          ready_to_eat?: boolean
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expiration_date?: string | null
          id?: string
          location?: Database["public"]["Enums"]["inventory_location"]
          name?: string
          notes?: string | null
          quantity?: number
          ready_to_eat?: boolean
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_items: {
        Row: {
          category: string | null
          created_at: string
          id: string
          image_url: string | null
          name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_plans: {
        Row: {
          created_at: string
          date: string
          id: string
          meal_items: Json | null
          meal_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          meal_items?: Json | null
          meal_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          meal_items?: Json | null
          meal_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          meal_preferences: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          meal_preferences?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          meal_preferences?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      recipes: {
        Row: {
          content: string
          created_at: string
          id: string
          meal_item_id: string
          recipe_type: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          meal_item_id: string
          recipe_type: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          meal_item_id?: string
          recipe_type?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_meal_item_id_fkey"
            columns: ["meal_item_id"]
            isOneToOne: false
            referencedRelation: "meal_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_api_keys: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
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
      inventory_location: "fridge" | "freezer" | "pantry"
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
      inventory_location: ["fridge", "freezer", "pantry"],
    },
  },
} as const
