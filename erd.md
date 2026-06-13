# Entity-Relationship Diagram (ERD)
## Bangladesh Citizen Card System

```mermaid
erDiagram
  USERS {
    int id PK
    varchar nid_number UK
    varchar full_name
    date date_of_birth
    varchar phone UK
    varchar email
    enum blood_group
    text address
    varchar password_hash
    enum status
    timestamp created_at
    timestamp updated_at
  }
  CARD_TYPES {
    int id PK
    varchar type_name UK
    decimal application_fee
  }
  CARDS {
    int id PK
    int user_id FK
    int card_type_id FK
    varchar card_number UK
    enum status
    timestamp applied_at
    timestamp issued_at
  }
  NOTIFICATIONS {
    int id PK
    int user_id FK
    varchar title
    text message
    boolean is_read
    timestamp created_at
  }
  OTP_VERIFICATIONS {
    int id PK
    varchar phone
    varchar otp_code
    enum purpose
    boolean is_used
    timestamp expires_at
    timestamp created_at
  }
  ADMINS {
    int id PK
    varchar username UK
    varchar password_hash
    varchar full_name
    timestamp created_at
  }
  TOKEN_BLACKLIST {
    int id PK
    text token
    timestamp expired_at
    timestamp created_at
  }

  USERS ||--o{ CARDS : "applies for"
  CARD_TYPES ||--o{ CARDS : "defines type"
  USERS ||--o{ OTP_VERIFICATIONS : "receives"
  USERS ||--o{ NOTIFICATIONS : "receives"
```

## Relationships Explained

| Relationship | Type | Description |
|---|---|---|
| USERS → CARDS | One-to-Many | একজন user একাধিক card apply করতে পারে |
| CARD_TYPES → CARDS | One-to-Many | একটি card type এর অনেক card instance থাকতে পারে |
| USERS → OTP_VERIFICATIONS | One-to-Many | একজন user একাধিক OTP receive করতে পারে |
| USERS → NOTIFICATIONS | One-to-Many | একজন user একাধিক notification receive করতে পারে |
| ADMINS | Independent | Admin আলাদাভাবে system manage করে |
| TOKEN_BLACKLIST | Independent | Logout হওয়া JWT tokens store করে |

## Normalization — 3NF Compliance

| Table | 3NF Status | Reason |
|---|---|---|
| USERS | ✅ 3NF | সব column শুধু primary key `id` এর উপর dependent |
| CARD_TYPES | ✅ 3NF | `type_name`, `fee` directly `id` এর উপর dependent |
| CARDS | ✅ 3NF | `card_type` ENUM সরিয়ে `card_type_id` FK দিয়ে normalize করা হয়েছে |
| NOTIFICATIONS | ✅ 3NF | `title`, `message`, `is_read` সবই `id` এর উপর dependent, `user_id` FK |
| OTP_VERIFICATIONS | ✅ 3NF | সব column `id` এর উপর dependent |
| ADMINS | ✅ 3NF | Simple table, কোনো transitive dependency নেই |
| TOKEN_BLACKLIST | ✅ 3NF | Simple table, কোনো transitive dependency নেই |
