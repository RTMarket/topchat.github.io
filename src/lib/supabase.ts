import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jzowwigrezkddiyxabjx.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6b3d3aWdyZXprZGRpeXhhYmp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NzQ3MTYsImV4cCI6MjA5MTA1MDcxNn0.aI0HMmMiq3yIZvtolw5mOkLZ4X8h9trt0VwzR37_j5U'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Message = {
  id?: string
  room_id: string
  sender_id: string
  sender_name: string
  type: 'text' | 'file'
  // ... 其他字段
}
