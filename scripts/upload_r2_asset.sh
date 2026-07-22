#!/usr/bin/env bash

set -euo pipefail

readonly BUCKET="iamjaehka13-blog-media"
readonly PUBLIC_BASE_URL="https://media.iamjaehka13.blog"

if (( $# == 0 )); then
  printf 'Usage: %s assets/path/to/file [...]\n' "$0" >&2
  exit 2
fi

for file in "$@"; do
  if [[ ! -f "$file" ]]; then
    printf 'Not a regular file: %s\n' "$file" >&2
    exit 2
  fi

  if [[ "$file" != assets/* ]]; then
    printf 'Asset must be under assets/: %s\n' "$file" >&2
    exit 2
  fi

  content_type=$(file -b --mime-type "$file")
  local_size=$(stat -c '%s' "$file")
  public_url="${PUBLIC_BASE_URL}/${file}"

  npx --yes wrangler r2 object put "${BUCKET}/${file}" \
    --remote \
    --file "$file" \
    --content-type "$content_type" \
    --cache-control 'public, max-age=86400' \
    --force

  headers=$(curl -fsSI "$public_url")
  remote_size=$(
    printf '%s\n' "$headers" \
      | awk 'tolower($1) == "content-length:" { gsub("\r", "", $2); print $2 }' \
      | tail -1
  )

  if [[ "$remote_size" != "$local_size" ]]; then
    printf 'Upload verification failed: local=%s remote=%s %s\n' \
      "$local_size" "$remote_size" "$file" >&2
    exit 1
  fi

  printf '%s\n' "$public_url"
done
