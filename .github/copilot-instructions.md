# Copilot Instructions — Chat Support Platform

Đây là dự án luận văn: Web-based Customer Support Chat Platform.

## Tech Stack

- Backend: NestJS + TypeORM + PostgreSQL
- Frontend: ReactJS + TypeScript + Vite
- Auth: Keycloak (JWT)
- Realtime: Socket.IO (WebSocket)

## Quy tắc quan trọng

- Luôn dùng UUID cho Primary Key
- DTO validation bắt buộc với class-validator
- Response format: { success, data, meta }
- Đọc file docs/BLUEPRINT.md để hiểu đầy đủ schema và API design

## Coding style

- TypeScript strict mode
- Tên file: kebab-case
- Commit: Conventional Commits (feat/fix/refactor)
