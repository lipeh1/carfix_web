#!/usr/bin/env bash
# 保存数据库和本地照片，保留最近 14 组完整备份；备份目录仅当前用户可读
set -Eeuo pipefail
umask 077
root="$(cd -- "${1:-/opt/carweb}" && pwd)"
release_dir="$(readlink -f -- "$root/current")"
[[ "$release_dir" == "$root/releases/"* ]] || { echo '当前版本路径不在部署目录内' >&2; exit 1; }
export APP_IMAGE="carweb:$(basename -- "$release_dir")"
compose=(docker compose -p carweb --env-file "$root/.env" -f "$release_dir/compose.yaml")
mkdir -p -- "$root/backups"
exec 8>"$root/.backup.lock"
flock -n 8 || { echo '已有备份在执行' >&2; exit 1; }
# 纳秒后缀避免短时间内重复备份覆盖上一组完整文件
prefix="$root/backups/carweb-$(date -u +%Y%m%dT%H%M%SZ)-$(date -u +%N)"
"${compose[@]}" exec -T db pg_dump -U carweb -d carweb -Fc > "$prefix.dump.tmp"
"${compose[@]}" exec -T app tar -czf - -C /app/.uploads . > "$prefix.uploads.tar.gz.tmp"
mv -- "$prefix.dump.tmp" "$prefix.dump"
mv -- "$prefix.uploads.tar.gz.tmp" "$prefix.uploads.tar.gz"
touch "$prefix.complete"

# 仅删除由本脚本生成、且带完整标记的旧备份，失败产生的临时文件不参与轮换
mapfile -t backups < <(find "$root/backups" -maxdepth 1 -type f -name 'carweb-*.complete' -printf '%f\n' | sort -r)
for old in "${backups[@]:14}"; do
  [[ "$old" =~ ^carweb-[0-9]{8}T[0-9]{6}Z(-[0-9]{9})?\.complete$ ]] || continue
  base="$root/backups/${old%.complete}"
  rm -f -- "$base.dump" "$base.uploads.tar.gz" "$base.complete"
done
echo "备份完成：$prefix"
