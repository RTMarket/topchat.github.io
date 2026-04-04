import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateRoomId, DESTRUCTION_TIMES } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { Loader2, ChevronLeft } from 'lucide-react';

const PRICING = [
  { id: 'single', name: 'Single Use', price: 3, duration: '2.5 hours', hours: 2.5 },
  { id: 'daily', name: 'Daily Use', price: 9.9, duration: '24 hours', hours: 24 },
  { id: 'monthly', name: 'Monthly', price: 19.9, duration: '30 days', hours: 720 },
];

export default function PaidCreatePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState<string>('single');
  const [destructionTime, setDestructionTime] = useState(900);
  const [loading, setLoading] = useState(false);

  const selectedPricing = PRICING.find(p => p.id === selectedPlan)!;

  const handlePayment = async () => {
    setLoading(true);

    // 生成订单号
    const orderId = 'ORD' + Date.now();

    // 创建房间
    const roomId = generateRoomId();
    const expireAt = new Date(Date.now() + selectedPricing.hours * 60 * 60 * 1000).toISOString();
    const userId = 'user_' + Math.random().toString(36).substring(2, 15);

    try {
      // 创建订单记录
      await supabase.from('orders').insert({
        order_id: orderId,
        room_id: roomId,
        amount: selectedPricing.price,
        pay_time: new Date().toISOString(),
        paid: true // 模拟支付成功
      });

      // 创建付费房间
      await supabase.from('rooms').insert({
        room_id: roomId,
        created_at: new Date().toISOString(),
        expire_at: expireAt,
        is_paid: true,
        password: null,
        max_users: 999,
        destruction_time: destructionTime
      });

      // 存储到sessionStorage
      sessionStorage.setItem('roomMode', 'paid');
      sessionStorage.setItem('userId', userId);
      // 标记当前用户为房间创建者
      sessionStorage.setItem(`creator_${roomId}`, 'true');

      // 跳转到聊天室
      navigate(`/room/${roomId}`);
    } catch (err) {
      console.error(err);
      alert('Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部栏 */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center">
        <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700 mr-4">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Create Premium Chat Room</h1>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* 步骤指示器 */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {s}
              </div>
              {s < 2 && <div className={`w-12 h-0.5 ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <>
            {/* 定价选择 */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Select Plan</h2>
              <div className="space-y-3">
                {PRICING.map((plan) => (
                  <label key={plan.id} className="block">
                    <input
                      type="radio"
                      name="plan"
                      value={plan.id}
                      checked={selectedPlan === plan.id}
                      onChange={() => setSelectedPlan(plan.id)}
                      className="sr-only peer"
                    />
                    <div className="p-4 border-2 rounded-lg cursor-pointer transition-all peer-checked:border-blue-600 peer-checked:bg-blue-50">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-gray-900">{plan.name}</p>
                          <p className="text-sm text-gray-500">{plan.duration}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-600">${plan.price}</p>
                          {plan.id === 'monthly' && <p className="text-xs text-green-600">Recommended</p>}
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-4 px-6 rounded-lg transition-all"
            >
              Next Step
            </button>
          </>
        )}

        {step === 2 && (
          <>
            {/* 会议时长选择 */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Select Message Duration</h2>
              <div className="grid grid-cols-3 gap-2">
                {DESTRUCTION_TIMES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setDestructionTime(t.value)}
                    className={`py-2 px-3 text-sm rounded-lg border transition-all ${
                      destructionTime === t.value
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 订单摘要 */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4">
              <h2 className="text-lg font-bold text-gray-900 mb-3">Order Summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Plan</span>
                  <span className="font-medium">{selectedPricing.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration</span>
                  <span className="font-medium">{selectedPricing.duration}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Message Duration</span>
                  <span className="font-medium">{DESTRUCTION_TIMES.find(t => t.value === destructionTime)?.label}</span>
                </div>
                <div className="border-t pt-2 mt-2 flex justify-between">
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="font-bold text-2xl text-blue-600">${selectedPricing.price}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-4 px-6 rounded-lg transition-colors"
              >
                Back
              </button>
              <button
                onClick={handlePayment}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-4 px-6 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                Pay Now
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
