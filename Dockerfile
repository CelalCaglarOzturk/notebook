FROM oven/bun:1.4.4

WORKDIR /app

# Manifests first so dependency layers cache independently of source changes
COPY package.json bun.lock bunfig.toml ./

# Install deps pinned by bun.lock. Bun 1.4.4 skips transitive platform-specific
# optional dependencies (rollup's native bindings) when the lockfile was
# resolved on a different CPU architecture, so force the build arch explicitly.
# This server builds arm64 images; for an x86_64 server change arm64 to x64.
# If the native binding is still missing afterwards, fall back to resolving
# fresh on the build platform (unpinned) — that always installs matching natives.
RUN bun install --os=linux --cpu=arm64 --libc=glibc; \
    test -d node_modules/@rollup/rollup-linux-arm64-gnu || \
    (rm -f bun.lock && bun install)

COPY . .
RUN bun run build

EXPOSE 3011

ENV PORT=3011

CMD ["bun", "./build/index.js"]
