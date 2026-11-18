#!/usr/bin/env bash
# 发布已验证镜像：备份 → 数据库迁移 → 应用探活 → 公网入口；失败时恢复上一版应用
set -Eeuo pipefail
root="$(cd -- "${1:-/opt/carweb}" && pwd -P)"
# 从 current 软链接重发当前版本时，也使用真实版本目录完成校验
release_dir="$(cd -- "$(dirname -- "$0")" && pwd -P)"
release="$(basename -- "$release_dir")"
[[ "$release" =~ ^[a-f0-9]{40}$ && "$release_dir" == "$root/releases/$release" ]] || {
  echo '版本目录必须为 releases/<完整提交 SHA>' >&2; exit 1;
}
[[ -f "$root/.env" ]] || { echo '请先执行 init.sh' >&2; exit 1; }
[[ ! -e "$root/current" || -L "$root/current" ]] || { echo 'current 必须是版本软链接' >&2; exit 1; }
exec 9>"$root/.deploy.lock"
flock -n 9 || { echo '已有发布正在执行' >&2; exit 1; }
export APP_IMAGE="carweb:$release"
compose=(docker compose -p carweb --env-file "$root/.env" -f "$release_dir/compose.yaml")
"${compose[@]}" config --quiet
previous="$(readlink -f -- "$root/current" || true)"
proxy_before="$("${compose[@]}" --profile public ps --status running -q proxy)"
if [[ -n "$previous" && -d "$previous" ]]; then
  [[ "$previous" == "$root/releases/"* && "$(basename -- "$previous")" =~ ^[a-f0-9]{40}$ ]] || exit 1
fi

# 镜像随发布包传入，服务器不需要连接镜像仓库；导入后移除这份传输缓存
if [[ -f "$release_dir/images.tar.gz" ]]; then
  docker load --input "$release_dir/images.tar.gz"
  rm -- "$release_dir/images.tar.gz"
fi
docker image inspect "$APP_IMAGE" >/dev/null

rollback_app() {
  echo '发布失败，正在恢复上一版应用；数据库迁移不会自动撤销。' >&2
  if [[ -n "$previous" && -d "$previous" ]]; then
    APP_IMAGE="carweb:$(basename -- "$previous")" docker compose -p carweb \
      --env-file "$root/.env" -f "$previous/compose.yaml" \
      up -d --no-deps --wait --wait-timeout 120 app || {
        echo "旧版应用也未通过探活，请查看日志并检查 $root/backups 中的备份。" >&2
        return 1
      }
    if [[ -n "$proxy_before" ]]; then
      APP_IMAGE="carweb:$(basename -- "$previous")" docker compose -p carweb \
        --env-file "$root/.env" -f "$previous/compose.yaml" --profile public up -d --no-deps proxy
    else
      "${compose[@]}" --profile public stop proxy
    fi
  else
    "${compose[@]}" --profile public stop proxy app
  fi
}

# 已有版本时先完成备份，再执行迁移；迁移失败不会替换正在运行的应用
if [[ -n "$previous" && -d "$previous" && "$previous" != "$release_dir" ]]; then
  bash "$previous/backup.sh" "$root"
fi
"${compose[@]}" up -d --wait --wait-timeout 90 db
"${compose[@]}" run --rm --no-deps app node /app/prisma-cli/node_modules/prisma/build/index.js \
  migrate deploy --schema /app/prisma/schema.prisma

if ! "${compose[@]}" up -d --no-deps --wait --wait-timeout 120 app; then
  rollback_app
  exit 1
fi

if grep -Eq '^PUBLIC_ENABLED=1[[:space:]]*$' "$root/.env"; then
  # 首次设置访问密码通过 SSH 隧道完成，禁止把尚未初始化的入口发布到公网
  if ! "${compose[@]}" exec -T app node -e \
    'fetch("http://127.0.0.1:3000/api/auth/status").then(async r=>{if(!r.ok||(await r.json()).initialized!==true)process.exit(1)}).catch(()=>process.exit(1))'; then
    echo '尚未设置访问密码，未开放公网。请通过 SSH 隧道完成初始化。' >&2
    rollback_app
    exit 1
  fi
  if ! "${compose[@]}" --profile public up -d --no-deps --wait --wait-timeout 60 proxy; then
    rollback_app
    exit 1
  fi
  domain="$("${compose[@]}" exec -T proxy printenv DOMAIN)"
  if ! curl --fail --silent --show-error --retry 10 --retry-all-errors --retry-delay 5 --max-time 10 \
    --resolve "$domain:443:127.0.0.1" "https://$domain/api/auth/status" >/dev/null; then
    echo 'HTTPS 探活失败，请检查域名解析、备案和 80/443 端口。' >&2
    rollback_app
    exit 1
  fi
else
  "${compose[@]}" --profile public stop proxy
  echo '应用已就绪，公网入口尚未开启。请通过 SSH 隧道初始化访问密码。'
fi

if [[ -n "$previous" && -d "$previous" && "$previous" != "$release_dir" ]]; then
  ln -sfn -- "$previous" "$root/previous"
fi
ln -sfn -- "$release_dir" "$root/current"
echo "发布成功：$release"

# 只清理本应用的旧提交镜像，保留当前版和上一版；不会删除数据卷或其他应用镜像
keep_previous="$(basename -- "$(readlink -f -- "$root/previous" 2>/dev/null || true)")"
while IFS= read -r tag; do
  [[ "$tag" =~ ^[a-f0-9]{40}$ && "$tag" != "$release" && "$tag" != "$keep_previous" ]] || continue
  docker image rm "carweb:$tag" || true
done < <(docker image ls carweb --format '{{.Tag}}')
