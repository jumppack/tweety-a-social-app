# Tweety Platform - Architecture Overview

## 1. System Overview & Technology Stack

Tweety is a full-stack social media platform engineered as a monorepo powered by **Turborepo** and **pnpm workspaces**.

```
+-------------------------------------------------------------------------------+
|                               Monorepo Architecture                           |
+-------------------------------+-------------------------------+---------------+
|       apps/client-user        |       apps/client-admin       |   apps/api    |
|   (TanStack Start + React 19)  |   (TanStack Start + React 19)  | (Node + gRPC) |
+-------------------------------+-------------------------------+---------------+
                                |                               |
                                v                               v
+-------------------------------------------------------------------------------+
|                              Shared Packages                                  |
|   packages/grpc-client  |  packages/proto  |  packages/db-schema  |  ...     |
+-------------------------------------------------------------------------------+
```

### Tech Stack Breakdown
- **Frontend Framework**: TanStack Start (React 19, SSR + Hydration, File-based routing via `@tanstack/react-router`)
- **Styling System**: Meta StyleX (`@stylexjs/stylex`) with compiled CSS atomic utility rules
- **API Protocol**: gRPC over HTTP/2 using `@grpc/grpc-js` and protobuf-ts generated types
- **Data Persistence**: SQLite via libSQL (`@libsql/client`) and **Drizzle ORM** (`packages/db-schema`)
- **Build & Monorepo Tooling**: Turborepo, Vite 6, `pnpm` workspaces, Biome for linting/formatting
- **Testing**: Vitest for unit/integration tests, Playwright for E2E testing

---

## 2. High-Level System Architecture Diagram

```mermaid
graph TD
    subgraph Clients ["Client Tier (Browser / SSR)"]
        UserApp["User App (apps/client-user)<br/>:3000"]
        AdminApp["Admin App (apps/client-admin)<br/>:3002"]
    end

    subgraph ServerFunc ["TanStack Start Server Layer"]
        UserServer["Server Functions / RPC Bridge"]
        AdminServer["Server Functions / RPC Bridge"]
    end

    subgraph API ["API Tier (apps/api)"]
        gRPCServer["gRPC Server (:3001)<br/>Handlers & Controllers"]
        Services["Business Services Layer<br/>(Auth, Posts, Users, etc.)"]
    end

    subgraph Storage ["Persistence Layer"]
        DB[(SQLite Database<br/>tweety.db)]
    end

    UserApp -->|HTTP / SSR| UserServer
    AdminApp -->|HTTP / SSR| AdminServer

    UserServer -->|gRPC / Protobuf| gRPCServer
    AdminServer -->|gRPC / Protobuf| gRPCServer

    gRPCServer --> Services
    Services -->|Drizzle ORM| DB
```

---

## 3. End-to-End Request & Data Flow (Sequence Diagram)

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Browser)
    participant Client as TanStack Start Component
    participant ServerFn as Server Function (Node.js SSR)
    participant gRPCClient as gRPC Client Package
    participant API as gRPC API Handler
    participant Service as Business Service
    participant DB as SQLite / Drizzle ORM

    User->>Client: Interacts (e.g. Create Post / View Feed)
    Client->>ServerFn: Calls TanStack Server Function
    ServerFn->>gRPCClient: Invokes gRPC stub method
    gRPCClient->>API: Sends Protobuf Request over gRPC (:3001)
    API->>Service: Validates input & calls Service
    Service->>DB: Executes Drizzle Query
    DB-->>Service: Returns DB Records
    Service-->>API: Returns Domain Entity
    API-->>gRPCClient: Returns gRPC Response Message
    gRPCClient-->>ServerFn: Returns typed response
    ServerFn-->>Client: Returns JSON payload
    Client-->>User: Renders UI update
```

---

## 4. Domain & Use Case Model

```mermaid
mindmap
  root((Tweety Platform))
    User Application
      Authentication
        Login / Register
        Session Validation
      Content Feed
        Home Feed (Followed users)
        Explore Feed (All recent)
        Search (Posts & Users)
      Post Operations
        Create / Edit (5 min limit) / Delete
        Like / Bookmark
      Comments
        Threaded comments (1 level deep)
        Like comments
      User Profiles
        Follow / Unfollow
        Profile management
    Admin Application
      Dashboard Stats
      User Moderation (Suspend/Unsuspend)
      Content Moderation (Delete posts/comments)
      Audit Logs & Reports
```

---

## 5. Database ERD (Entity Relationship Diagram)

```mermaid
erDiagram
    USERS ||--o{ POSTS : creates
    USERS ||--o{ COMMENTS : writes
    USERS ||--o{ LIKES : gives
    USERS ||--o{ BOOKMARKS : saves
    USERS ||--o{ FOLLOWS : follower
    USERS ||--o{ FOLLOWS : following
    POSTS ||--o{ COMMENTS : contains
    POSTS ||--o{ LIKES : receives
    POSTS ||--o{ BOOKMARKS : bookmarked_in
    COMMENTS ||--o{ LIKES : receives

    USERS {
        text id PK
        text email UK
        text username UK
        text password_hash
        text display_name
        text bio
        text avatar_url
        boolean is_suspended
        datetime created_at
    }

    POSTS {
        text id PK
        text author_id FK
        text content
        datetime created_at
        datetime updated_at
    }

    COMMENTS {
        text id PK
        text post_id FK
        text author_id FK
        text parent_id FK
        text content
        datetime created_at
    }

    LIKES {
        text id PK
        text user_id FK
        text post_id FK
        text comment_id FK
        datetime created_at
    }

    BOOKMARKS {
        text id PK
        text user_id FK
        text post_id FK
        datetime created_at
    }

    FOLLOWS {
        text follower_id FK
        text following_id FK
        datetime created_at
    }
```

---

## 6. Key UI Layout & Mock Architecture

### User Client Interface Mock Structure
```
+-----------------------------------------------------------------------------------+
|  [Sidebar Navigation]    |  [Main Feed View]                | [Right Panel]       |
|  - Home                  |  +-----------------------------+  | - Search Bar        |
|  - Explore               |  | Compose Box (Max 280 chars) |  | - Who to follow     |
|  - Bookmarks             |  +-----------------------------+  | - Trending tags     |
|  - Profile               |  | Feed Post Item              |  |                     |
|  - Settings              |  |  - User Avatar & Name       |  |                     |
|                          |  |  - Post Content Text        |  |                     |
|                          |  |  - Actions: Like/Bookmark   |  |                     |
|                          |  +-----------------------------+  |                     |
+-----------------------------------------------------------------------------------+
```
