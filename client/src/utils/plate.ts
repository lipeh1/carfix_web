// 车牌号工具：省份简称、键盘字符集与格式校验
// 普通车牌 7 位（省份 + 发牌机关字母 + 5 位），新能源 8 位（后段 6 位）
// 字母位不含 I、O，避免与 1、0 混淆（与现行发牌规则一致）

/** 31 个省级行政区简称 */
export const PROVINCES = [
  '京', '津', '冀', '晋', '蒙', '辽', '吉', '黑', '沪', '苏',
  '浙', '皖', '闽', '赣', '鲁', '豫', '鄂', '湘', '粤', '桂',
  '琼', '渝', '川', '贵', '云', '藏', '陕', '甘', '青', '宁', '新'
] as const

/** 键盘字母集（无 I、O） */
export const PLATE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('')

/** 后段键盘字符集（数字 + 无 I、O 字母） */
export const PLATE_ALNUM = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'.split('')

/** 普通车牌长度（新能源为 8） */
export const PLATE_NORMAL_LEN = 7
export const PLATE_NE_LEN = 8

/** 判断是否为新能源车牌长度 */
export const isNeLength = (len: number) => len === PLATE_NE_LEN

/**
 * 校验车牌号格式（宽松业务校验）：
 * 第 1 位省份简称；第 2 位不发 I、O 的字母；后段 5 位（普通）/6 位（新能源）字母数字。
 * 末位不放宽挂/学/警等特殊字符，录入场景按普通字符处理。
 */
export function isValidPlate(plate: string): boolean {
  const p = (plate || '').trim().toUpperCase()
  if (p.length !== PLATE_NORMAL_LEN && p.length !== PLATE_NE_LEN) return false
  if (!PROVINCES.includes(p[0] as never)) return false
  if (!/[A-HJ-NP-Z]/.test(p[1])) return false
  const tailLen = p.length - 2
  return new RegExp(`^[A-HJ-NP-Z0-9]{${tailLen}}$`).test(p.slice(2))
}

/** 猜测新能源：长度达到 8 位 */
export const isNePlate = (plate: string) => plate.length >= PLATE_NE_LEN
