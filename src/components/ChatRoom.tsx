import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, Room, TempMessage } from '../lib/supabase';
import {
  formatTime, formatTimestamp, DESTRUCTION_TIMES, FREE_DESTRUCTION_TIMES
} from '../lib/utils';
import { containsSensitiveWords, filterSensitiveWords } from '../lib/sensitiveWords';
import {
  Send, FileText, X, Lock, Users, Clock,
  Loader2, ChevronLeft, File, Archive, Crown, Download, Flame
} from 'lucide-react';

// 生成临时消息ID（本地生成，不依赖数据库）
function generateTempId(): string {
  return 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

export default function ChatRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<any>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<TempMessage[]>([]); // 本地内存消息
  const [newMessage, setNewMessage] = useState('');
  const [destructionTime, setDestructionTime] = useState(300); // 默认5分钟
  const [roomLoading, setRoomLoading] = useState(true);
  const [showTerms, setShowTerms] = useState(true);
  const [isPaid, setIsPaid] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [password, setPassword] = useState('');
  const [needPassword, setNeedPassword] = useState(false);
  const [wrongPassword, setWrongPassword] = useState(false);
  const [showPreview, setShowPreview] = useState<{type: string; url: string; name: string; fileUrl?: string} | null>(null);
  const [uploading, setUploading] = useState(false);
  const [meetingTimeLeft, setMeetingTimeLeft] = useState<number>(0);
  const [userId, setUserId] = useState(() => {
    let id = sessionStorage.getItem('userId');
    if (!id) {
      id = 'user_' + Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem('userId', id);
    }
    return id;
  });

  // 获取房间信息
  useEffect(() => {
    const fetchRoom = async () => {
      if (!roomId) return;
      try {
        let currentUserId = sessionStorage.getItem('userId');
        if (!currentUserId) {
          currentUserId = 'user_' + Math.random().toString(36).substring(2, 15);
          sessionStorage.setItem('userId', currentUserId);
        }
        if (currentUserId !== userId) {
          setUserId(currentUserId);
        }

        const { data, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('room_id', roomId)
          .single();

        if (error || !data) {
          alert('Room does not exist');
          navigate('/');
          return;
        }

        setRoom(data);
        setIsPaid(data.is_paid);

        const isRoomCreator = sessionStorage.getItem(`creator_${roomId}`) === 'true';
        setIsCreator(isRoomCreator);

        if (data.destruction_time) {
          setDestructionTime(data.destruction_time);
          const createdAt = new Date(data.created_at).getTime();
          const endTime = createdAt + data.destruction_time * 1000;
          const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
          setMeetingTimeLeft(remaining);
        } else {
          // Free chat room, default 5 minutes
          const defaultMeetingTime = 5 * 60;
          setDestructionTime(defaultMeetingTime);
          const createdAt = new Date(data.created_at).getTime();
          const endTime = createdAt + defaultMeetingTime * 1000;
          const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
          setMeetingTimeLeft(remaining);
        }
      } catch {
        navigate('/');
      } finally {
        setRoomLoading(false);
      }
    };

    fetchRoom();
  }, [roomId, navigate, userId]);

  // 会议倒计时器
  useEffect(() => {
    if (meetingTimeLeft <= 0) return;

    const timer = setInterval(() => {
      setMeetingTimeLeft(prev => {
        const newTime = prev - 1;
        if (newTime <= 0) {
          clearInterval(timer);
          alert('Room time is up, the room is about to close');
          // 清理本地消息
          setMessages([]);
          navigate('/');
          return 0;
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [meetingTimeLeft, navigate]);

  // 设置 Realtime Channel（使用 broadcast 实现零存储）
  useEffect(() => {
    if (!roomId || roomLoading) return;

    const currentUserId = sessionStorage.getItem('userId') || userId;

    // 创建 Channel 用于广播消息
    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        broadcast: { self: false }, // 不接收自己广播的消息
        presence: { key: currentUserId }
      }
    });

    // 监听广播消息（其他人发送的消息）
    channel.on('broadcast', { event: 'new_message' }, (payload) => {
      const newMsg = payload.payload as TempMessage;
      // 添加到本地消息列表
      setMessages(prev => [...prev, newMsg]);
    });

    // 监听消息删除广播
    channel.on('broadcast', { event: 'delete_message' }, (payload) => {
      const { id } = payload.payload as { id: string };
      setMessages(prev => prev.filter(m => m.id !== id));
    });

    // 监听房间解散广播
    channel.on('broadcast', { event: 'room_dismissed' }, () => {
      alert('Room has been dismissed by the owner');
      navigate('/');
    });

    // 监听房间被删除（创建者解散房间）
    channel.on('postgres_changes', {
      event: 'DELETE',
      schema: 'public',
      table: 'rooms',
      filter: `room_id=eq.${roomId}`
    }, () => {
      alert('Room has been dismissed');
      navigate('/');
    });

    channel.subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [roomId, roomLoading, navigate, userId]);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 清理过期消息（本地删除，不再操作数据库）
  const cleanupExpiredMessages = useCallback(() => {
    const now = Date.now();
    const expiredMessages = messages.filter(msg => {
      const createdAt = new Date(msg.created_at).getTime();
      const expireTime = (msg.expire_in || destructionTime) * 1000;
      return now >= createdAt + expireTime;
    });

    if (expiredMessages.length === 0) return;

    // 从本地状态删除过期消息
    setMessages(prev => {
      const newMessages = prev.filter(msg => {
        const createdAt = new Date(msg.created_at).getTime();
        const expireTime = (msg.expire_in || destructionTime) * 1000;
        return now < createdAt + expireTime;
      });
      return newMessages;
    });
  }, [messages, destructionTime]);

  // 每秒检查并清理过期消息
  useEffect(() => {
    if (!messages.length) return;
    const timer = setInterval(() => {
      cleanupExpiredMessages();
    }, 1000);
    return () => clearInterval(timer);
  }, [messages.length, cleanupExpiredMessages]);

  // 发送消息（通过 broadcast 广播，不存储到数据库）
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !roomId || !channelRef.current) return;
    if (containsSensitiveWords(newMessage)) {
      alert('Message contains sensitive content');
      return;
    }

    const filteredText = filterSensitiveWords(newMessage);
    const currentUserId = sessionStorage.getItem('userId') || userId;
    const now = new Date();

    const messageData: TempMessage = {
      id: generateTempId(), // 本地生成ID
      room_id: roomId,
      user_id: currentUserId,
      user_name: 'Guest',
      text: filteredText,
      type: 'text',
      created_at: now.toISOString(),
      expire_in: destructionTime
    };

    // 添加到本地消息列表（立即显示）
    setMessages(prev => [...prev, messageData]);

    // 通过 broadcast 广播给其他用户（零存储）
    await channelRef.current.send({
      type: 'broadcast',
      event: 'new_message',
      payload: messageData
    });

    setNewMessage('');
  }, [newMessage, roomId, userId, destructionTime]);

  // 处理文件上传（文件仅存内存，不存数据库）
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !roomId || !channelRef.current) return;
    if (!isPaid) {
      alert('File upload is only available for Premium chat rooms');
      return;
    }

    const file = e.target.files[0];
    if (file.size > 20 * 1024 * 1024) {
      alert('File size cannot exceed 20MB');
      return;
    }

    setUploading(true);
    const currentUserId = sessionStorage.getItem('userId') || userId;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const now = new Date();
        const isImage = file.type.startsWith('image/');
        const isPdf = file.type === 'application/pdf';
        const fileName = file.name.toLowerCase();
        const isWord = fileName.endsWith('.doc') || fileName.endsWith('.docx');
        const isExcel = fileName.endsWith('.xls') || fileName.endsWith('.xlsx');

        const messageData: TempMessage = {
          id: generateTempId(),
          room_id: roomId,
          user_id: currentUserId,
          user_name: 'Guest',
          text: file.name,
          type: isImage ? 'image' : isPdf ? 'pdf' : isWord ? 'word' : isExcel ? 'excel' : 'file',
          file_name: file.name,
          file_url: reader.result as string, // Base64 仅存内存
          file_size: file.size,
          created_at: now.toISOString(),
          expire_in: destructionTime
        };

        // 添加到本地消息列表
        setMessages(prev => [...prev, messageData]);

        // 通过 broadcast 广播给其他用户
        await channelRef.current.send({
          type: 'broadcast',
          event: 'new_message',
          payload: messageData
        });
      } catch (err) {
        console.error('Failed to upload file:', err);
        alert('File upload failed');
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 下载文件
  const downloadFile = (url: string, name: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 解散房间（删除数据库中的房间）
  const dismissRoom = async () => {
    if (!confirm('Are you sure you want to dismiss this room? All content will be permanently deleted.')) return;
    try {
      // 广播解散消息
      if (channelRef.current) {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'room_dismissed',
          payload: {}
        });
      }
      // 删除数据库中的房间
      await supabase.from('rooms').delete().eq('room_id', roomId);
      navigate('/');
    } catch (err) {
      console.error(err);
    }
  };

  const leaveRoom = () => {
    // 清理本地消息
    setMessages([]);
    navigate('/');
  };

  const verifyPassword = () => {
    if (room?.password && password !== room.password) {
      setWrongPassword(true);
      return;
    }
    setNeedPassword(false);
    setWrongPassword(false);
    setRoomLoading(false);
  };

  // 用户协议弹窗
  if (showTerms) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-white/10">
          <div className="p-6 space-y-6">
            <h2 className="text-2xl font-bold text-center text-white">Terms of Service & Privacy Policy</h2>
            <div className="space-y-4 text-sm text-gray-300 max-h-96 overflow-y-auto">
              <div>
                <h3 className="font-bold text-green-400">I. Terms of Service</h3>
                <p className="mt-1">This tool provides temporary instant messaging services. All chat text, files, and data are not stored on servers. No logs, no backups, no history.</p>
                <p className="mt-1">Users are strictly prohibited from using this tool to send illegal content. Using this tool means accepting all risks.</p>
              </div>
              <div>
                <h3 className="font-bold text-green-400">II. Privacy Policy</h3>
                <p className="mt-1">This tool does not collect personal information, does not require phone numbers, does not require real-name registration, does not record nicknames, and does not track identities. No chat content is stored.</p>
              </div>
              <div>
                <h3 className="font-bold text-green-400">III. Disclaimer</h3>
                <p className="mt-1">This tool is an anonymous temporary private communication tool, for legal and compliant private communication only. Any user engaging in illegal activities bears full responsibility.</p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-yellow-400 font-medium">Important Notice</p>
                <p className="text-yellow-300 text-xs mt-1">This platform stores no data. Messages and files auto-destroy. For legal communication only. Illegal use is prohibited.</p>
              </div>
            </div>
            <button
              onClick={() => setShowTerms(false)}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              I have read and agree
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (roomLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-pink-900 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-green-400" />
      </div>
    );
  }

  if (needPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-pink-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 max-w-sm w-full border border-white/20">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-yellow-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Room is Encrypted</h2>
            <p className="text-gray-400 text-sm mt-1">Please enter room password</p>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && verifyPassword()}
            placeholder="Enter password"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-center text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
          />
          {wrongPassword && <p className="text-red-400 text-sm text-center mb-4">Wrong password</p>}
          <button onClick={verifyPassword} className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-xl">
            Enter Room
          </button>
          <button onClick={() => navigate('/')} className="w-full mt-3 text-gray-400 hover:text-white text-sm">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-pink-900 flex flex-col">
      {/* 头部 */}
      <header className="bg-black/30 backdrop-blur-xl border-b border-white/10 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={leaveRoom} className="text-gray-400 hover:text-white transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="font-bold text-white flex items-center gap-2">
                Room {roomId}
                {isPaid && (
                  <span className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Crown className="w-3 h-3" /> Premium
                  </span>
                )}
              </h1>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  Unlimited users
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Duration {formatTime(meetingTimeLeft)}
                </span>
              </div>
            </div>
          </div>
          {isCreator && (
            <button onClick={dismissRoom} className="text-red-400 hover:text-red-300 text-sm font-medium bg-red-500/10 px-3 py-1.5 rounded-lg">
              Dismiss Room
            </button>
          )}
        </div>
      </header>

      {/* Message area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <p className="text-lg">No messages yet</p>
              <p className="text-sm mt-1">Send a message to start chatting</p>
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.user_id === (sessionStorage.getItem('userId') || userId)}
              isPaid={isPaid}
              destructionTime={destructionTime}
              onPreview={setShowPreview}
              onDownload={downloadFile}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 文件预览 */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-white/10 flex flex-col">
            <div className="p-4 border-b border-white/10 flex justify-between items-center flex-shrink-0">
              <h3 className="font-medium text-white">{showPreview.name}</h3>
              <div className="flex items-center gap-2">
                {showPreview.fileUrl && (
                  <button
                    onClick={() => downloadFile(showPreview.fileUrl!, showPreview.name)}
                    className="text-green-400 hover:text-green-300 flex items-center gap-1 text-sm"
                  >
                    <Download className="w-4 h-4" /> Download
                  </button>
                )}
                <button onClick={() => setShowPreview(null)} className="text-gray-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-black/50 flex items-center justify-center p-4">
              {showPreview.type === 'image' ? (
                <img src={showPreview.url} alt="preview" className="max-w-full max-h-[70vh] object-contain rounded-lg" />
              ) : (
                <div className="text-center py-8">
                  <File className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-300 mb-2">{showPreview.name}</p>
                  <p className="text-gray-500 text-sm mb-4">
                    {showPreview.type === 'pdf' && 'PDF Document'}
                    {showPreview.type === 'word' && 'Word Document'}
                    {showPreview.type === 'excel' && 'Excel Spreadsheet'}
                    {showPreview.type === 'file' && 'File'}
                    , please download to view
                  </p>
                  {showPreview.fileUrl && (
                    <button
                      onClick={() => downloadFile(showPreview.fileUrl!, showPreview.name)}
                      className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto"
                    >
                      <Download className="w-4 h-4" /> Download File
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 输入区域 */}
      <div className="bg-black/30 backdrop-blur-xl border-t border-white/10 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Type a message..."
                rows={1}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
            </div>
            {isPaid && (
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="p-3 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
              </button>
            )}
            {/* Duration selector */}
            <div className="flex flex-col items-center">
              <select
                value={destructionTime}
                onChange={(e) => setDestructionTime(Number(e.target.value))}
                className="bg-white/10 border border-white/20 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer"
                title="Duration"
              >
                {(isPaid ? DESTRUCTION_TIMES : FREE_DESTRUCTION_TIMES).map((t) => (
                  <option key={t.value} value={t.value} className="bg-gray-900">{t.label}</option>
                ))}
              </select>
              <span className="text-[10px] text-gray-400 mt-0.5">Effective</span>
            </div>
            <button onClick={sendMessage} disabled={!newMessage.trim()}
              className="p-3 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors disabled:opacity-50">
              <Send className="w-5 h-5" />
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar" onChange={handleFileUpload} className="hidden" />
          {!isPaid && <p className="text-xs text-gray-500 mt-2 text-center">Text only · Upgrade to Premium for file sharing</p>}
        </div>
      </div>

      {/* 底部声明 */}
      <footer className="bg-black/20 py-3 px-4">
        <p className="text-xs text-gray-500 text-center">Tech service only · No storage · No tracking · Burn after reading</p>
      </footer>
    </div>
  );
}

function MessageBubble({
  message,
  isOwn,
  isPaid,
  destructionTime,
  onPreview,
  onDownload
}: {
  message: TempMessage;
  isOwn: boolean;
  isPaid: boolean;
  destructionTime: number;
  onPreview: (p: any) => void;
  onDownload: (url: string, name: string) => void;
}) {
  const [remaining, setRemaining] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const createdAt = new Date(message.created_at).getTime();
    const expireAt = createdAt + (message.expire_in || destructionTime) * 1000;

    const update = () => {
      const r = Math.max(0, Math.floor((expireAt - Date.now()) / 1000));
      setRemaining(r);
      if (r <= 0) {
        setIsExpired(true);
      }
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [message.created_at, message.expire_in, destructionTime]);

  // 如果消息已过期，不渲染
  if (isExpired) {
    return null;
  }

  const formatRemaining = (s: number) => {
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  };

  const isUrgent = remaining < 30;
  const progressPercent = Math.max(0, Math.min(100, (remaining / ((message.expire_in || destructionTime))) * 100));

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] ${isOwn ? 'order-2' : ''}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-gray-500">{isOwn ? 'You' : message.user_name}</span>
          <span className="text-xs text-gray-500">{formatTimestamp(new Date(message.created_at))}</span>
        </div>

        {/* Message bubble */}
        <div className={`rounded-2xl px-4 py-3 ${isOwn ? 'bg-green-500 text-white rounded-br-sm' : 'bg-white/10 text-white border border-white/10 rounded-bl-sm backdrop-blur-sm'}`}>
          {message.type === 'text' && <p className="break-words whitespace-pre-wrap">{message.text}</p>}

          {message.type === 'image' && (
            <div>
              <img
                src={message.file_url}
                alt={message.file_name}
                className="rounded-lg max-w-[200px] max-h-[150px] object-cover cursor-pointer hover:opacity-90"
                onClick={() => onPreview({ type: 'image', url: message.file_url, name: message.file_name, fileUrl: message.file_url })}
              />
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs opacity-70 truncate max-w-[120px]">{message.file_name}</p>
                {isPaid && message.file_url && (
                  <button
                    onClick={() => onDownload(message.file_url!, message.file_name!)}
                    className="text-xs opacity-70 hover:opacity-100 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" /> Download
                  </button>
                )}
              </div>
            </div>
          )}

          {message.type === 'pdf' && (
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-red-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{message.file_name}</p>
                {message.file_size && <p className="text-xs opacity-70">{formatFileSize(message.file_size)}</p>}
              </div>
              <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">PDF</span>
              {isPaid && message.file_url && (
                <button
                  onClick={() => onDownload(message.file_url!, message.file_name!)}
                  className="p-2 hover:bg-white/10 rounded-lg flex-shrink-0"
                  title="Download file"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {message.type === 'word' && (
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{message.file_name}</p>
                {message.file_size && <p className="text-xs opacity-70">{formatFileSize(message.file_size)}</p>}
              </div>
              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Word</span>
              {isPaid && message.file_url && (
                <button
                  onClick={() => onDownload(message.file_url!, message.file_name!)}
                  className="p-2 hover:bg-white/10 rounded-lg flex-shrink-0"
                  title="Download file"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {message.type === 'excel' && (
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{message.file_name}</p>
                {message.file_size && <p className="text-xs opacity-70">{formatFileSize(message.file_size)}</p>}
              </div>
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Excel</span>
              {isPaid && message.file_url && (
                <button
                  onClick={() => onDownload(message.file_url!, message.file_name!)}
                  className="p-2 hover:bg-white/10 rounded-lg flex-shrink-0"
                  title="Download file"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {message.type === 'file' && (
            <div className="flex items-center gap-2">
              <Archive className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{message.file_name}</p>
                {message.file_size && <p className="text-xs opacity-70">{formatFileSize(message.file_size)}</p>}
              </div>
              {isPaid && message.file_url && (
                <button
                  onClick={() => onDownload(message.file_url!, message.file_name!)}
                  className="p-2 hover:bg-white/10 rounded-lg flex-shrink-0"
                  title="Download file"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* 倒计时进度条 */}
        <div className="mt-1">
          <div className="flex items-center gap-1">
            <Flame className={`w-3 h-3 ${isUrgent ? 'text-red-500 animate-pulse' : 'text-gray-500'}`} />
            <span className={`text-xs ${isUrgent ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
              {formatRemaining(remaining)} left
            </span>
          </div>
          {/* 进度条 */}
          <div className="mt-1 h-1 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 rounded-full ${isUrgent ? 'bg-red-500' : 'bg-green-500'}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
