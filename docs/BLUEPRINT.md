# 📋 Customer Support Chat Platform — Project Blueprint

> **Thesis Project** | Web-based Customer Support Chat System  
> Stack: NestJS · ReactJS · PostgreSQL · Keycloak · WebSocket · Docker · Kubernetes

---

## 1. 🧠 Context

| Mục               | Chi tiết                                                                                                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Loại hệ thống** | Web-based Customer Support Chat Platform (Campaign-based Outbound Chat)                                                                                                                                    |
| **Domain**        | Customer Service / Contact Center                                                                                                                                                                          |
| **Actors**        | Supervisor (Admin), Support Agent, Customer                                                                                                                                                                |
| **Mục tiêu**      | Cung cấp nền tảng chat hỗ trợ khách hàng theo chiến dịch (campaign), cho phép quản trị viên tạo và quản lý chiến dịch, tổng đài viên xử lý chat real-time với khách hàng thông qua giao diện web tập trung |

### Actors & Vai trò

```
┌─────────────────────────────────────────────────┐
│                  ACTORS                         │
│                                                 │
│  👤 Supervisor (Admin)                          │
│     - Quản lý campaigns, agents, teams          │
│     - Import danh sách khách hàng (CSV)         │
│     - Xem báo cáo & thống kê                   │
│                                                 │
│  🎧 Support Agent                               │
│     - Xử lý chat sessions với khách hàng       │
│     - Quản lý hàng chờ (pending/active)        │
│                                                 │
│  🧑 Customer                                    │
│     - Tham gia chat qua web widget / WhatsApp  │
└─────────────────────────────────────────────────┘
```

---

## 2. 🏗️ Kiến trúc hệ thống (Architecture)

### Tech Stack

| Layer          | Technology                    | Mục đích                              |
| -------------- | ----------------------------- | ------------------------------------- |
| **Frontend**   | ReactJS + TypeScript          | Admin Portal & Agent Portal           |
| **Backend**    | NestJS (Node.js)              | REST API + WebSocket Gateway          |
| **Database**   | PostgreSQL                    | Lưu trữ dữ liệu chính                 |
| **Auth**       | Keycloak                      | Authentication & Authorization (RBAC) |
| **Realtime**   | WebSocket (Socket.IO)         | Chat real-time                        |
| **Deployment** | Docker + Kubernetes           | Container orchestration               |
| **Tools**      | Git, GitHub, Postman, VS Code | Development workflow                  |

### Tổ chức hệ thống

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│                                                              │
│   ┌──────────────────┐       ┌──────────────────────────┐   │
│   │   Admin Portal   │       │      Agent Portal        │   │
│   │   (ReactJS)      │       │      (ReactJS)            │   │
│   └────────┬─────────┘       └────────────┬─────────────┘   │
│            │                              │                  │
│            │    ┌─────────────────┐       │                  │
│            └────►  Keycloak Auth  ◄───────┘                  │
│                 └────────┬────────┘                          │
└──────────────────────────┼───────────────────────────────────┘
                           │ JWT Token
┌──────────────────────────▼───────────────────────────────────┐
│                      BACKEND LAYER                           │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                  NestJS Application                  │   │
│   │                                                      │   │
│   │   ┌─────────────┐   ┌─────────────┐                 │   │
│   │   │  REST API   │   │  WebSocket  │                 │   │
│   │   │  (HTTP)     │   │  Gateway    │                 │   │
│   │   └──────┬──────┘   └──────┬──────┘                │   │
│   │          │                 │                         │   │
│   │   ┌──────▼─────────────────▼──────┐                │   │
│   │   │         Business Modules       │                │   │
│   │   │  Auth | Campaign | Agent |     │                │   │
│   │   │  Chat | Contact | Report       │                │   │
│   │   └────────────────┬───────────────┘                │   │
│   └────────────────────┼────────────────────────────────┘   │
└────────────────────────┼─────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────┐
│                      DATA LAYER                              │
│                                                              │
│          ┌─────────────────────────────────┐                │
│          │         PostgreSQL               │                │
│          │   (TypeORM / Prisma ORM)         │                │
│          └─────────────────────────────────┘                │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT LAYER                          │
│                                                              │
│   Docker Compose (Dev) → Kubernetes Cluster (Prod)          │
│                                                              │
│   Pods: backend | frontend | keycloak | postgres | redis    │
└──────────────────────────────────────────────────────────────┘
```

### Cấu trúc thư mục Backend (NestJS)

```
src/
├── main.ts
├── app.module.ts
├── common/
│   ├── decorators/
│   ├── filters/
│   ├── guards/           # JWT Guard, Roles Guard
│   ├── interceptors/
│   └── pipes/
├── config/               # Environment configuration
├── modules/
│   ├── auth/             # Keycloak integration
│   ├── users/            # User management
│   ├── teams/            # Team management
│   ├── campaigns/        # Campaign management
│   ├── contacts/         # Customer contact lists
│   ├── chat/             # Chat sessions & messages
│   │   ├── chat.gateway.ts   # WebSocket gateway
│   │   ├── chat.service.ts
│   │   └── chat.controller.ts
│   ├── whatsapp/         # WhatsApp integration
│   └── reports/          # Analytics & reports
└── database/
    ├── migrations/
    └── seeds/
