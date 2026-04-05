// 支付相关工具函数 + 7种套餐配置

export interface Plan {
  id: string
  label: string
  price: number
  period: string // "1天" | "7天" | "30天" | "30天"
  features: string[]
  highlight?: boolean
}

export const PLAN_LIST: Plan[] = [
  {
    id: 'daily',
    label: '日卡',
    price: 9.9,
    period: '1天',
    features: [
      '24小时畅聊',
      '支持4人同时在线',
      '基础消息记录',
    ],
  },
  {
    id: 'weekly',
    label: '周卡',
    price: 39.9,
    period: '7天',
    features: [
      '7天畅聊',
      '支持8人同时在线',
      '消息记录保留30天',
    ],
    highlight: true,
  },
  {
    id: 'monthly',
    label: '月卡',
    price: 99.9,
    period: '30天',
    features: [
      '30天畅聊',
      '支持12人同时在线',
      '消息永久保留',
    ],
  },
  {
    id: 'enterprise',
    label: '企业版',
    price: 299,
    period: '30天',
    features: [
      '30天企业畅聊',
      '支持30人同时在线',
      '专属客服支持',
      '消息永久保留',
    ],
  },
]

export const PLAN_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  enterprise: 30,
}

const SUPABASE_URL = 'https://ewbmvcldtadcffhvcwba.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Ym12Y2xkdGFkY2ZmaHZjd2JhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQyNzEsImV4cCI6MjA5MDgxMDI3MX0.K24BDa4Wu-4sfe-LOpOihX4VjgugNRsuDlhMi8PBxtA'

async function callEdgeFunction(url: string, body: object) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `请求失败: ${res.status}`)
  }
  return res.json()
}

export async function createAlipayOrder(planId: string, planName: string, amount: number) {
  return callEdgeFunction(
    `${SUPABASE_URL}/functions/v1/alipay-create-order`,
    { planId, planName, amount }
  )
}

export async function queryPayStatus(outTradeNo: string, planId: string) {
  return callEdgeFunction(
    `${SUPABASE_URL}/functions/v1/alipay-query-order`,
    { outTradeNo, planId }
  )
}
