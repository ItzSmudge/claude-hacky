
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "paper_analyses": {
                  Row: {
                    "analysis": NonNullable<Json>,"created_at": string,"credibility": Json | null,"paper_id": string,"project_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "analysis": NonNullable<Json>,"created_at"?: string,"credibility"?: Json | null,"paper_id": string,"project_id": string
                  }
                  Update: {
                    "analysis"?: NonNullable<Json>,"created_at"?: string,"credibility"?: Json | null,"paper_id"?: string,"project_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "paper_analyses_paper_id_fkey"
      columns: ["paper_id"]
isOneToOne: false
      referencedRelation: "papers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "paper_analyses_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"papers": {
                  Row: {
                    "data": NonNullable<Json>,"doi": string | null,"external_id": string,"id": string,"source": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "data": NonNullable<Json>,"doi"?: string | null,"external_id": string,"id"?: string,"source": string,"updated_at"?: string
                  }
                  Update: {
                    "data"?: NonNullable<Json>,"doi"?: string | null,"external_id"?: string,"id"?: string,"source"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"project_documents": {
                  Row: {
                    "created_at": string,"extracted_text": string | null,"filename": string,"id": string,"project_id": string,"storage_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"extracted_text"?: string | null,"filename": string,"id"?: string,"project_id": string,"storage_path": string
                  }
                  Update: {
                    "created_at"?: string,"extracted_text"?: string | null,"filename"?: string,"id"?: string,"project_id"?: string,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_documents_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"project_members": {
                  Row: {
                    "joined_at": string,"project_id": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "joined_at"?: string,"project_id": string,"role"?: string,"user_id": string
                  }
                  Update: {
                    "joined_at"?: string,"project_id"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_members_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"projects": {
                  Row: {
                    "context": Json | null,"created_at": string,"id": string,"join_code": string,"owner_id": string,"query": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "context"?: Json | null,"created_at"?: string,"id"?: string,"join_code"?: string,"owner_id"?: string,"query"?: string,"title": string
                  }
                  Update: {
                    "context"?: Json | null,"created_at"?: string,"id"?: string,"join_code"?: string,"owner_id"?: string,"query"?: string,"title"?: string
                  }
                  Relationships: [
                    
                  ]
                },"swipes": {
                  Row: {
                    "created_at": string,"decision": string,"paper_id": string,"project_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"decision": string,"paper_id": string,"project_id": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"decision"?: string,"paper_id"?: string,"project_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "swipes_paper_id_fkey"
      columns: ["paper_id"]
isOneToOne: false
      referencedRelation: "papers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "swipes_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "disagreements": {
                  Row: {
                    "paper_id": string | null,"project_id": string | null,"save_count": number | null,"skip_count": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "swipes_paper_id_fkey"
      columns: ["paper_id"]
isOneToOne: false
      referencedRelation: "papers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "swipes_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"reading_list": {
                  Row: {
                    "last_swiped_at": string | null,"paper_id": string | null,"project_id": string | null,"save_count": number | null,"skip_count": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "swipes_paper_id_fkey"
      columns: ["paper_id"]
isOneToOne: false
      referencedRelation: "papers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "swipes_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "generate_join_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"is_project_member":
{ Args: { "p_project_id": string }; Returns: boolean
                           },
"join_project":
{ Args: { "p_code": string }; Returns: string
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
