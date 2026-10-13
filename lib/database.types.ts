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
    PostgrestVersion: "14.5"
  }
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
      ai_jobs: {
        Row: {
          created_at: string
          id: string
          import_id: string | null
          input: Json
          job_type: string
          model: string | null
          output: Json | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          import_id?: string | null
          input?: Json
          job_type: string
          model?: string | null
          output?: Json | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          import_id?: string | null
          input?: Json
          job_type?: string
          model?: string | null
          output?: Json | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      imports: {
        Row: {
          created_at: string
          file_url: string | null
          id: string
          status: string
          store_id: string
          total_rows: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          id?: string
          status?: string
          store_id: string
          total_rows?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          file_url?: string | null
          id?: string
          status?: string
          store_id?: string
          total_rows?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          currency: string
          id: string
          order_id: string
          product_id: string | null
          product_name_snapshot: string
          quantity: number
          selected_options: Json
          sku_snapshot: string | null
          unit_price_snapshot: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          order_id: string
          product_id?: string | null
          product_name_snapshot: string
          quantity?: number
          selected_options?: Json
          sku_snapshot?: string | null
          unit_price_snapshot?: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_name_snapshot?: string
          quantity?: number
          selected_options?: Json
          sku_snapshot?: string | null
          unit_price_snapshot?: number
          variant_id?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          address: string | null
          city: string | null
          company: string | null
          contact_preference: string
          country: string | null
          created_at: string
          currency: string
          customer_email: string
          customer_name: string
          customer_phone: string | null
          customer_whatsapp: string | null
          id: string
          notes: string | null
          order_number: string
          state: string | null
          status: string
          store_id: string
          subtotal: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          company?: string | null
          contact_preference?: string
          country?: string | null
          created_at?: string
          currency?: string
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          customer_whatsapp?: string | null
          id?: string
          notes?: string | null
          order_number: string
          state?: string | null
          status?: string
          store_id: string
          subtotal?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          company?: string | null
          contact_preference?: string
          country?: string | null
          created_at?: string
          currency?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          customer_whatsapp?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          state?: string | null
          status?: string
          store_id?: string
          subtotal?: number
          updated_at?: string
        }
        Relationships: []
      }
      store_pages: {
        Row: {
          created_at: string
          id: string
          published: boolean
          sections: Json
          store_id: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          published?: boolean
          sections?: Json
          store_id: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          published?: boolean
          sections?: Json
          store_id?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      store_plugins: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          id: string
          plugin_name: string
          store_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          plugin_name: string
          store_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          plugin_name?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          created_at: string
          id: string
          seo_config: Json
          store_id: string
          theme_config: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          seo_config?: Json
          store_id: string
          theme_config?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          seo_config?: Json
          store_id?: string
          theme_config?: Json
          updated_at?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          author_id: string | null
          created_at: string
          id: string
          industry_id: string | null
          layout_config: Json
          name: string
          preview_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          id: string
          industry_id?: string | null
          layout_config?: Json
          name: string
          preview_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          id?: string
          industry_id?: string | null
          layout_config?: Json
          name?: string
          preview_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      brand_assets: {
        Row: {
          asset_type: string
          created_at: string
          id: string
          metadata: Json
          project_id: string
          sort_order: number
          storage_path: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          asset_type?: string
          created_at?: string
          id?: string
          metadata?: Json
          project_id: string
          sort_order?: number
          storage_path?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          id?: string
          metadata?: Json
          project_id?: string
          sort_order?: number
          storage_path?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "brand_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_projects: {
        Row: {
          analysis: Json
          category: string | null
          concept: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          palette: Json
          selected_template: string
          status: string
          style: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis?: Json
          category?: string | null
          concept?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          palette?: Json
          selected_template?: string
          status?: string
          style?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis?: Json
          category?: string | null
          concept?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          palette?: Json
          selected_template?: string
          status?: string
          style?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      brand_recommendations: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          position: number
          product_id: string
          product_url: string | null
          project_id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          position?: number
          product_id: string
          product_url?: string | null
          project_id: string
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          position?: number
          product_id?: string
          product_url?: string | null
          project_id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_recommendations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "brand_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_attribute_definitions: {
        Row: {
          category_id: string | null
          code: string
          created_at: string
          id: string
          is_filterable: boolean
          is_required: boolean
          label: string
          options: Json
          organization_id: string
          position: number
          unit: string | null
          updated_at: string
          value_type: string
        }
        Insert: {
          category_id?: string | null
          code: string
          created_at?: string
          id?: string
          is_filterable?: boolean
          is_required?: boolean
          label: string
          options?: Json
          organization_id: string
          position?: number
          unit?: string | null
          updated_at?: string
          value_type: string
        }
        Update: {
          category_id?: string | null
          code?: string
          created_at?: string
          id?: string
          is_filterable?: boolean
          is_required?: boolean
          label?: string
          options?: Json
          organization_id?: string
          position?: number
          unit?: string | null
          updated_at?: string
          value_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_attribute_definitions_category_organization_fkey"
            columns: ["category_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "catalog_categories"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "catalog_attribute_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_categories: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          metadata: Json
          name: string
          organization_id: string
          parent_id: string | null
          position: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          name: string
          organization_id: string
          parent_id?: string | null
          position?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          name?: string
          organization_id?: string
          parent_id?: string | null
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_categories_parent_organization_fkey"
            columns: ["parent_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "catalog_categories"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      catalog_contents: {
        Row: {
          body: string | null
          catalog_item_id: string
          channel_id: string | null
          content_metadata: Json
          content_type: string
          created_at: string
          created_by: string | null
          generation_metadata: Json
          id: string
          keywords: string[]
          locale: string
          organization_id: string
          position: number
          reviewed_at: string | null
          reviewed_by: string | null
          source_id: string | null
          status: string
          title: string | null
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          body?: string | null
          catalog_item_id: string
          channel_id?: string | null
          content_metadata?: Json
          content_type: string
          created_at?: string
          created_by?: string | null
          generation_metadata?: Json
          id?: string
          keywords?: string[]
          locale?: string
          organization_id: string
          position?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          body?: string | null
          catalog_item_id?: string
          channel_id?: string | null
          content_metadata?: Json
          content_type?: string
          created_at?: string
          created_by?: string | null
          generation_metadata?: Json
          id?: string
          keywords?: string[]
          locale?: string
          organization_id?: string
          position?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_contents_channel_organization_fkey"
            columns: ["channel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sales_channels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "catalog_contents_item_organization_fkey"
            columns: ["catalog_item_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "catalog_contents_source_organization_fkey"
            columns: ["source_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "catalog_sources"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "catalog_contents_variant_item_organization_fkey"
            columns: ["variant_id", "catalog_item_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "catalog_variants"
            referencedColumns: ["id", "catalog_item_id", "organization_id"]
          },
        ]
      }
      catalog_item_attributes: {
        Row: {
          catalog_item_id: string
          confidence: number | null
          created_at: string
          definition_id: string
          id: string
          organization_id: string
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_id: string | null
          updated_at: string
          value: Json
          value_origin: string
          variant_id: string | null
        }
        Insert: {
          catalog_item_id: string
          confidence?: number | null
          created_at?: string
          definition_id: string
          id?: string
          organization_id: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string | null
          updated_at?: string
          value: Json
          value_origin?: string
          variant_id?: string | null
        }
        Update: {
          catalog_item_id?: string
          confidence?: number | null
          created_at?: string
          definition_id?: string
          id?: string
          organization_id?: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string | null
          updated_at?: string
          value?: Json
          value_origin?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_item_attributes_definition_organization_fkey"
            columns: ["definition_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "catalog_attribute_definitions"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "catalog_item_attributes_item_organization_fkey"
            columns: ["catalog_item_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "catalog_item_attributes_source_organization_fkey"
            columns: ["source_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "catalog_sources"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "catalog_item_attributes_variant_item_organization_fkey"
            columns: ["variant_id", "catalog_item_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "catalog_variants"
            referencedColumns: ["id", "catalog_item_id", "organization_id"]
          },
        ]
      }
      catalog_item_change_sets: {
        Row: {
          applied_at: string | null
          catalog_item_id: string
          change_set: Json
          created_at: string
          error_message: string | null
          generation_metadata: Json
          id: string
          organization_id: string
          proposed_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_id: string | null
          status: string
        }
        Insert: {
          applied_at?: string | null
          catalog_item_id: string
          change_set: Json
          created_at?: string
          error_message?: string | null
          generation_metadata?: Json
          id?: string
          organization_id: string
          proposed_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string | null
          status?: string
        }
        Update: {
          applied_at?: string | null
          catalog_item_id?: string
          change_set?: Json
          created_at?: string
          error_message?: string | null
          generation_metadata?: Json
          id?: string
          organization_id?: string
          proposed_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_item_change_sets_item_organization_fkey"
            columns: ["catalog_item_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "catalog_item_change_sets_source_organization_fkey"
            columns: ["source_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "catalog_sources"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      catalog_item_channels: {
        Row: {
          catalog_item_id: string
          channel_id: string
          currency_code: string | null
          id: string
          is_purchasable: boolean
          is_visible: boolean
          organization_id: string
          price_override: number | null
          published_at: string | null
          store_id: string | null
        }
        Insert: {
          catalog_item_id: string
          channel_id: string
          currency_code?: string | null
          id?: string
          is_purchasable?: boolean
          is_visible?: boolean
          organization_id: string
          price_override?: number | null
          published_at?: string | null
          store_id?: string | null
        }
        Update: {
          catalog_item_id?: string
          channel_id?: string
          currency_code?: string | null
          id?: string
          is_purchasable?: boolean
          is_visible?: boolean
          organization_id?: string
          price_override?: number | null
          published_at?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_item_channels_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_item_channels_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "sales_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_item_channels_channel_organization_fkey"
            columns: ["channel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sales_channels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "catalog_item_channels_item_organization_fkey"
            columns: ["catalog_item_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "catalog_item_channels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_item_channels_store_organization_fkey"
            columns: ["store_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      catalog_item_compositions: {
        Row: {
          catalog_item_id: string
          component_name: string
          component_type: string
          created_at: string
          created_by: string | null
          id: string
          is_primary: boolean
          material_code: string | null
          notes: string | null
          organization_id: string
          origin_country: string | null
          percentage: number | null
          quantity: number | null
          quantity_unit: string | null
          source_id: string | null
          supplier_name: string | null
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          catalog_item_id: string
          component_name: string
          component_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          material_code?: string | null
          notes?: string | null
          organization_id: string
          origin_country?: string | null
          percentage?: number | null
          quantity?: number | null
          quantity_unit?: string | null
          source_id?: string | null
          supplier_name?: string | null
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          catalog_item_id?: string
          component_name?: string
          component_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          material_code?: string | null
          notes?: string | null
          organization_id?: string
          origin_country?: string | null
          percentage?: number | null
          quantity?: number | null
          quantity_unit?: string | null
          source_id?: string | null
          supplier_name?: string | null
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_item_compositions_item_organization_fkey"
            columns: ["catalog_item_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "catalog_item_compositions_source_organization_fkey"
            columns: ["source_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "catalog_sources"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "catalog_item_compositions_variant_item_organization_fkey"
            columns: ["variant_id", "catalog_item_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "catalog_variants"
            referencedColumns: ["id", "catalog_item_id", "organization_id"]
          },
        ]
      }
      catalog_item_relations: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          organization_id: string
          position: number
          relation_type: string
          source_item_id: string
          target_item_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          organization_id: string
          position?: number
          relation_type: string
          source_item_id: string
          target_item_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          organization_id?: string
          position?: number
          relation_type?: string
          source_item_id?: string
          target_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_item_relations_source_organization_fkey"
            columns: ["source_item_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "catalog_item_relations_target_organization_fkey"
            columns: ["target_item_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      catalog_item_sources: {
        Row: {
          catalog_item_id: string
          created_at: string
          excerpt: string | null
          id: string
          locator: string | null
          metadata: Json
          organization_id: string
          relation_role: string
          source_id: string
        }
        Insert: {
          catalog_item_id: string
          created_at?: string
          excerpt?: string | null
          id?: string
          locator?: string | null
          metadata?: Json
          organization_id: string
          relation_role?: string
          source_id: string
        }
        Update: {
          catalog_item_id?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          locator?: string | null
          metadata?: Json
          organization_id?: string
          relation_role?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_item_sources_item_organization_fkey"
            columns: ["catalog_item_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "catalog_item_sources_source_organization_fkey"
            columns: ["source_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "catalog_sources"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      catalog_items: {
        Row: {
          category_id: string | null
          cover_image: string | null
          created_at: string
          description: string | null
          details: Json
          id: string
          item_type: string
          organization_id: string
          slug: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          cover_image?: string | null
          created_at?: string
          description?: string | null
          details?: Json
          id?: string
          item_type: string
          organization_id: string
          slug?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          cover_image?: string | null
          created_at?: string
          description?: string | null
          details?: Json
          id?: string
          item_type?: string
          organization_id?: string
          slug?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_items_category_organization_fkey"
            columns: ["category_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "catalog_categories"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "catalog_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_media: {
        Row: {
          alt_text: string | null
          catalog_item_id: string
          created_at: string
          id: string
          media_role: string
          media_type: string
          metadata: Json
          organization_id: string
          storage_path: string
          variant_id: string | null
        }
        Insert: {
          alt_text?: string | null
          catalog_item_id: string
          created_at?: string
          id?: string
          media_role: string
          media_type: string
          metadata?: Json
          organization_id: string
          storage_path: string
          variant_id?: string | null
        }
        Update: {
          alt_text?: string | null
          catalog_item_id?: string
          created_at?: string
          id?: string
          media_role?: string
          media_type?: string
          metadata?: Json
          organization_id?: string
          storage_path?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_media_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_media_item_organization_fkey"
            columns: ["catalog_item_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "catalog_media_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_media_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "catalog_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_media_variant_organization_fkey"
            columns: ["variant_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "catalog_variants"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      catalog_sources: {
        Row: {
          captured_at: string | null
          content_hash: string | null
          created_at: string
          created_by: string | null
          id: string
          ingest_status: string
          metadata: Json
          organization_id: string
          source_type: string
          storage_path: string | null
          store_id: string | null
          title: string | null
          uri: string | null
        }
        Insert: {
          captured_at?: string | null
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          ingest_status?: string
          metadata?: Json
          organization_id: string
          source_type: string
          storage_path?: string | null
          store_id?: string | null
          title?: string | null
          uri?: string | null
        }
        Update: {
          captured_at?: string | null
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          ingest_status?: string
          metadata?: Json
          organization_id?: string
          source_type?: string
          storage_path?: string | null
          store_id?: string | null
          title?: string | null
          uri?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_sources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_sources_store_organization_fkey"
            columns: ["store_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      catalog_variants: {
        Row: {
          availability_type: string
          availability_value: number | null
          catalog_item_id: string
          created_at: string
          currency_code: string
          details: Json
          id: string
          organization_id: string
          price: number
          sku_code: string | null
          title: string
          updated_at: string
        }
        Insert: {
          availability_type?: string
          availability_value?: number | null
          catalog_item_id: string
          created_at?: string
          currency_code?: string
          details?: Json
          id?: string
          organization_id: string
          price?: number
          sku_code?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          availability_type?: string
          availability_value?: number | null
          catalog_item_id?: string
          created_at?: string
          currency_code?: string
          details?: Json
          id?: string
          organization_id?: string
          price?: number
          sku_code?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_variants_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_variants_item_organization_fkey"
            columns: ["catalog_item_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "catalog_variants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_order_items: {
        Row: {
          catalog_item_id: string
          created_at: string
          id: string
          line_total: number
          order_id: string
          organization_id: string
          quantity: number
          unit_price: number
          variant_id: string
        }
        Insert: {
          catalog_item_id: string
          created_at?: string
          id?: string
          line_total: number
          order_id: string
          organization_id: string
          quantity?: number
          unit_price: number
          variant_id: string
        }
        Update: {
          catalog_item_id?: string
          created_at?: string
          id?: string
          line_total?: number
          order_id?: string
          organization_id?: string
          quantity?: number
          unit_price?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_order_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_order_items_item_organization_fkey"
            columns: ["catalog_item_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "demo_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "demo_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_order_items_order_organization_fkey"
            columns: ["order_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "demo_orders"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "demo_order_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "catalog_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_order_items_variant_organization_fkey"
            columns: ["variant_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "catalog_variants"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      demo_orders: {
        Row: {
          channel_id: string | null
          created_at: string
          currency_code: string
          id: string
          organization_id: string
          status: string
          total_amount: number
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          currency_code?: string
          id?: string
          organization_id: string
          status?: string
          total_amount?: number
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          currency_code?: string
          id?: string
          organization_id?: string
          status?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "demo_orders_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "sales_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_orders_channel_organization_fkey"
            columns: ["channel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sales_channels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "demo_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_uploads: {
        Row: {
          byte_size: number
          content_type: string
          created_at: string
          id: string
          object_path: string | null
          original_name: string
          scan_detail: string | null
          status: string
          store_id: string
          uploaded_by: string
        }
        Insert: {
          byte_size: number
          content_type: string
          created_at?: string
          id?: string
          object_path?: string | null
          original_name: string
          scan_detail?: string | null
          status: string
          store_id: string
          uploaded_by: string
        }
        Update: {
          byte_size?: number
          content_type?: string
          created_at?: string
          id?: string
          object_path?: string | null
          original_name?: string
          scan_detail?: string | null
          status?: string
          store_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_uploads_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_profile_revisions: {
        Row: {
          change_summary: string | null
          changed_by: string | null
          created_at: string
          id: string
          profile_document: Json
          profile_id: string
          revision: number
          source_id: string | null
        }
        Insert: {
          change_summary?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          profile_document: Json
          profile_id: string
          revision: number
          source_id?: string | null
        }
        Update: {
          change_summary?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          profile_document?: Json
          profile_id?: string
          revision?: number
          source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_profile_revisions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "merchant_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_profile_revisions_source_profile_fkey"
            columns: ["source_id", "profile_id"]
            isOneToOne: false
            referencedRelation: "merchant_profile_sources"
            referencedColumns: ["id", "profile_id"]
          },
        ]
      }
      merchant_profile_sources: {
        Row: {
          captured_at: string | null
          content_hash: string | null
          created_at: string
          id: string
          ingest_status: string
          metadata: Json
          profile_id: string
          source_type: string
          storage_path: string | null
          title: string | null
          uri: string | null
        }
        Insert: {
          captured_at?: string | null
          content_hash?: string | null
          created_at?: string
          id?: string
          ingest_status?: string
          metadata?: Json
          profile_id: string
          source_type: string
          storage_path?: string | null
          title?: string | null
          uri?: string | null
        }
        Update: {
          captured_at?: string | null
          content_hash?: string | null
          created_at?: string
          id?: string
          ingest_status?: string
          metadata?: Json
          profile_id?: string
          source_type?: string
          storage_path?: string | null
          title?: string | null
          uri?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_profile_sources_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "merchant_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_profile_updates: {
        Row: {
          applied_at: string | null
          change_set: Json
          created_at: string
          error_message: string | null
          id: string
          profile_id: string
          requested_by: string | null
          reviewed_at: string | null
          source_id: string | null
          status: string
        }
        Insert: {
          applied_at?: string | null
          change_set?: Json
          created_at?: string
          error_message?: string | null
          id?: string
          profile_id: string
          requested_by?: string | null
          reviewed_at?: string | null
          source_id?: string | null
          status?: string
        }
        Update: {
          applied_at?: string | null
          change_set?: Json
          created_at?: string
          error_message?: string | null
          id?: string
          profile_id?: string
          requested_by?: string | null
          reviewed_at?: string | null
          source_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_profile_updates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "merchant_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_profile_updates_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "merchant_profile_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_profiles: {
        Row: {
          created_at: string
          id: string
          profile_document: Json
          profile_version: string
          revision: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_document?: Json
          profile_version?: string
          revision?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_document?: Json
          profile_version?: string
          revision?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          joined_at: string | null
          organization_id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          organization_id: string
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          organization_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          logo_url: string | null
          name: string
          owner_user_id: string | null
          plan: string
          settings: Json
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_user_id?: string | null
          plan?: string
          settings?: Json
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_user_id?: string | null
          plan?: string
          settings?: Json
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          onboarding_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          onboarding_status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          onboarding_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales_channels: {
        Row: {
          channel_type: string
          code: string
          created_at: string
          id: string
          name: string
          organization_id: string
          status: string
        }
        Insert: {
          channel_type: string
          code: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          status?: string
        }
        Update: {
          channel_type?: string
          code?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_channels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      semantic_documents: {
        Row: {
          content: string
          content_hash: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          content: string
          content_hash: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          content_hash?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "semantic_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      semantic_embeddings: {
        Row: {
          created_at: string
          dimensions: number
          document_id: string
          embedding: string
          id: string
          modality: string
          model: string
          organization_id: string
          provider: string
        }
        Insert: {
          created_at?: string
          dimensions?: number
          document_id: string
          embedding: string
          id?: string
          modality: string
          model?: string
          organization_id: string
          provider?: string
        }
        Update: {
          created_at?: string
          dimensions?: number
          document_id?: string
          embedding?: string
          id?: string
          modality?: string
          model?: string
          organization_id?: string
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "semantic_embeddings_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "semantic_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "semantic_embeddings_document_organization_fkey"
            columns: ["document_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "semantic_documents"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "semantic_embeddings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      store_workspace_skills: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_enabled: boolean
          selection_mode: string
          settings: Json
          skill_id: string
          skill_version_id: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_enabled?: boolean
          selection_mode?: string
          settings?: Json
          skill_id: string
          skill_version_id?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_enabled?: boolean
          selection_mode?: string
          settings?: Json
          skill_id?: string
          skill_version_id?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_workspace_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "workspace_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_workspace_skills_skill_version_id_skill_id_fkey"
            columns: ["skill_version_id", "skill_id"]
            isOneToOne: false
            referencedRelation: "workspace_skill_versions"
            referencedColumns: ["id", "skill_id"]
          },
          {
            foreignKeyName: "store_workspace_skills_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_versions: {
        Row: {
          created_at: string
          created_by: string | null
          generation_brief: Json
          generation_model: string | null
          id: string
          organization_id: string
          published_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          schema_document: Json
          source_snapshot: Json
          status: string
          store_id: string
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          generation_brief?: Json
          generation_model?: string | null
          id?: string
          organization_id: string
          published_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          schema_document: Json
          source_snapshot?: Json
          status?: string
          store_id: string
          version_number: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          generation_brief?: Json
          generation_model?: string | null
          id?: string
          organization_id?: string
          published_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          schema_document?: Json
          source_snapshot?: Json
          status?: string
          store_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "storefront_versions_store_organization_fkey"
            columns: ["store_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      storefronts: {
        Row: {
          created_at: string
          custom_domain: string | null
          draft_version_id: string | null
          organization_id: string
          published_version_id: string | null
          settings: Json
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_domain?: string | null
          draft_version_id?: string | null
          organization_id: string
          published_version_id?: string | null
          settings?: Json
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_domain?: string | null
          draft_version_id?: string | null
          organization_id?: string
          published_version_id?: string | null
          settings?: Json
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "storefronts_draft_version_store_fkey"
            columns: ["draft_version_id", "store_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "storefront_versions"
            referencedColumns: ["id", "store_id", "organization_id"]
          },
          {
            foreignKeyName: "storefronts_published_version_store_fkey"
            columns: ["published_version_id", "store_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "storefront_versions"
            referencedColumns: ["id", "store_id", "organization_id"]
          },
          {
            foreignKeyName: "storefronts_store_organization_fkey"
            columns: ["store_id", "organization_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      stores: {
        Row: {
          brand_kit: Json
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          domain: string | null
          id: string
          locale: string
          name: string
          organization_id: string
          settings: Json
          slug: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          brand_kit?: Json
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          domain?: string | null
          id?: string
          locale?: string
          name: string
          organization_id: string
          settings?: Json
          slug: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          brand_kit?: Json
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          domain?: string | null
          id?: string
          locale?: string
          name?: string
          organization_id?: string
          settings?: Json
          slug?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_skill_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          input_snapshot: Json
          output_snapshot: Json
          profile_update_id: string | null
          source_id: string | null
          started_at: string | null
          status: string
          store_skill_id: string
          trigger_type: string
          triggered_by: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_snapshot?: Json
          output_snapshot?: Json
          profile_update_id?: string | null
          source_id?: string | null
          started_at?: string | null
          status?: string
          store_skill_id: string
          trigger_type: string
          triggered_by?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_snapshot?: Json
          output_snapshot?: Json
          profile_update_id?: string | null
          source_id?: string | null
          started_at?: string | null
          status?: string
          store_skill_id?: string
          trigger_type?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_skill_runs_profile_update_id_fkey"
            columns: ["profile_update_id"]
            isOneToOne: false
            referencedRelation: "merchant_profile_updates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_skill_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "merchant_profile_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_skill_runs_store_skill_id_fkey"
            columns: ["store_skill_id"]
            isOneToOne: false
            referencedRelation: "store_workspace_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_skill_versions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          manifest: Json
          skill_id: string
          version: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          manifest?: Json
          skill_id: string
          version: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          manifest?: Json
          skill_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_skill_versions_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "workspace_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_skills: {
        Row: {
          category: string
          created_at: string
          description: string
          icon: string
          id: string
          is_archived: boolean
          name: string
          organization_id: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          icon?: string
          id: string
          is_archived?: boolean
          name: string
          organization_id?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_archived?: boolean
          name?: string
          organization_id?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_skills_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      published_storefronts: {
        Row: {
          custom_domain: string | null
          published_at: string | null
          schema_document: Json | null
          store_id: string | null
          version_id: string | null
          version_number: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      submit_storefront_inquiry: {
        Args: {
          p_items: Json
          p_order_id: string
          p_order_number: string
          p_store_slug: string
          p_customer: Json
        }
        Returns: {
          order_id: string
          order_number: string
        }[]
      }
      get_public_order_confirmation: {
        Args: {
          p_store_slug: string
          p_order_id: string
        }
        Returns: Json
      }
      save_storefront_version: {
        Args: {
          p_store_id: string
          p_schema: Json
          p_publish?: boolean
        }
        Returns: string
      }
      unpublish_storefront_version: {
        Args: { p_store_id: string }
        Returns: undefined
      }
      create_organization_and_store: {
        Args: {
          p_currency?: string
          p_organization_name: string
          p_organization_slug: string
          p_store_name: string
          p_store_slug: string
        }
        Returns: {
          organization_id: string
          store_id: string
        }[]
      }
      match_catalog_embeddings: {
        Args: {
          p_channel_id?: string
          p_match_count?: number
          p_modality?: string
          p_model?: string
          p_organization_id: string
          p_query_embedding: string
          p_similarity_threshold?: number
        }
        Returns: {
          catalog_item_id: string
          catalog_media_id: string
          catalog_variant_id: string
          content: string
          document_id: string
          similarity: number
        }[]
      }
      save_catalog_item_attributes: {
        Args: {
          p_attributes?: Json
          p_category_id?: string
          p_deletions?: string[]
          p_item_id: string
        }
        Returns: undefined
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
