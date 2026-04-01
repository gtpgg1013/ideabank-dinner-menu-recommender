FROM node:24-alpine

WORKDIR /app

COPY package.json ./
COPY server.js ./
COPY src ./src
COPY test ./test
COPY README.md ./
COPY .service-info.json ./

ENV PORT=3200
ENV ACCESS_PASSWORD=ideabank2026

EXPOSE 3200

CMD ["npm", "start"]