```

### Cấu trúc thư mục Frontend (ReactJS)

```
src/
├── main.tsx
├── App.tsx
├── routes/
├── store/                # Redux Toolkit / Zustand
├── services/             # API calls (axios)
├── socket/               # Socket.IO client
├── components/
│   ├── common/
│   └── ui/
├── pages/
│   ├── admin/
│   │   ├── Dashboard/
│   │   ├── Campaigns/
│   │   ├── Agents/
│   │   ├── Teams/
│   │   ├── Contacts/
│   │   └── Reports/
│   └── agent/
│       ├── Dashboard/
│       ├── ChatWindow/
│       └── SessionList/
└── types/
```

---

## 3. 🧱 Database Design

> **Quy ước:** `PK` = Primary Key | `FK` = Foreign Key | `UQ` = Unique

### 3.1 ERD (Entity Relationship Overview)

```
users ──────────< team_members >──────── teams
  │                                        │
  │                               campaigns_teams
  │                                        │
  └──────< agent_campaigns >────────── campaigns
                                           │
                                      campaign_contacts
                                           │
                                        contacts
                                           │
                                      chat_sessions
                                           │
                                      chat_messages
```

---

### 3.2 Schema Chi Tiết

#### Table: `users`

| Column        | Type                       | Constraints                   | Mô tả             |
| ------------- | -------------------------- | ----------------------------- | ----------------- |
| `id`          | UUID                       | PK, DEFAULT gen_random_uuid() |                   |
| `keycloak_id` | VARCHAR(255)               | UQ, NOT NULL                  | ID từ Keycloak    |
| `email`       | VARCHAR(255)               | UQ, NOT NULL                  |                   |
| `full_name`   | VARCHAR(255)               | NOT NULL                      |                   |
| `role`        | ENUM('supervisor','agent') | NOT NULL                      |                   |
| `is_active`   | BOOLEAN                    | DEFAULT true                  |                   |
| `is_online`   | BOOLEAN                    | DEFAULT false                 | Trạng thái online |
| `created_at`  | TIMESTAMP                  | DEFAULT NOW()                 |                   |
| `updated_at`  | TIMESTAMP                  | DEFAULT NOW()                 |                   |

---

#### Table: `teams`

| Column        | Type         | Constraints   | Mô tả |
| ------------- | ------------ | ------------- | ----- |
| `id`          | UUID         | PK            |       |
| `name`        | VARCHAR(255) | NOT NULL      |       |
| `description` | TEXT         | NULLABLE      |       |
| `created_by`  | UUID         | FK → users.id |       |
| `created_at`  | TIMESTAMP    | DEFAULT NOW() |       |
| `updated_at`  | TIMESTAMP    | DEFAULT NOW() |       |

---

#### Table: `team_members` _(n-n: users ↔ teams)_

| Column      | Type      | Constraints              | Mô tả       |
| ----------- | --------- | ------------------------ | ----------- |
| `id`        | UUID      | PK                       |             |
| `team_id`   | UUID      | FK → teams.id, NOT NULL  |             |
| `user_id`   | UUID      | FK → users.id, NOT NULL  |             |
| `joined_at` | TIMESTAMP | DEFAULT NOW()            |             |
| —           | —         | UNIQUE(team_id, user_id) | Không trùng |

---

#### Table: `campaigns`

| Column        | Type                                           | Constraints     | Mô tả |
| ------------- | ---------------------------------------------- | --------------- | ----- |
| `id`          | UUID                                           | PK              |       |
| `name`        | VARCHAR(255)                                   | NOT NULL        |       |
| `description` | TEXT                                           | NULLABLE        |       |
| `status`      | ENUM('draft','active','paused','completed')    | DEFAULT 'draft' |       |
| `channel`     | ENUM('web','whatsapp','instagram','messenger') | DEFAULT 'web'   |       |
| `start_date`  | DATE                                           | NULLABLE        |       |
| `end_date`    | DATE                                           | NULLABLE        |       |
| `created_by`  | UUID                                           | FK → users.id   |       |
| `created_at`  | TIMESTAMP                                      | DEFAULT NOW()   |       |
| `updated_at`  | TIMESTAMP                                      | DEFAULT NOW()   |       |

---

#### Table: `campaign_teams` _(n-n: campaigns ↔ teams)_

| Column        | Type | Constraints                  | Mô tả |
| ------------- | ---- | ---------------------------- | ----- |
| `id`          | UUID | PK                           |       |
| `campaign_id` | UUID | FK → campaigns.id            |       |
| `team_id`     | UUID | FK → teams.id                |       |
| —             | —    | UNIQUE(campaign_id, team_id) |       |

---

#### Table: `campaign_agents` _(n-n: campaigns ↔ users)_

| Column        | Type      | Constraints                   | Mô tả |
| ------------- | --------- | ----------------------------- | ----- |
| `id`          | UUID      | PK                            |       |
| `campaign_id` | UUID      | FK → campaigns.id             |       |
| `agent_id`    | UUID      | FK → users.id                 |       |
| `assigned_at` | TIMESTAMP | DEFAULT NOW()                 |       |
| —             | —         | UNIQUE(campaign_id, agent_id) |       |

---

#### Table: `contacts`

| Column        | Type         | Constraints   | Mô tả                  |
| ------------- | ------------ | ------------- | ---------------------- |
| `id`          | UUID         | PK            |                        |
| `full_name`   | VARCHAR(255) | NOT NULL      |                        |
| `phone`       | VARCHAR(50)  | NULLABLE      |                        |
| `email`       | VARCHAR(255) | NULLABLE      |                        |
| `whatsapp_id` | VARCHAR(100) | NULLABLE      |                        |
| `metadata`    | JSONB        | NULLABLE      | Dữ liệu bổ sung từ CSV |
| `created_at`  | TIMESTAMP    | DEFAULT NOW() |                        |

---

#### Table: `campaign_contacts` _(n-n: campaigns ↔ contacts)_

| Column         | Type                                            | Constraints                     | Mô tả                     |
| -------------- | ----------------------------------------------- | ------------------------------- | ------------------------- |
| `id`           | UUID                                            | PK                              |                           |
| `campaign_id`  | UUID                                            | FK → campaigns.id               |                           |
| `contact_id`   | UUID                                            | FK → contacts.id                |                           |
| `status`       | ENUM('pending','assigned','completed','failed') | DEFAULT 'pending'               |                           |
| `import_batch` | VARCHAR(100)                                    | NULLABLE                        | Tracking batch import CSV |
| `assigned_at`  | TIMESTAMP                                       | NULLABLE                        |                           |
| —              | —                                               | UNIQUE(campaign_id, contact_id) |                           |

---

#### Table: `chat_sessions`

| Column        | Type                                             | Constraints                 | Mô tả              |
| ------------- | ------------------------------------------------ | --------------------------- | ------------------ |
| `id`          | UUID                                             | PK                          |                    |
| `campaign_id` | UUID                                             | FK → campaigns.id, NOT NULL |                    |
| `contact_id`  | UUID                                             | FK → contacts.id, NOT NULL  |                    |
| `agent_id`    | UUID                                             | FK → users.id, NULLABLE     | NULL = chưa assign |
| `channel`     | ENUM('web','whatsapp','instagram','messenger')   | NOT NULL                    |                    |
| `status`      | ENUM('pending','active','completed','abandoned') | DEFAULT 'pending'           |                    |
| `started_at`  | TIMESTAMP                                        | NULLABLE                    | Khi agent bắt đầu  |
| `ended_at`    | TIMESTAMP                                        | NULLABLE                    |                    |
| `created_at`  | TIMESTAMP                                        | DEFAULT NOW()               |                    |
| `updated_at`  | TIMESTAMP                                        | DEFAULT NOW()               |                    |

**Relationships:**

- `campaign_id` → campaigns (1-n)
- `contact_id` → contacts (1-n)
- `agent_id` → users (1-n, nullable)

---

#### Table: `chat_messages`

| Column           | Type                                 | Constraints                     | Mô tả                   |
| ---------------- | ------------------------------------ | ------------------------------- | ----------------------- |
| `id`             | UUID                                 | PK                              |                         |
| `session_id`     | UUID                                 | FK → chat_sessions.id, NOT NULL |                         |
| `sender_type`    | ENUM('agent','customer','system')    | NOT NULL                        |                         |
| `sender_id`      | UUID                                 | NULLABLE                        | FK → users.id nếu agent |
| `content`        | TEXT                                 | NOT NULL                        |                         |
| `message_type`   | ENUM('text','image','file','system') | DEFAULT 'text'                  |                         |
| `attachment_url` | VARCHAR(500)                         | NULLABLE                        |                         |
| `is_read`        | BOOLEAN                              | DEFAULT false                   |                         |
| `created_at`     | TIMESTAMP                            | DEFAULT NOW()                   |                         |

---

#### Table: `csv_import_logs`

| Column         | Type                                    | Constraints       | Mô tả                 |
| -------------- | --------------------------------------- | ----------------- | --------------------- |
| `id`           | UUID                                    | PK                |                       |
| `campaign_id`  | UUID                                    | FK → campaigns.id |                       |
| `file_name`    | VARCHAR(255)                            | NOT NULL          |                       |
| `total_rows`   | INTEGER                                 | DEFAULT 0         |                       |
| `success_rows` | INTEGER                                 | DEFAULT 0         |                       |
| `failed_rows`  | INTEGER                                 | DEFAULT 0         |                       |
| `status`       | ENUM('processing','completed','failed') |                   |                       |
| `error_log`    | JSONB                                   | NULLABLE          | Chi tiết lỗi từng row |
| `imported_by`  | UUID                                    | FK → users.id     |                       |
| `created_at`   | TIMESTAMP                               | DEFAULT NOW()     |                       |

---

### 3.3 Quan hệ tóm tắt

| Quan hệ                       | Loại                        | Mô tả                             |
| ----------------------------- | --------------------------- | --------------------------------- |
| users ↔ teams                 | n-n (qua team_members)      | 1 user thuộc nhiều team           |
| campaigns ↔ teams             | n-n (qua campaign_teams)    | 1 campaign giao cho nhiều team    |
| campaigns ↔ users             | n-n (qua campaign_agents)   | Agent được assign vào campaign    |
| campaigns ↔ contacts          | n-n (qua campaign_contacts) | Danh sách liên lạc theo campaign  |
| campaigns → chat_sessions     | 1-n                         | 1 campaign có nhiều session       |
| contacts → chat_sessions      | 1-n                         | 1 contact có thể có nhiều session |
| users → chat_sessions         | 1-n                         | 1 agent xử lý nhiều session       |
| chat_sessions → chat_messages | 1-n                         | 1 session có nhiều tin nhắn       |

---

## 4. 🔄 Flow nghiệp vụ (Business Flow)

### Flow 1: Supervisor tạo Campaign

```
[Supervisor]
     │
     ▼
 Tạo Campaign (name, channel, dates)
     │
     ▼
 Gán Teams/Agents vào Campaign
     │
     ▼
 Import danh sách Contacts (CSV)
     │  ┌─────────────────────────────┐
     │  │ Validate CSV:               │
     │  │ - Check headers             │
     │  │ - Deduplicate contacts      │
     │  │ - Log errors                │
     │  └─────────────────────────────┘
     ▼
 Contacts được tạo → campaign_contacts (status=pending)
     │
     ▼
 Kích hoạt Campaign (status = active)
