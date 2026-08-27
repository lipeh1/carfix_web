// 金额工具：数据库与接口统一使用整数"分"，仅在展示与输入边界换算

// 分 → 元（保留两位小数的字符串，直接用于模板展示）
export const fenToYuan = (fen: number | string | null | undefined): string =>
  ((Number(fen) || 0) / 100).toFixed(2)

// 元 → 分（输入为元字符串/数字，返回整数分）
export const yuanToFen = (yuan: number | string): number =>
  Math.round((Number(yuan) || 0) * 100)
