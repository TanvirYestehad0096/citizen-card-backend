# Bangladesh Citizen Card System — Project Documentation

## 1. Project Overview

This system manages the issuance of digital citizen cards in Bangladesh. Citizens can apply for multiple card types (Family, Business, Student, Vehicle, Agriculture) through a web interface. Admins review and approve applications.

**Tech Stack:** Node.js + Express (Backend), MySQL (Database), HTML/CSS/JS (Frontend), Railway (Deployment)

---

## 2. Entities & Descriptions

| Entity | Description |
|---|---|
| **users** | Registered citizens with NID, personal info, and login credentials |
| **card_types** | Master list of 5 available card categories with fees |
| **cards** | Individual card applications linking a user to a card type |
| **otp_verifications** | OTP records for registration and password reset |
| **admins** | System administrators who manage users and cards |
| **token_blacklist** | Invalidated JWT tokens for secure logout |

---

## 3. Relationships

| Relationship | Type | Description |
|---|---|---|
| users → cards | One-to-Many | একজন user একাধিক card apply করতে পারে |
| card_types → cards | One-to-Many | একটি card type এর অনেক card instance থাকতে পারে |
| users → otp_verifications | One-to-Many | একজন user একাধিক OTP receive করতে পারে |
| admins | Independent | Admin আলাদাভাবে system manage করে |
| token_blacklist | Independent | Logged-out JWT tokens store করে |

---

## 4. Normalization — 3NF Compliance

The database is normalized to **Third Normal Form (3NF)**:

- **1NF:** All columns contain atomic values; no repeating groups.
- **2NF:** No partial dependencies — all non-key columns depend on the full primary key.
- **3NF:** No transitive dependencies.

**Key fix:** `card_type` was originally an ENUM inside the `cards` table. This was a 3NF violation because `application_fee` would depend on `card_type`, not on the primary key of `cards`. This was resolved by creating a separate `card_types` table and referencing it via `card_type_id` (Foreign Key).

---

## 5. Constraints Used

| Constraint | Where Used | Purpose |
|---|---|---|
| PRIMARY KEY | All tables | Unique row identifier |
| FOREIGN KEY | cards → users, cards → card_types | Referential integrity |
| UNIQUE | nid_number, phone, card_number, username | No duplicate values |
| NOT NULL | nid_number, full_name, phone, password_hash | Required fields |
| CHECK | nid_number length ≥ 10, date_of_birth age ≥ 18 | Data validation |
| ON DELETE CASCADE | cards.user_id | Delete user → delete their cards |
| ON DELETE RESTRICT | cards.card_type_id | Prevent deleting an active card type |

---

## 6. SQL Operations Summary

### CRUD Operations

| Operation | Query # | Description |
|---|---|---|
| CREATE (INSERT) | Q1 | Insert a new user |
| READ (SELECT) | Q2 | Fetch active users |
| UPDATE | Q3 | Update card status |
| DELETE | Q4 | Delete a suspended user |

### Advanced Queries

| Concept | Query # | Description |
|---|---|---|
| INNER JOIN (2 tables) | Q5 | User details with their card types |
| LEFT JOIN + GROUP BY | Q6 | Count applications per card type |
| Subquery (WHERE IN) | Q7 | Users with pending cards |
| Subquery (INSERT SELECT) | Q8 | Apply for card using type name lookup |
| HAVING | Q9 | Users with more than 2 cards |
| JOIN + Subquery + DATE | Q10 | Cards issued in last 30 days by blood group |

---

## 7. Special Features

- **TRIGGER:** `before_card_issue` — automatically sets `issued_at` timestamp when card status changes to `issued`
- **JWT Blacklist:** Secure logout by storing invalidated tokens in `token_blacklist`
- **OTP System:** Phone-based verification for registration and password reset
- **Role-based Access:** Separate `admins` table with its own JWT authentication

---

## 8. Sample Data Summary

| Table | Records |
|---|---|
| users | 6 (active, pending, suspended) |
| card_types | 5 (family, business, student, vehicle, agriculture) |
| cards | 12 (various statuses) |
| otp_verifications | 5 |
| admins | 1 (System Administrator) |
