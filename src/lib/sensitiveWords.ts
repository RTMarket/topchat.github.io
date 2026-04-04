// 敏感词列表 - 简化版
const sensitiveWords = [
  // 色情类
  '色情', '黄色', '裸体', '成人', '一夜情', '约炮', '援交',
  // 暴力类
  '暴力', '杀人', '虐待', '恐怖',
  // 诈骗类
  '诈骗', '骗子', '钓鱼', '木马', '病毒',
  // 政治类 (简化)
  '敏感', '封禁',
  // 其他违法
  '毒品', '赌博', '走私', '枪支'
];

export function containsSensitiveWords(text: string): boolean {
  const lowerText = text.toLowerCase();
  return sensitiveWords.some(word => lowerText.includes(word.toLowerCase()));
}

export function filterSensitiveWords(text: string): string {
  let filtered = text;
  sensitiveWords.forEach(word => {
    const regex = new RegExp(word, 'gi');
    filtered = filtered.replace(regex, '***');
  });
  return filtered;
}
