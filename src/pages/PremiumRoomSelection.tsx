import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PaymentModal from '../components/PaymentModal'
import { PLAN_LIST } from '../lib/payment'

interface PremiumRoom {
  id: string
  password: string
  destroy: number
  createdAt: string
  created_by?: string
  status?: string
}

interface ActivePremiumRoom {
  id: string
  createdAt: string
  destroySeconds: number
}

function isPremiumRoomCreator(roomId: string): boolean {
  try {
    const created: string[] = JSON.parse(localStorage.getItem('toptalk_premium_created_rooms') || '[]')
    return created.includes(roomId)
  } catch { return false }
}

function isSubscribed(): boolean {
  try {
    const sub = localStorage.getItem('toptalk_subscription')
    if (!sub) return false
    const obj = JSON.parse(sub)
    return new Date(obj.expireAt) > new Date()
  } catch { return false }
}

export default function PremiumRoomSelection() {
  const navigate = useNavigate()
  const [myRooms, setMyRooms] = useState<PremiumRoom[]>([])
  const [createModal, setCreateModal] = useState(false)
  const [joinModal, setJoinModal] = useState(false)
  const [createId, setCreateId] = useState('')
  const [joinId, setJoinId] = useState('')
  const [joinPwd, setJoinPwd] = useState('')
  const [error, setError] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createDuration, setCreateDuration] = useState(3600)
  const [createLoading, setCreateLoading] = useState(false)
  const [joinLoading, setJoinLoading] = useState(false)
  const [activeRoom, setActiveRoom] = useState<ActivePremiumRoom | null>(null)
  const [activeRoomRemaining, setActiveRoomRemaining] = useState(0)
  const [payPlanId, setPayPlanId] = useState<string | null>(null)

  const durationOptions = [
    { label: '1小时', value: 3600 },
    { label: '6小时', value: 21600 },
    { label: '12小时', value: 43200 },
    { label: '24小时', value: 86400 },
  ]

  const loadRooms = async () => {
    try {
      const { data } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_type', 'premium')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(20)
      if (data) {
        const dissolved: string[] = JSON.parse(localStorage.getItem('toptalk_premium_dissolved') || '[]')
        const rooms = data
          .filter((r: any) => !dissolved.includes(r.id))
          .map((r: any) => ({
            id: r.id,
            password: r.password || '',
            destroy: r.destroy_seconds || 3600,
            createdAt: r.created_at,
            created_by: r.created_by,
            status: r.status,
          }))
        setMyRooms(rooms)
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    const active = localStorage.getItem('toptalk_premium_active_room')
    if (active) {
      const room: ActivePremiumRoom = JSON.parse(active)
      const remaining = Math.max(0, room.destroySeconds * 1000 - (Date.now() - new Date(room.createdAt).getTime()))
      if (remaining > 0) {
        setActiveRoom(room)
        setActiveRoomRemaining(remaining)
      } else {
        localStorage.removeItem('toptalk_premium_active_room')
      }
    }
    loadRooms()
  }, [])

  useEffect(() => {
    if (!activeRoom) return
    const id = setInterval(() => {
      const remaining = Math.max(0, activeRoom.destroySeconds * 1000 - (Date.now() - new Date(activeRoom.createdAt).getTime()))
      setActiveRoomRemaining(remaining)
      if (remaining === 0) {
        clearInterval(id)
        localStorage.removeItem('toptalk_premium_active_room')
        setActiveRoom(null)
        loadRooms()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [activeRoom?.id])

  const formatCountdown = (ms: number) => {
    const s = Math.floor(ms / 1000)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return h > 0 ? `${h}时${m}分${sec}秒` : `${m}分${sec}秒`
  }

  const handleCreateRoom = async () => {
    if (!createId.trim()) { setError('请输入房间ID'); return }
    if (createId.trim().length < 4) { setError('房间ID至少4个字符'); return }
    if (!createPassword.trim()) { setError('请设置房间密码'); return }
    if (createPassword.trim().length < 4) { setError('房间密码至少4个字符'); return }
    setError('')
    setCreateLoading(true)
    const newId = createId.trim()
    const createPwd = createPassword.trim()
    const now = Date.now()
    const room: PremiumRoom = { id: newId, password: createPwd, destroy: createDuration, createdAt: new Date(now).toISOString() }
    try {
      localStorage.setItem('toptalk_premium_active_room', JSON.stringify({ id: newId, createdAt: now, destroySeconds: createDuration }))
      const existing: PremiumRoom[] = JSON.parse(localStorage.getItem('toptalk_premium_rooms') || '[]')
      localStorage.setItem('toptalk_premium_rooms', JSON.stringify([room, ...existing].slice(0, 50)))
      const created: string[] = JSON.parse(localStorage.getItem('toptalk_premium_created_rooms') || '[]')
      if (!created.includes(newId)) { created.push(newId); localStorage.setItem('toptalk_premium_created_rooms', JSON.stringify(created)) }
    } catch { /* ignore */ }
    try {
      await supabase.from('rooms').upsert({ id: newId, room_type: 'premium', password: createPwd, destroy_seconds: createDuration, status: 'active' })
    } catch { /* ignore */ }
    setCreateLoading(false)
    setCreateModal(false)
    setCreatePassword('')
    loadRooms()
    const label = durationOptions.find(o => o.value === createDuration)?.label || '1小时'
    navigate(`/premium-chat?roomId=${newId}&destroy=${createDuration}&duration=${encodeURIComponent(label)}&password=${createPwd}`)
  }

  const handleJoinRoom = async () => {
    if (!joinId.trim()) { setError('请输入房间ID'); return }
    if (!joinPwd.trim()) { setError('请输入房间密码'); return }
    setError('')
    setJoinLoading(true)
    try {
      const { data } = await supabase.from('rooms').select('*').eq('id', joinId.trim()).eq('room_type', 'premium').single
      if (!data) { setError('房间不存在'); setJoinLoading(false); return }
      if (data.status === 'dissolved') { setError('房间已解散'); setJoinLoading(false); return }
      if (data.password !== joinPwd.trim()) { setError('密码错误'); setJoinLoading(false); return }
      const now = Date.now()
      localStorage.setItem('toptalk_premium_active_room', JSON.stringify({ id: joinId.trim(), createdAt: now, destroySeconds: data.destroy_seconds || 3600 }))
      const room: PremiumRoom = { id: joinId.trim(), password: joinPwd.trim(), destroy: data.destroy_seconds || 3600, createdAt: new Date(now).toISOString() }
      const existing: PremiumRoom[] = JSON.parse(localStorage.getItem('toptalk_premium_rooms') || '[]')
      localStorage.setItem('toptalk_premium_rooms', JSON.stringify([room, ...existing].slice(0, 50)))
    } catch { setError('加入房间失败') }
    setJoinLoading(false)
    setJoinModal(false)
    const label = '未知'
    navigate(`/premium-chat?roomId=${joinId.trim()}&destroy=3600&duration=${encodeURIComponent(label)}&password=${joinPwd}`)
  }

  const handleDissolveRoom = async (roomId: string) => {
    try {
      await supabase.from('rooms').update({ status: 'dissolved' }).eq('id', roomId)
    } catch { /* ignore */ }
    try {
      const dissolved: string[] = JSON.parse(localStorage.getItem('toptalk_premium_dissolved') || '[]')
      if (!dissolved.includes(roomId)) { dissolved.push(roomId); localStorage.setItem('toptalk_premium_dissolved', JSON.stringify(dissolved)) }
      const rooms: PremiumRoom[] = JSON.parse(localStorage.getItem('toptalk_premium_rooms') || '[]')
      localStorage.setItem('toptalk_premium_rooms', JSON.stringify(rooms.filter(r => r.id !== roomId)))
      if (activeRoom?.id === roomId) { localStorage.removeItem('toptalk_premium_active_room'); setActiveRoom(null) }
      const created: string[] = JSON.parse(localStorage.getItem('toptalk_premium_created_rooms') || '[]')
      localStorage.setItem('toptalk_premium_created_rooms', JSON.stringify(created.filter(id => id !== roomId)))
    } catch { /* ignore */ }
    loadRooms()
  }

  const handleSelectPlan = (planId: string) => {
    setPayPlanId(planId)
  }

  const handlePaySuccess = (planLabel: string) => {
    const PLAN_DAYS: Record<string, number> = { daily: 1, weekly: 7, monthly: 30, enterprise: 30 }
    const days = PLAN_DAYS[payPlanId || ''] || 30
    const expireAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
    const sub = { planId: payPlanId, expireAt, label: planLabel }
    localStorage.setItem('toptalk_subscription', JSON.stringify(sub))
    setPayPlanId(null)
    window.location.reload()
  }

  const subscribed = isSubscribed()
  const PLAN_NAMES: Record<string, string> = { daily: '日卡', weekly: '周卡', monthly: '月卡', enterprise: '企业版' }
  const planName = subscribed ? PLAN_NAMES[(JSON.parse(localStorage.getItem('toptalk_subscription') || '{}') as any).planId || ''] || '' : ''
  const expireText = subscribed ? `到期: ${new Date((JSON.parse(localStorage.getItem('toptalk_subscription') || '{}') as any).expireAt).toLocaleDateString('zh-CN')}` : ''

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] to-[#0d2a4a] text-white">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">高级聊天室</h1>
            <p className="text-gray-400 text-xs mt-0.5">私密加密 · 专属空间</p>
          </div>
          <div className="flex items-center gap-3">
            {subscribed ? (
              <>
                <div className="bg-yellow-400/20 border border-yellow-400/30 text-yellow-400 text-xs px-3 py-1.5 rounded-full font-medium">{planName}</div>
                <div className="flex items-center gap-2 bg-white/8 border border-white/12 rounded-full px-3 py-1.5">
                  <span className="text-yellow-400 text-xs font-bold">VIP</span>
                  <span className="text-gray-400 text-xs">{expireText}</span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 bg-white/8 border border-white/12 rounded-full px-3 py-1.5">
                <span className="text-gray-500 text-xs">未订阅</span>
              </div>
            )}
          </div>
        </div>

        {/* Active Room Banner */}
        {activeRoom && (
          <div className="mb-4 bg-gradient-to-r from-blue-900/60 to-indigo-900/60 border border-blue-500/30 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-300 text-xs font-medium mb-1">当前活跃房间</p>
                <p className="text-white font-bold text-sm">{activeRoom.id}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-xs mb-1">剩余时间</p>
                <p className="text-yellow-400 font-bold text-sm">{formatCountdown(activeRoomRemaining)}</p>
              </div>
            </div>
            <button onClick={() => navigate(`/premium-chat?roomId=${activeRoom.id}&destroy=${activeRoom.destroySeconds}&duration=当前&password=`)} className="mt-3 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-colors">
              进入房间
            </button>
          </div>
        )}

        {/* My Rooms */}
        {myRooms.length > 0 && (
          <div className="mb-6">
            <h2 className="text-gray-300 text-sm font-semibold mb-3">我的聊天室</h2>
            <div className="space-y-3">
              {myRooms.map((room, i) => {
                const isCreator = isPremiumRoomCreator(room.id)
                const roomRemain = () => { try { const e = new Date(room.createdAt).getTime() + (room.destroy || 3600) * 1000; return Math.max(0, e - Date.now()) } catch { return 0 } }
                return (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-white font-bold text-sm">{room.id}</p>
                        <p className="text-gray-400 text-xs mt-0.5">密码: {'●'.repeat(room.password?.length || 4)} · {isCreator ? '创建者' : '加入者'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-400 text-xs">剩余</p>
                        <p className="text-yellow-400 text-xs font-bold">{formatCountdown(roomRemain())}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => navigate(`/premium-chat?roomId=${room.id}&destroy=${room.destroy}&duration=${encodeURIComponent(formatCountdown(roomRemain()))}&password=${room.password}`)} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors">
                        进入
                      </button>
                      {isCreator && (
                        <button onClick={() => handleDissolveRoom(room.id)} className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold rounded-lg border border-red-500/20 transition-colors">
                          解散
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Pricing Plans */}
        <div className="mb-6">
          <h2 className="text-gray-300 text-sm font-semibold mb-3">订阅套餐</h2>
          <div className="space-y-3">
            {PLAN_LIST.map((plan) => (
              <div key={plan.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-white font-bold text-sm">{plan.label}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{plan.period}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-yellow-400 font-bold text-base">¥{plan.price}</p>
                  </div>
                </div>
                <div className="mb-3">
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-gray-400">
                      <span className="text-green-400 flex-shrink-0 mt-0.5">✓</span>
                      {f}
                    </div>
                  ))}
                </div>
                <button onClick={() => handleSelectPlan(plan.id)} className={`w-full py-2.5 rounded-xl text-sm font-bold transition-colors ${plan.highlight ? 'bg-yellow-400 hover:bg-yellow-300 text-[#1a365d]' : 'bg-white/10 hover:bg-white/15 text-white border border-white/15'}`}>
                  {subscribed ? '已订阅' : '立即订阅'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Create / Join */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button onClick={() => { setCreateModal(true); setError('') }} className="py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-colors">
            + 创建房间
          </button>
          <button onClick={() => { setJoinModal(true); setError('') }} className="py-3 bg-white/10 hover:bg-white/15 text-white text-sm font-bold rounded-xl border border-white/15 transition-colors">
            加入房间
          </button>
        </div>
      </div>

      {/* Create Modal */}
      {createModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0d2a4a] border border-white/10 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-white font-bold text-base mb-4">创建高级房间</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">房间ID（至少4字符）</label>
                <input value={createId} onChange={e => setCreateId(e.target.value)} placeholder="例如: 我的私密室" className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">房间密码（至少4字符）</label>
                <input type="password" value={createPassword} onChange={e => setCreatePassword(e.target.value)} placeholder="设置房间密码" className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">房间时长</label>
                <div className="grid grid-cols-2 gap-2">
                  {durationOptions.map(opt => (
                    <button key={opt.value} onClick={() => setCreateDuration(opt.value)} className={`py-2 text-xs font-bold rounded-xl border transition-colors ${createDuration === opt.value ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setCreateModal(false)} className="flex-1 py-2.5 bg-white/10 hover:bg-white/15 text-white text-sm font-bold rounded-xl border border-white/10 transition-colors">取消</button>
              <button onClick={handleCreateRoom} disabled={createLoading} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
                {createLoading ? '创建中...' : '确认创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Modal */}
      {joinModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0d2a4a] border border-white/10 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-white font-bold text-base mb-4">加入高级房间</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">房间ID</label>
                <input value={joinId} onChange={e => setJoinId(e.target.value)} placeholder="请输入房间ID" className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">房间密码</label>
                <input type="password" value={joinPwd} onChange={e => setJoinPwd(e.target.value)} placeholder="请输入房间密码" className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setJoinModal(false)} className="flex-1 py-2.5 bg-white/10 hover:bg-white/15 text-white text-sm font-bold rounded-xl border border-white/10 transition-colors">取消</button>
              <button onClick={handleJoinRoom} disabled={joinLoading} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
                {joinLoading ? '加入中...' : '确认加入'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {payPlanId && (
        <PaymentModal
          planId={payPlanId}
          planName={(PLAN_LIST.find(p => p.id === payPlanId)?.label || payPlanId) as any}
          amount={(PLAN_LIST.find(p => p.id === payPlanId)?.price.toString() || '0') as any}
          onClose={() => setPayPlanId(null)}
          onSuccess={handlePaySuccess as any}
        />
      )}
    </div>
  )
}
