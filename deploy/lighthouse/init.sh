#!/usr/bin/env bash
# 初始化服务器运行目录与随机数据库密码；重复执行不会覆盖已有配置
set -Eeuo pipefail
umask 077
root="${1:-/opt/carweb}"
template="$(cd -- "$(dirname -- "$0")" && pwd)/.env.example"
[[ "$root" == /* && "$root" != / ]] || { echo '部署目录必须是绝对路径且不能为根目录' >&2; exit 1; }
docker compose version >/dev/null
mkdir -p -- "$root/releases" "$root/backups"
if [[ -e "$root/.env" ]]; then
  echo '已有 .env，保留原配置。'
  exit 0
fi
password="$(openssl rand -hex 32)"
sed "s/^POSTGRES_PASSWORD=$/POSTGRES_PASSWORD=$password/" "$template" > "$root/.env"
chmod 600 "$root/.env"
echo "已初始化 $root；请检查 .env 中的域名与 OCR 配置。"
echo '首次发布默认只开放本机端口，设置访问密码后再开启 PUBLIC_ENABLED。'
