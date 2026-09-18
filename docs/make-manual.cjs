// 生成客户版功能手册：截图 base64 内嵌单文件 HTML，微信/邮件可直接发送
const fs = require('fs')
const path = require('path')

const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'manual-shots', f)).toString('base64')

// 章节按业务旅程编排：(图片, 标题, 说明)
const chapters = [
  ['01-home.png', '工作台 · 每天的驾驶舱', '打开系统第一眼：今日待检测、维修中、待结算、已完成一目了然；本月营收实时统计，挂账金额自动汇总。点任意数字直达对应工单列表。'],
  ['02-checkin.png', '第一步 · 接车登记', '选择老客户（按最近到店排序，熟客一键带出）或现场新建；常见诉求点标签即填，车况随手拍照留证，杜绝交车纠纷。'],
  ['03-order-pending.png', '工单档案自动建立', '接车信息、照片、车况描述自动归档为一张工单，后续所有环节都在这张工单上流转，全程留痕。'],
  ['04-quote.png', '第二步 · 检测报价', '检测结果、工时、配件逐项开单，数量单价自动算小计；支持一键带入这辆车上次的项目、一键生成小保养模板，常用报价几秒完成。'],
  ['13-quote-image.png', '报价单一键发客户', '报价自动生成带门店名的单据图片，微信直接发给客户确认——客户不用到店也能看懂每一分钱。'],
  ['05-repairing.png', '第三步 · 维修施工', '施工过程随时文字记录；维修中发现新问题，登记为增项，客户确认后才计入费用——先确认后施工，不扯皮。'],
  ['06-settlement.png', '第四步 · 质检结算', '质检通过后结算单自动生成：项目合计、优惠、应收金额清清楚楚，不需要手工算账。'],
  ['07-payment.png', '第五步 · 收款', '现金、微信、支付宝、刷卡、转账五种方式；支持分次收款和挂账，页面实时显示待收金额，多收一分会拦截。'],
  ['08-paid.png', '收款记录全程可查', '每一笔收款都有记录：时间、方式、金额。部分收款、补款、结清状态自动更新，账目对得上。'],
  ['09-deliver.png', '第六步 · 交车', '录入交车里程、确认交付，工单完成。整个过程从接车到交车，每一步都有据可查。'],
  ['10-completed.png', '完整档案 · 随时回查', '完成的工单就是一辆车的维修档案：什么时候修的、换了什么、收了多少钱，客户下次到店一查便知。'],
  ['11-reminders.png', '自动提醒 · 不漏一单生意', '交车后自动生成回访提醒（3天后）和保养提醒（3个月后）；挂账未清的，7天/30天自动催收提醒，欠款不再静默流失。'],
  ['12-stats.png', '经营统计 · 心里有数', '月度营收趋势、工单状态分布、维修项目热度、挂账明细——店里干得怎么样，数据说了算。']
]

const img = (f, alt) => `<img src="${b64(f)}" alt="${alt}" />`

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>汽修管理系统 · 功能全览</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif; background:#f5f6f8; color:#26282c; line-height:1.75; }
  .cover { background:#101114; color:#fff; text-align:center; padding:64px 24px 56px; }
  .cover h1 { font-size:30px; letter-spacing:2px; }
  .cover p { color:#aeb2ba; margin-top:14px; font-size:15px; }
  .cover .badge { display:inline-block; margin-top:22px; border:1px solid #3a3d44; border-radius:999px; padding:4px 16px; font-size:12px; color:#c9cdd6; }
  .wrap { max-width:760px; margin:0 auto; padding:36px 18px 60px; }
  .step { background:#fff; border-radius:14px; padding:26px 26px 20px; margin-bottom:26px; box-shadow:0 1px 4px rgba(20,22,26,.06); }
  .step h2 { font-size:18px; margin-bottom:10px; }
  .step h2 .no { display:inline-flex; width:26px; height:26px; border-radius:8px; background:#5e6ad2; color:#fff; font-size:14px; align-items:center; justify-content:center; margin-right:10px; vertical-align:-4px; }
  .step p { font-size:14px; color:#4b4f57; margin-bottom:16px; }
  .shot { border-radius:12px; overflow:hidden; border:1px solid #e3e5ea; background:#101114; text-align:center; }
  .shot img { width:100%; max-width:340px; display:block; margin:0 auto; }
  .foot { text-align:center; color:#8b8f98; font-size:12.5px; padding:10px 0 40px; }
  .foot b { color:#4b4f57; }
</style>
</head>
<body>
  <div class="cover">
    <h1>汽修管理系统</h1>
    <p>一部手机，管好接车、报价、维修、结算、交车全流程</p>
    <div class="badge">密码保护 · 数据留痕 · 自动提醒</div>
  </div>
  <div class="wrap">
    ${chapters.map(([f, t, d], i) => `
    <div class="step">
      <h2><span class="no">${i + 1}</span>${t}</h2>
      <p>${d}</p>
      <div class="shot">${img(f, t)}</div>
    </div>`).join('')}
    <div class="step" style="text-align:center">
      <h2 style="margin-bottom:6px">数据安全</h2>
      <p style="margin-bottom:0">系统设有访问密码保护，客户信息、车辆照片与经营数据均存储在店主自己的设备上，不经第三方平台。</p>
    </div>
  </div>
  <div class="foot">以上为系统真实界面截图（演示数据）· <b>支持手机、平板、电脑浏览器使用</b></div>
</body>
</html>`

fs.writeFileSync(path.join(__dirname, '汽修管理系统-功能手册.html'), html)
console.log('手册已生成，大小:', (fs.statSync(path.join(__dirname, '汽修管理系统-功能手册.html')).size / 1024 / 1024).toFixed(2), 'MB')
