#!/usr/bin/env bash
set -euo pipefail

mode="${1:-}"

case "$mode" in
  serve|build) ;;
  *)
    echo "Usage: $0 serve|build" >&2
    exit 2
    ;;
esac

source_dir="docs"
config_file="docs/_config.yml"

if command -v bundle >/dev/null 2>&1; then
  if [ "$mode" = "serve" ]; then
    exec bundle exec jekyll serve --livereload --source "$source_dir" --config "$config_file"
  fi
  exec bundle exec jekyll build --source "$source_dir" --config "$config_file"
fi

engine=""
if command -v podman >/dev/null 2>&1; then
  engine="podman"
elif command -v docker >/dev/null 2>&1; then
  engine="docker"
else
  echo "bundle が見つかりません。Ruby/Bundler を導入するか、podman/docker を導入してください。" >&2
  exit 1
fi

image="${JEKYLL_IMAGE:-docker.io/library/ruby:3.3}"
uid="$(id -u)"
gid="$(id -g)"
workdir="/work"

tty_flags=()
if [ -t 0 ] && [ -t 1 ]; then
  tty_flags=( -i -t )
fi

user_flags=()
if [ "$engine" = "podman" ]; then
  user_flags=( --userns=keep-id --user "${uid}:${gid}" )
else
  user_flags=( --user "${uid}:${gid}" )
fi

ports=()
serve_args=()
if [ "$mode" = "serve" ]; then
  ports=( -p 4000:4000 -p 35729:35729 )
  serve_args=( --host 0.0.0.0 --livereload )
fi

jekyll_cmd=(jekyll)
if [ "$mode" = "serve" ]; then
  jekyll_cmd+=(serve "${serve_args[@]}")
else
  jekyll_cmd+=(build)
fi
jekyll_cmd+=(--source "$source_dir" --config "$config_file")

printf -v jekyll_cmd_escaped '%q ' "${jekyll_cmd[@]}"

exec "$engine" run --rm   "${tty_flags[@]}"   "${user_flags[@]}"   "${ports[@]}"   -v "${PWD}:${workdir}:rw"   -w "${workdir}"   -e HOME=/tmp   -e BUNDLE_PATH=vendor/bundle   -e BUNDLE_JOBS=4   -e BUNDLE_RETRY=3   "$image" bash -lc "bundle install && bundle exec ${jekyll_cmd_escaped}"
