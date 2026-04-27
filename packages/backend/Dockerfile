FROM oven/bun:1 AS build
WORKDIR /app
COPY . .
RUN bun install

FROM oven/bun:1
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=build /app /app
WORKDIR /app/packages/backend
ENV NODE_ENV=production
ENV PORT=4001
EXPOSE 4001
CMD ["bun", "run", "src/index.ts"]
