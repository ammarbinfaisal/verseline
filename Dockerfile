FROM oven/bun:1 AS build
WORKDIR /app
COPY . .
RUN bun install
RUN bun run --filter @verseline/frontend build

FROM oven/bun:1
WORKDIR /app/packages/frontend
COPY --from=build /app /app
EXPOSE 3000
CMD ["bun", "run", "start"]
