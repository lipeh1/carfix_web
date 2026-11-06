// 由 prisma/schema.prisma 派生「云开发 MySQL」版 schema，避免两份数据模型手工同步
// 差异只有两处：
//   1) datasource provider 由 postgresql 改为 mysql
//   2) 长文本字段补 @db.Text —— MySQL 下 String 默认 VARCHAR(191)，存 JSON / 长备注会被截断
// 产物 prisma/mysql/schema.prisma 为生成文件，请勿手改；改模型请改 prisma/schema.prisma 后重新执行本脚本
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = join(root, 'prisma', 'schema.prisma')
const outputPath = join(root, 'prisma', 'mysql', 'schema.prisma')

// 需要按 TEXT 存储的字段（JSON 串、长备注、长描述），其余保持默认 VARCHAR(191)
const TEXT_FIELDS = new Set([
  'complaint', // 客户诉求，可能有多条标签拼接
  'inspection', // 检测结论
  'vehicleCondition', // 车况描述
  'itemsInCar', // 车内物品清单
  'checkItems', // 质检项，JSON 字符串，长度不可控
  'content', // 工单日志 / 提醒内容
  'description', // 项目描述
  'remark', // 各类备注
  'address', // 客户地址
  'cancelReason', // 工单取消原因（用户自由填写）
  'reason', // 增项原因（用户自由填写）
  'feedback' // 回访反馈（用户自由填写）
])

const HEADER = `// ⚠️ 本文件由 scripts/gen-mysql-schema.mjs 自动生成，请勿手动修改
// 源文件：prisma/schema.prisma（PostgreSQL）
// 用途：部署到腾讯云 CloudBase 云托管时连接云开发 MySQL
`

// 统一按 LF 处理（源文件可能是 CRLF，\r 会破坏行尾正则匹配）
const lines = readFileSync(sourcePath, 'utf8').split(/\r?\n/)

const output = lines.map(line => {
  // provider 切换
  let next = line.replace('provider = "postgresql"', 'provider = "mysql"')

  // 字段声明形如：  remark    String?   @map("remark") // 注释
  const matched = /^(\s+)(\w+)(\s+)String(\??)(.*)$/.exec(next)
  if (matched && TEXT_FIELDS.has(matched[2]) && !next.includes('@db.')) {
    const commentIndex = next.indexOf('//')
    next =
      commentIndex === -1
        ? `${next.trimEnd()} @db.Text`
        : `${next.slice(0, commentIndex).trimEnd()} @db.Text ${next.slice(commentIndex)}`
  }
  return next
})

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, HEADER + output.join('\n'), 'utf8')

console.log(`已生成 ${outputPath}`)
