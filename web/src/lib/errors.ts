// 业务错误类型：路由层抛出后由 withRoute 统一转成对应状态码的 JSON 响应
export class AppError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.statusCode = statusCode
  }
}
