#!/bin/sh
# Cloudflare build: OpenNext opens every server file at once while it patches the bundle
# (Promise.all in @opennextjs/aws codePatcher). With ~2,600 files that can pass the build box's
# open-file limit and fail with "EMFILE: too many open files". Raise the limit to the hard cap first.
ulimit -n "$(ulimit -Hn)" 2>/dev/null || ulimit -n 65536 2>/dev/null || true
echo "Open file limit for this build: $(ulimit -n)"
exec npx opennextjs-cloudflare build
