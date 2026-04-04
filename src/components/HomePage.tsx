import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateRoomId, validateRoomId } from '../lib/utils';
import { supabase, Room } from '../lib/supabase';
import { Loader2, Zap, Crown, Users, Shield, Clock, AlertTriangle, Lock, UserPlus, ArrowRight } from 'lucide-react';

export default function HomePage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'free' | 'paid'>('free');
  const [roomId, setRoomId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const createFreeRoom = async () => {
    setLoading(true);
    setError('');
    try {
      const newRoomId = generateRoomId();
      const expireAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes
      const userId = 'user_' + Math.random().toString(36).substring(2, 15);

      const room: Room = {
        room_id: newRoomId,
        created_at: new Date().toISOString(),
        expire_at: expireAt,
        is_paid: false,
        password: null,
        max_users: 2
      };

      const { error: insertError } = await supabase.from('rooms').insert(room);
      if (insertError) {
        console.error('Insert error:', insertError);
        throw insertError;
      }

      sessionStorage.setItem('roomMode', 'free');
      sessionStorage.setItem('userId', userId);
      sessionStorage.setItem(`creator_${newRoomId}`, 'true');
      navigate(`/room/${newRoomId}`);
    } catch (err: any) {
      console.error('Create room error:', err);
      setError('Failed to create room: ' + (err.message || 'Please try again'));
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!validateRoomId(roomId)) {
      setError('Please enter 6-digit room number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error: selectError } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_id', roomId)
        .single();

      if (selectError || !data) {
        setError('Room not found');
        return;
      }

      if (new Date(data.expire_at) < new Date()) {
        setError('Room has expired');
        return;
      }

      const userId = 'user_' + Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem('roomMode', data.is_paid ? 'paid' : 'free');
      sessionStorage.setItem('userId', userId);
      navigate(`/room/${roomId}`);
    } catch (err) {
      setError('Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-pink-900 flex flex-col">
      {/* 顶部警告 */}
      <div className="bg-yellow-500/20 border-b border-yellow-500/30 text-yellow-400 py-3 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <p className="text-sm font-medium">This tool is for legal communication only. No data storage, messages auto-destroy. Illegal use is prohibited.</p>
        </div>
      </div>

      {/* 主内容 */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Logo区域 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-2xl mb-4">
              <Zap className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">TopChat</h1>
            <p className="text-gray-400 flex items-center justify-center gap-4 text-sm">
              <span className="flex items-center gap-1"><Shield className="w-4 h-4" />Private</span>
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" />Burn After Reading</span>
              <span className="flex items-center gap-1"><Users className="w-4 h-4" />Anonymous</span>
            </p>
          </div>

          {/* 主面板 - 玻璃拟态 */}
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-2xl">
            {/* 模式切换 */}
            <div className="flex rounded-xl bg-white/5 p-1 mb-6">
              <button
                onClick={() => setMode('free')}
                className={`flex-1 py-3 px-4 rounded-lg text-center font-medium transition-all flex items-center justify-center gap-2 ${
                  mode === 'free'
                    ? 'bg-green-500 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                Free Chat
              </button>
              <button
                onClick={() => setMode('paid')}
                className={`flex-1 py-3 px-4 rounded-lg text-center font-medium transition-all flex items-center justify-center gap-2 ${
                  mode === 'paid'
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Crown className="w-4 h-4" />
                Premium Chat
              </button>
            </div>

            {/* 功能说明 */}
            {mode === 'free' && (
              <div className="bg-green-500/10 rounded-xl p-4 mb-6 border border-green-500/20">
                <h3 className="text-green-400 font-semibold mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Free Chat Room
                </h3>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• Room expires in 5 minutes</li>
                  <li>• Text messages only</li>
                  <li>• Unlimited users</li>
                </ul>
              </div>
            )}

            {mode === 'paid' && (
              <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-xl p-4 mb-6 border border-yellow-500/20">
                <h3 className="text-yellow-400 font-semibold mb-2 flex items-center gap-2">
                  <Crown className="w-4 h-4" /> Premium Chat Room
                </h3>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• Messages expire 15s - 2.5h</li>
                  <li>• Send files and images</li>
                  <li>• Download files</li>
                  <li>• Unlimited users</li>
                  <li className="text-yellow-400 font-medium mt-2">$3/2.5h · $9.9/day · $19.9/month</li>
                </ul>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="space-y-4">
              {mode === 'free' ? (
                <button
                  onClick={createFreeRoom}
                  disabled={loading}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-4 px-6 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-green-500/30"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <UserPlus className="w-5 h-5" />
                  )}
                  Create Free Room
                  <ArrowRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={() => navigate('/paid-create')}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold py-4 px-6 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Crown className="w-5 h-5" />
                  )}
                  Create Premium Room
                  <ArrowRight className="w-5 h-5" />
                </button>
              )}

              {/* 分隔线 */}
              <div className="flex items-center gap-4 py-2">
                <div className="flex-1 h-px bg-white/20"></div>
                <span className="text-gray-400 text-sm">Or join existing room</span>
                <div className="flex-1 h-px bg-white/20"></div>
              </div>

              {/* 加入房间 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit room number"
                  className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 text-center text-lg tracking-widest"
                  maxLength={6}
                />
                <button
                  onClick={joinRoom}
                  disabled={loading || roomId.length !== 6}
                  className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium py-3 px-6 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center"
                >
                  Join
                </button>
              </div>

              {error && (
                <p className="text-red-400 text-sm text-center bg-red-500/10 rounded-lg py-2">{error}</p>
              )}
            </div>
          </div>

          {/* 功能特点 */}
          <div className="grid grid-cols-3 gap-4 mt-8">
            <div className="text-center">
              <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <Shield className="w-5 h-5 text-green-400" />
              </div>
              <p className="text-xs text-gray-400">Privacy</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <Clock className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-xs text-gray-400">Auto-destroy</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <Users className="w-5 h-5 text-purple-400" />
              </div>
              <p className="text-xs text-gray-400">No Login</p>
            </div>
          </div>
        </div>
      </div>

      {/* 底部法律声明 */}
      <footer className="bg-black/20 py-4 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-2">
          <div className="flex items-center justify-center gap-1 text-yellow-400 text-xs">
            <AlertTriangle className="w-3 h-3" />
            <span>This tool provides technical services only. No storage, no monitoring, no tracking. User is responsible for content. Messages burn after reading.</span>
          </div>
          <div className="flex justify-center gap-4 text-xs text-gray-500">
            <button className="hover:text-white transition-colors">Terms of Service</button>
            <span>|</span>
            <button className="hover:text-white transition-colors">Privacy Policy</button>
            <span>|</span>
            <button className="hover:text-white transition-colors">Disclaimer</button>
          </div>
          <p className="text-xs text-gray-600">TopChat © 2024</p>
        </div>
      </footer>
    </div>
  );
}
