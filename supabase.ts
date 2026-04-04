import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ewbmvcldtadcffhvcwba.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3Mi...'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Message = {
  id?: string
  room_id: string
  sender_id: string
  sender_name: string
  type: 'text' | 'file'
  // ... 其他字段
}