```

---

### Flow 2: Khách hàng bắt đầu Chat

```
[Customer]
     │
     ▼
 Truy cập web chat widget (hoặc WhatsApp)
     │
     ▼
 Chuẩn hóa inbound payload theo channel
   │
   ├── Web widget: lấy campaignId/campaignHint (nếu có)
   └── WhatsApp: lấy phone_number_id + sender info từ webhook body
   │
   ▼
 Resolve campaign
   │
   ├── Nếu có campaignId hợp lệ: dùng trực tiếp
   └── Nếu không: map phone_number_id -> campaign(s)
       + lọc campaign status=active, trong thời gian hiệu lực
       + chọn campaign theo policy (priority/round-robin)
   │
   ▼
 Find-or-create Contact (theo wa_id/phone)
   │
   ▼
 Tạo chat_session (status=pending, campaign_id, contact_id, channel)
     │
     ▼
 Routing session
   │
   ├── Có auto-assign + có agent phù hợp: gán ngay
   │       -> status=active, set agent_id, started_at
   └── Không có: giữ pending và đưa vào queue
   │
   ▼
 Emit `new_session_pending` (hoặc `session_assigned` nếu auto-assign)
     │
     ▼
[Agent] nhận notification → chọn Accept (nếu session pending)
     │
     ▼
 Session status = active | agent_id được gán | started_at được cập nhật
     │
     ▼
 Real-time chat qua WebSocket
     │
     ▼
 Agent kết thúc → session status = completed
     │
     ▼
 campaign_contacts status = completed
