FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o pulsenet-server .

FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/pulsenet-server .
EXPOSE 4003

CMD ["./pulsenet-server"]
