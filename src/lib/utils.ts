import { clsx, ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 生成6位数字房间号
export function generateRoomId(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 验证房间号格式
export function validateRoomId(roomId: string): boolean {
  return /^\d{6}$/.test(roomId);
}

// 格式化剩余时间
export function formatTime(seconds: number): string {
  if (seconds <= 0) return 'Expired';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// 销毁时长选项（秒）
export const DESTRUCTION_TIMES = [
  { label: '15s', value: 15 },
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '5m', value: 300 },
  { label: '10m', value: 600 },
  { label: '30m', value: 1800 },
  { label: '45m', value: 2700 },
  { label: '1h', value: 3600 },
  { label: '1h 15m', value: 4500 },
  { label: '1h 30m', value: 5400 },
  { label: '1h 45m', value: 6300 },
  { label: '2h', value: 7200 },
  { label: '2h 15m', value: 8100 },
  { label: '2.5h', value: 9000 },
];

// 免费版可用时长
export const FREE_DESTRUCTION_TIMES = DESTRUCTION_TIMES.slice(0, 4); // 15秒-5分钟

// 格式化时间戳
export function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// 生成临时用户ID
export function generateUserId(): string {
  return 'user_' + Math.random().toString(36).substring(2, 15);
}
