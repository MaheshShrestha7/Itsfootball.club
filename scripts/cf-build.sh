#!/bin/sh
# Cloudflare build: OpenNext opens every server file at once while it patches the bundle
# (Promise.all in @opennextjs/aws codePatcher). With ~2,600 files that passes the build box's
# open-file limit and fails with "EMFILE: too many open files".
# Two guards: raise the limit where the box allows it, and queue file reads (scripts/fs-limit.mjs)
# so the build works even where it doesn't.
ulimit -n "$(ulimit -Hn)" 2>/dev/null || true
echo "Open file limit for this build: $(ulimit -n)"
NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--import=$(pwd)/scripts/fs-limit.mjs"
export NODE_OPTIONS
exec npx opennextjs-cloudflare build