```

---

### Flow 3: Agent xử lý Queue

```
[Agent Portal]
     │
     ├── Tab Pending: Danh sách session chưa xử lý
     │         └── [Click Accept] → session gán cho agent
     │
     ├── Tab Active: Session đang chat
     │         └── Real-time messages qua WebSocket
     │
     └── Tab Completed: Lịch sử đã xử lý
```

---

### Flow 4: WebSocket Events

```
CLIENT                          SERVER
  │                               │
  ├──── connect (JWT token) ─────►│ Validate token
  │◄─── connected ────────────────┤
  │                               │
  ├──── join_session(sessionId) ──►│ Thêm vào room
  │                               │
  ├──── send_message(content) ────►│ Lưu DB
  │                               │  └─► Broadcast to room
  │◄─── new_message(message) ─────┤
  │                               │
  ├──── typing_start ─────────────►│ Broadcast
  │◄─── user_typing ──────────────┤
  │                               │
  ├──── end_session ──────────────►│ Update status
  │◄─── session_ended ────────────┤
```

---

## 5. 🔌 API Design

### Base URL: `/api/v1`

### Auth Header: `Authorization: Bearer <JWT>`

---

### 5.1 Authentication

| Method | Endpoint        | Mô tả                |
| ------ | --------------- | -------------------- |
| POST   | `/auth/login`   | Login qua Keycloak   |
| POST   | `/auth/refresh` | Refresh access token |
| POST   | `/auth/logout`  | Logout               |

---

### 5.2 Users & Agents

| Method | Endpoint            | Role       | Mô tả                      |
| ------ | ------------------- | ---------- | -------------------------- |
| GET    | `/users`            | supervisor | Lấy danh sách users        |
| GET    | `/users/:id`        | supervisor | Chi tiết user              |
| POST   | `/users`            | supervisor | Tạo agent mới              |
| PATCH  | `/users/:id`        | supervisor | Cập nhật thông tin         |
| DELETE | `/users/:id`        | supervisor | Vô hiệu hóa user           |
| PATCH  | `/users/:id/status` | agent      | Cập nhật trạng thái online |

---

### 5.3 Teams

| Method | Endpoint                     | Role       | Mô tả               |
| ------ | ---------------------------- | ---------- | ------------------- |
| GET    | `/teams`                     | supervisor | Danh sách teams     |
| POST   | `/teams`                     | supervisor | Tạo team            |
| PATCH  | `/teams/:id`                 | supervisor | Cập nhật team       |
| DELETE | `/teams/:id`                 | supervisor | Xóa team            |
| POST   | `/teams/:id/members`         | supervisor | Thêm agent vào team |
| DELETE | `/teams/:id/members/:userId` | supervisor | Xóa agent khỏi team |

---

### 5.4 Campaigns

| Method | Endpoint                         | Role       | Mô tả                  |
| ------ | -------------------------------- | ---------- | ---------------------- |
| GET    | `/campaigns`                     | supervisor | Danh sách campaigns    |
| POST   | `/campaigns`                     | supervisor | Tạo campaign           |
| GET    | `/campaigns/:id`                 | supervisor | Chi tiết campaign      |
| PATCH  | `/campaigns/:id`                 | supervisor | Cập nhật campaign      |
| DELETE | `/campaigns/:id`                 | supervisor | Xóa campaign           |
| PATCH  | `/campaigns/:id/status`          | supervisor | Thay đổi trạng thái    |
| POST   | `/campaigns/:id/agents`          | supervisor | Gán agent vào campaign |
| DELETE | `/campaigns/:id/agents/:agentId` | supervisor | Gỡ agent               |
| POST   | `/campaigns/:id/teams`           | supervisor | Gán team vào campaign  |
| GET    | `/campaigns/:id/stats`           | supervisor | Thống kê campaign      |

---

### 5.5 Contacts

| Method | Endpoint                              | Role       | Mô tả                 |
| ------ | ------------------------------------- | ---------- | --------------------- |
| GET    | `/contacts`                           | supervisor | Danh sách contacts    |
| POST   | `/contacts`                           | supervisor | Tạo contact thủ công  |
| PATCH  | `/contacts/:id`                       | supervisor | Cập nhật contact      |
| POST   | `/campaigns/:id/contacts/import`      | supervisor | Import CSV            |
| GET    | `/campaigns/:id/contacts`             | supervisor | Contacts của campaign |
| GET    | `/campaigns/:id/contacts/import-logs` | supervisor | Lịch sử import        |

**Request Body CSV Import:**

```json
// multipart/form-data
{
  "file": "<csv_file>",
  "mapping": {
    "full_name": "Name",
    "phone": "Phone Number",
    "email": "Email"
  }
}
```

---

### 5.6 Chat Sessions

| Method | Endpoint                   | Role              | Mô tả                       |
| ------ | -------------------------- | ----------------- | --------------------------- |
| GET    | `/sessions`                | agent, supervisor | Danh sách sessions          |
| GET    | `/sessions?status=pending` | agent             | Sessions đang chờ           |
| GET    | `/sessions?status=active`  | agent             | Sessions đang hoạt động     |
| GET    | `/sessions/:id`            | agent             | Chi tiết session            |
| POST   | `/sessions/:id/accept`     | agent             | Nhận session                |
| POST   | `/sessions/:id/end`        | agent             | Kết thúc session            |
| GET    | `/sessions/:id/messages`   | agent             | Lịch sử tin nhắn            |
| POST   | `/sessions`                | system            | Tạo session mới (từ widget) |

**Query params cho GET `/sessions`:**

```
?status=pending|active|completed
&campaign_id=uuid
&agent_id=uuid
&page=1&limit=20
```

---

### 5.7 Reports

| Method | Endpoint                 | Role       | Mô tả                           |
| ------ | ------------------------ | ---------- | ------------------------------- |
| GET    | `/reports/campaigns`     | supervisor | Tổng quan campaigns             |
| GET    | `/reports/campaigns/:id` | supervisor | Chi tiết 1 campaign             |
| GET    | `/reports/agents`        | supervisor | Hiệu suất agents                |
| GET    | `/reports/sessions`      | supervisor | Thống kê sessions               |
| GET    | `/reports/export`        | supervisor | Export báo cáo ra file CSV/JSON |

**Query params dùng cho Reports API:**

```
window=24h|7d|30d|all
page=1&limit=20
```

**Query params cho GET `/reports/export`:**

```
kind=campaigns|agents|sessions|campaign-detail
format=csv|json
window=24h|7d|30d|all
all=true|false
campaignId=<uuid>   # required nếu kind=campaign-detail
```

**Ghi chú export:**

- `all=true` cho `campaigns` và `agents` sẽ gom toàn bộ dữ liệu nhiều trang ở backend.
- Export CSV với `all=true` cho `campaigns|agents` được stream theo từng dòng để giảm memory.
- Backend có ngưỡng an toàn số dòng export all; nếu vượt ngưỡng sẽ trả lỗi yêu cầu thu hẹp `window` hoặc export phân trang.

**Response mẫu `/reports/campaigns/:id`:**

```json
{
  "campaign_id": "uuid",
  "name": "Campaign Q2 2025",
  "total_contacts": 500,
  "sessions": {
    "pending": 120,
    "active": 15,
    "completed": 350,
    "abandoned": 15
  },
  "avg_response_time_seconds": 45,
  "avg_session_duration_seconds": 320
}
```

---

### 5.8 WhatsApp Webhook

| Method | Endpoint                     | Role   | Mô tả                                                      |
| ------ | ---------------------------- | ------ | ---------------------------------------------------------- | --------- | ---------- |
| GET    | `/whatsapp/webhook`          | public | Verify webhook token/challenge handshake (legacy WhatsApp) |
| POST   | `/whatsapp/webhook`          | public | Nhận inbound WhatsApp và đẩy vào session                   |
| GET    | `/whatsapp/:channel/webhook` | public | Verify webhook cho `whatsapp                               | instagram | messenger` |
| POST   | `/whatsapp/:channel/webhook` | public | Nhận inbound theo `channel` và đẩy vào session             |

**Query params cho GET `/whatsapp/webhook` và `/whatsapp/:channel/webhook`:**

```
mode=subscribe
challenge=<provider_challenge>
verifyToken=<verify_token>
```

**Body mẫu cho POST `/whatsapp/webhook` (WhatsApp):**

```json
{
  "campaignId": "uuid",
  "from": "84901234567",
  "message": "Xin chao, can duoc ho tro",
  "contactName": "Nguyen Van A"
}
```

`campaignId` có thể bỏ qua nếu hệ thống map được từ `phone_number_id`.

**Provider-style body (Meta-like) cũng được hỗ trợ:**

```json
{
  "campaignId": "uuid",
  "object": "whatsapp_business_account",
  "entry": [
    {
      "changes": [
        {
          "value": {
            "contacts": [
              { "wa_id": "84901234567", "profile": { "name": "Nguyen Van A" } }
            ],
            "messages": [
              {
                "from": "84901234567",
                "type": "text",
                "text": { "body": "Xin chao" }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

**Message types inbound hiện hỗ trợ:**

- `text` -> lưu `message_type=text`
- `image` -> lưu `message_type=image`
- `document` -> lưu `message_type=file`

**Config môi trường cho verify webhook:**

```
WHATSAPP_VERIFY_TOKEN=<secret_verify_token>
INSTAGRAM_VERIFY_TOKEN=<secret_verify_token_or_use_META_VERIFY_TOKEN>
MESSENGER_VERIFY_TOKEN=<secret_verify_token_or_use_META_VERIFY_TOKEN>
META_VERIFY_TOKEN=<fallback_verify_token_for_instagram_messenger>
# one-to-one
WHATSAPP_PHONE_NUMBER_CAMPAIGN_MAP={"1234567890":"<campaign_uuid>"}
# one-to-many
# WHATSAPP_PHONE_NUMBER_CAMPAIGN_MAP={"1234567890":["<campaign_uuid_1>","<campaign_uuid_2>"]}
WHATSAPP_APP_SECRET=<meta_app_secret>
INSTAGRAM_APP_SECRET=<meta_app_secret_or_use_META_APP_SECRET>
MESSENGER_APP_SECRET=<meta_app_secret_or_use_META_APP_SECRET>
META_APP_SECRET=<fallback_app_secret_for_instagram_messenger>
```

**Routing note cho mapping nhiều campaign:**

- Khi một `phone_number_id` map tới nhiều campaign, backend phải áp dụng policy chọn campaign (ví dụ `priority` hoặc `round-robin`).
- Luôn lọc campaign hợp lệ trước khi chọn: `status=active` và trong khoảng thời gian hiệu lực.

**Security header cho POST webhook (khi bật `WHATSAPP_APP_SECRET`):**

```
x-hub-signature-256: sha256=<hmac_of_raw_body>
```

---

### 5.9 WebSocket Events

**Namespace:** `/chat`

| Event (Client → Server) | Payload                               | Mô tả            |
| ----------------------- | ------------------------------------- | ---------------- |
| `join_session`          | `{ sessionId }`                       | Vào phòng chat   |
| `leave_session`         | `{ sessionId }`                       | Rời phòng        |
| `send_message`          | `{ sessionId, content, messageType }` | Gửi tin nhắn     |
| `typing_start`          | `{ sessionId }`                       | Đang gõ          |
| `typing_stop`           | `{ sessionId }`                       | Ngừng gõ         |
| `end_session`           | `{ sessionId }`                       | Kết thúc session |

| Event (Server → Client) | Payload                     | Mô tả                 |
| ----------------------- | --------------------------- | --------------------- |
| `new_message`           | `{ message }`               | Tin nhắn mới          |
| `session_assigned`      | `{ session }`               | Session được gán      |
| `session_ended`         | `{ sessionId }`             | Session kết thúc      |
| `user_typing`           | `{ sessionId, senderType }` | Thông báo đang gõ     |
| `new_session_pending`   | `{ session }`               | Session mới chờ xử lý |
| `agent_status_changed`  | `{ agentId, isOnline }`     | Trạng thái agent      |

---

## 6. ⚙️ Coding Rules

### 6.1 Chung

```
✅ Dùng TypeScript strict mode cho cả BE và FE
✅ Đặt tên biến/hàm theo camelCase, class theo PascalCase
✅ Tên file: kebab-case (vd: chat-session.service.ts)
✅ Không commit file .env — dùng .env.example
✅ Mỗi PR phải có review trước khi merge vào main
✅ Commit message theo Conventional Commits:
   feat: add campaign import CSV
   fix: resolve websocket reconnection issue
   refactor: extract chat service logic
   docs: update API documentation
```

### 6.2 Backend (NestJS)

```typescript
// ✅ Luôn dùng DTO với class-validator
import { IsString, IsEnum, IsOptional } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  name: string;

  @IsEnum(['web', 'whatsapp'])
  channel: 'web' | 'whatsapp';

  @IsOptional()
  @IsString()
  description?: string;
}

// ✅ Dùng Repository Pattern với TypeORM
// ✅ Xử lý lỗi bằng NestJS Exception Filters
// ✅ Mỗi module có: controller, service, repository, dto, entity
// ✅ Guard kiểm tra Role trước khi vào controller
// ✅ Pagination mặc định: page=1, limit=20
// ✅ Response format chuẩn:
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 100 }
}
```

### 6.3 Frontend (ReactJS)

```typescript
// ✅ Dùng React functional components + hooks
// ✅ State management: Redux Toolkit hoặc Zustand
// ✅ API calls: axios với interceptor tự động gắn token
// ✅ Custom hooks cho logic tái sử dụng:
//    useChat(), useCampaigns(), useAgents()
// ✅ Lazy loading cho routes (React.lazy + Suspense)
// ✅ Bảo vệ route bằng PrivateRoute component
// ✅ Không gọi API trực tiếp trong component,
//    luôn đi qua service layer
// ✅ Xử lý loading/error state rõ ràng
```

### 6.4 Database

```sql
-- ✅ Luôn dùng UUID cho Primary Key
-- ✅ Tất cả bảng có created_at, updated_at
-- ✅ Dùng ENUM cho status fields
-- ✅ Đánh index cho các FK và cột thường WHERE:
CREATE INDEX idx_sessions_agent_id ON chat_sessions(agent_id);
CREATE INDEX idx_sessions_status ON chat_sessions(status);
CREATE INDEX idx_messages_session_id ON chat_messages(session_id);
-- ✅ Migration cho mọi thay đổi schema
-- ✅ Không DELETE dữ liệu thật, dùng soft delete (is_deleted)
```

### 6.5 WebSocket

```typescript
// ✅ Xác thực JWT khi connect
// ✅ Emit event có type rõ ràng
// ✅ Client phải xử lý reconnect tự động
// ✅ Không lưu state quan trọng chỉ trên WebSocket
//    — phải đồng bộ với DB
```

### 6.6 Security

```
✅ Validate tất cả input đầu vào (DTO)
✅ CORS chỉ cho phép domain đã cấu hình
✅ Rate limiting cho public endpoints
✅ Không expose stack trace ra response production
✅ File upload: giới hạn size, validate MIME type
✅ Keycloak quản lý toàn bộ auth, BE chỉ verify JWT
```

---

## 7. 🚀 Hướng dẫn Setup Dự án với GitHub Copilot trên VS Code

### Bước 1: Cài đặt VS Code Extensions

```
Mở VS Code → Extensions (Ctrl+Shift+X) → Cài đặt:

1. GitHub Copilot           (ms-vscode.github-copilot)
2. GitHub Copilot Chat      (ms-vscode.github-copilot-chat)
3. ESLint                   (dbaeumer.vscode-eslint)
4. Prettier                 (esbenp.prettier-vscode)
5. Thunder Client / REST Client  (API testing)
6. GitLens                  (eamodio.gitlens)
7. Docker                   (ms-azuretools.vscode-docker)
8. PostgreSQL (cweijan.vscode-postgresql-client2)
```

**Đăng nhập GitHub Copilot:**

- `Ctrl+Shift+P` → "GitHub Copilot: Sign In"
- Đăng nhập tài khoản GitHub đã có Copilot subscription

---

### Bước 2: Setup GitHub Repository

```bash
# 1. Tạo repo trên GitHub (ví dụ: chat-support-platform)

# 2. Clone về local
git clone https://github.com/<username>/chat-support-platform.git
cd chat-support-platform

# 3. Tạo cấu trúc monorepo (hoặc tách 2 repo riêng)
mkdir backend frontend
```

---

### Bước 3: Khởi tạo Backend (NestJS)

```bash
# Cài NestJS CLI
npm install -g @nestjs/cli

# Tạo project trong thư mục backend
cd backend
nest new . --package-manager npm

# Cài các dependencies chính
npm install @nestjs/typeorm typeorm pg
npm install @nestjs/config @nestjs/jwt passport-jwt
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
npm install class-validator class-transformer
npm install csv-parser multer
npm install @nestjs/swagger swagger-ui-express

# Dev dependencies
npm install -D @types/multer @types/passport-jwt
```

---

### Bước 4: Khởi tạo Frontend (ReactJS)

```bash
cd ../frontend

# Tạo React app với Vite + TypeScript
npm create vite@latest . -- --template react-ts

npm install
npm install axios socket.io-client
npm install @reduxjs/toolkit react-redux
npm install react-router-dom
npm install antd            # hoặc @mui/material / shadcn-ui
npm install react-query     # Data fetching
```

---

### Bước 5: Cấu hình .env

```bash
# backend/.env
DATABASE_URL=postgresql://user:password@localhost:5432/chat_db
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=chat-realm
KEYCLOAK_CLIENT_ID=backend-client
JWT_SECRET=your-secret-key
PORT=3001

# frontend/.env
VITE_API_URL=http://localhost:3001/api/v1
VITE_WS_URL=http://localhost:3001
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=chat-realm
VITE_KEYCLOAK_CLIENT_ID=frontend-client
```

---

### Bước 6: Docker Compose (Development)

```yaml
# docker-compose.yml
version: "3.8"
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: chat_db
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  keycloak:
    image: quay.io/keycloak/keycloak:23.0
    command: start-dev
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
    ports:
      - "8080:8080"

  backend:
    build: ./backend
    ports:
      - "3001:3001"
    env_file: ./backend/.env
    depends_on:
      - postgres
      - keycloak

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  pgdata:
```

```bash
# Chạy toàn bộ hệ thống
docker-compose up -d
```

---

### Bước 7: Sử dụng GitHub Copilot hiệu quả

#### Kỹ thuật Prompt hiệu quả với Copilot Chat

**Mở Copilot Chat:** `Ctrl+Shift+I` (hoặc click icon Copilot)

```
💡 Ví dụ các prompt hiệu quả:

1. Generate Entity:
   "Generate a TypeORM entity for chat_sessions table with these columns:
    id (UUID PK), campaign_id (FK), contact_id (FK), agent_id (nullable FK),
    status (enum: pending/active/completed), created_at, updated_at"

2. Generate Service:
   "Create a NestJS service for campaign management with methods:
    findAll with pagination, findById, create, update, softDelete.
    Use TypeORM repository pattern."

3. Generate DTO:
   "Create class-validator DTO for creating a campaign with fields:
    name (required string), channel (enum web/whatsapp),
    description (optional), startDate (optional date)"

4. Generate WebSocket Gateway:
   "Create NestJS WebSocket gateway for chat with events:
    join_session, send_message, typing_start, end_session.
    Include JWT authentication in handleConnection."

5. Fix code:
   "@workspace /fix this service is throwing TypeORM QueryFailedError
    when importing CSV contacts"

6. Explain:
   "@workspace /explain how the WebSocket authentication flow works
    in this gateway"
```

#### GitHub Copilot Shortcuts

| Shortcut       | Hành động          |
| -------------- | ------------------ |
| `Tab`          | Chấp nhận gợi ý    |
| `Esc`          | Từ chối gợi ý      |
| `Alt+]`        | Gợi ý tiếp theo    |
| `Alt+[`        | Gợi ý trước        |
| `Ctrl+Enter`   | Mở danh sách gợi ý |
| `Ctrl+Shift+I` | Mở Copilot Chat    |

#### Copilot Chat Commands

| Command      | Mục đích                 |
| ------------ | ------------------------ |
| `/explain`   | Giải thích code          |
| `/fix`       | Sửa lỗi tự động          |
| `/test`      | Generate unit tests      |
| `/doc`       | Generate JSDoc comments  |
| `@workspace` | Hỏi về toàn bộ project   |
| `@terminal`  | Hỏi về terminal/commands |

---

### Bước 8: Git Workflow

```bash
# Branching strategy (GitHub Flow)
main          # Production-ready code
develop       # Development branch
feature/*     # Feature branches
fix/*         # Bug fix branches

# Quy trình làm việc
git checkout develop
git pull origin develop
git checkout -b feature/campaign-csv-import

# ... code với Copilot hỗ trợ ...

git add .
git commit -m "feat: add CSV import for campaign contacts"
git push origin feature/campaign-csv-import

# Tạo Pull Request trên GitHub → Review → Merge vào develop
```

---

### Bước 9: Thứ tự Phát triển Đề xuất

```
Phase 1 — Foundation (Tuần 1-2)
  ✅ Setup project structure + Docker
  ✅ Keycloak integration + JWT auth
  ✅ User & Team management APIs
  ✅ Database migrations

Phase 2 — Core Features (Tuần 3-4)
  ✅ Campaign CRUD APIs
  ✅ Contact management + CSV import
  ✅ Campaign ↔ Agent/Team assignment

Phase 3 — Chat Engine (Tuần 5-6)
  ✅ WebSocket gateway
  ✅ Chat session lifecycle
  ✅ Agent Portal UI (session queue)
  ✅ Real-time messaging

Phase 4 — Admin Portal (Tuần 7)
  ✅ Admin Portal UI hoàn chỉnh
  ✅ Reports & analytics

Phase 5 — WhatsApp + Polish (Tuần 8)
  ✅ WhatsApp integration
  ✅ Testing + Bug fixes
  ✅ Deployment (K8s)
```

---

_Generated for Thesis Project — Customer Support Chat Platform_
