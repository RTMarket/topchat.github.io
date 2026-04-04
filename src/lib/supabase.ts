import { createClient, RealtimeChannel } from '@supabase/supabase-js';

const supabaseUrl = 'https://ahwbdvpxkdpcznxjrrqw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFod2JkdnB4a2RwY3pueGpycnF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTgzNDAsImV4cCI6MjA5MDYzNDM0MH0.VoV116Oz6LKDqbatEyWpzVB4YhAOURmMSMhj99Ob9vU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 房间表结构
export interface Room {
  room_id: string;
  created_at: string;
  expire_at: string;
  is_paid: boolean;
  password: string | null;
  max_users: number;
  destruction_time?: number; // 会议时长（秒）
}

// 订单表结构
export interface Order {
  order_id: string;
  room_id: string;
  amount: number;
  pay_time: string;
  paid: boolean;
}

// 聊天消息类型（零存储 - 仅内存，临时使用）
// 此类型不存储到数据库，仅通过 Realtime Channel broadcast 传输
export interface TempMessage {
  id: string;                    // 本地生成的临时ID
  room_id: string;
  user_id: string;
  user_name: string;
  text: string;
  type: 'text' | 'image' | 'pdf' | 'word' | 'excel' | 'file' | 'voice';
  file_name?: string;
  file_url?: string;             // Base64 编码，仅存内存
  file_size?: number;
  created_at: string;
  expire_in?: number;            // 秒，每条消息的销毁时间
}

// 旧的 ChatMessage 类型保留用于参考，不再使用
// @deprecated 此类型仅用于数据库存储，当前版本已禁用
export interface ChatMessage {
  id: string;
  room_id: string;
  user_id: string;
  user_name: string;
  text: string;
  type: 'text' | 'image' | 'pdf' | 'word' | 'excel' | 'file' | 'voice';
  file_name?: string;
  file_url?: string;
  file_size?: number;
  created_at: string;
  expire_at?: string;
  expire_in?: number;
}
