FROM oven/bun:1.3.5-alpine

WORKDIR /app

COPY . ./

RUN bun install
RUN bun run build

EXPOSE 3011

ENV PORT=3011

CMD ["bun", "./build/index.js"]
