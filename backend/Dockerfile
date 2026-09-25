# ---------- build ----------
FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
# tidy resuelve dependencias si go.sum no existe; CGO_ENABLED=0 funciona porque modernc.org/sqlite es Go puro
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

# ---------- runtime ----------
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata && adduser -D -u 10001 app
WORKDIR /app
COPY --from=build /out/api /app/api
COPY data /app/data
RUN mkdir -p /app/storage && chown -R app:app /app
USER app
ENV PORT=8080 DB_PATH=/app/storage/energy.db DATA_DIR=/app/data
EXPOSE 8080
ENTRYPOINT ["/app/api"]
