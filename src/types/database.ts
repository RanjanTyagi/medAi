export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          name: string
          email: string
          role: 'patient' | 'doctor' | 'admin'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          email: string
          role?: 'patient' | 'doctor' | 'admin'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          role?: 'patient' | 'doctor' | 'admin'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          id: string
          user_id: string
          symptoms: string
          image_url: string | null
          ai_output: Json
          status: 'pending' | 'reviewed' | 'verified' | 'rejected'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          symptoms: string
          image_url?: string | null
          ai_output: Json
          status?: 'pending' | 'reviewed' | 'verified' | 'rejected'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          symptoms?: string
          image_url?: string | null
          ai_output?: Json
          status?: 'pending' | 'reviewed' | 'verified' | 'rejected'
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'reports_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      doctor_notes: {
        Row: {
          id: string
          report_id: string
          doctor_id: string
          note: string
          verified: boolean
          created_at: string
        }
        Insert: {
          id?: string
          report_id: string
          doctor_id: string
          note: string
          verified?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          report_id?: string
          doctor_id?: string
          note?: string
          verified?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'doctor_notes_report_id_fkey'
            columns: ['report_id']
            referencedRelation: 'reports'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'doctor_notes_doctor_id_fkey'
            columns: ['doctor_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: 'patient' | 'doctor' | 'admin'
      report_status: 'pending' | 'reviewed' | 'verified' | 'rejected'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}