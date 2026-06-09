# 📋 Bangladesh Citizen Card System — Project Documentation

**Course:** Database Management Systems (DBMS)  
**Project Title:** Bangladesh Citizen Card Management System  
**Technology:** Node.js + Express.js + MySQL  

---

## 1. Project Overview

The **Bangladesh Citizen Card System** is a real-world inspired web application that allows Bangladeshi citizens to apply for various government-issued cards (Family Card, Business Card, Student Card, Vehicle Card, Agriculture Card) online. An admin panel manages applications, approves or rejects them, and issues the final cards.

**Real-World Problem Addressed:**  
In Bangladesh, citizens must physically visit government offices to apply for cards. This system digitizes the process — users register with their NID, apply for cards, and track status online.

---

## 2. Entities & Attributes

### Entity 1: `users`
Stores all registered citizen information.

| Column | Type | Constraint | Description |
|--------|------|-----------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Unique user ID |
| nid_number | VARCHAR(20) | NOT NULL, UNIQUE, CHECK(len≥10) | National ID number |
| full_name | VARCHAR(100) | NOT NULL | Citizen's full name |
| date_of_birth | DATE | NOT NULL, CHECK(age≥18) | Date of birth |
| phone | VARCHAR(15) | NOT NULL, UNIQUE | Mobile number |
| email | VARCHAR(150) | NULL | Email address |
| blood_group | ENUM | NULL | One of 8 blood groups |
| address | TEXT | NULL | Residential address |
| password_hash | VARCHAR(255) | NOT NULL | Bcrypt hashed password |
| status | ENUM | DEFAULT 'pending' | pending / active / suspended |
| created_at | TIMESTAMP | DEFAULT NOW() | Registration time |

---

### Entity 2: `card_types`
Stores the types of cards available — extracted into its own table for **3NF compliance**.

| Column | Type | Constraint | Description |
|--------|------|-----------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Unique type ID |
| type_name | VARCHAR(50) | NOT NULL, UNIQUE | family / business / student / vehicle / agriculture |
| application_fee | DECIMAL(10,2) | CHECK(fee≥0) | Application fee amount |

> **3NF Justification:** Previously `card_type` was an ENUM directly in the `cards` table. This caused a transitive dependency (`card_type → application_fee`). Extracting it into `card_types` eliminates this and achieves strict 3NF.

---

### Entity 3: `cards`
Stores each card application submitted by a user.

| Column | Type | Constraint | Description |
|--------|------|-----------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Unique card ID |
| user_id | INT | NOT NULL, FOREIGN KEY → users(id) | Applicant reference |
| card_type_id | INT | NOT NULL, FOREIGN KEY → card_types(id) | Card type reference |
| card_number | VARCHAR(30) | UNIQUE | Issued card number (e.g. BD-FAM-2024-1234) |
| status | ENUM | DEFAULT 'applied' | applied / processing / approved / rejected / issued |
| applied_at | TIMESTAMP | DEFAULT NOW() | Application submission time |
| issued_at | TIMESTAMP | NULL | Auto-set by TRIGGER when issued |

---

### Entity 4: `admins`
Stores admin login credentials for the management panel.

| Column | Type | Constraint | Description |
|--------|------|-----------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Unique admin ID |
| username | VARCHAR(50) | NOT NULL, UNIQUE | Admin login name |
| password_hash | VARCHAR(255) | NOT NULL | Bcrypt hashed password |
| full_name | VARCHAR(100) | NULL | Admin's name |
| created_at | TIMESTAMP | DEFAULT NOW() | Account creation time |

---

### Entity 5: `otp_verifications`
Stores OTP codes for password reset flow.

| Column | Type | Constraint | Description |
|--------|------|-----------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Unique OTP record ID |
| phone | VARCHAR(15) | NOT NULL | Target phone number |
| otp_code | VARCHAR(6) | NOT NULL | 6-digit OTP code |
| purpose | ENUM | NOT NULL | registration / password_reset |
| is_used | BOOLEAN | DEFAULT FALSE | Marks if OTP is consumed |
| expires_at | TIMESTAMP | NOT NULL | OTP expiry time |
| created_at | TIMESTAMP | DEFAULT NOW() | OTP generation time |

---

### Entity 6: `token_blacklist`
Stores invalidated JWT tokens for secure logout.

| Column | Type | Constraint | Description |
|--------|------|-----------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Unique record ID |
| token | TEXT | NOT NULL | The blacklisted JWT token |
| expired_at | TIMESTAMP | NOT NULL | Token's original expiry |
| created_at | TIMESTAMP | DEFAULT NOW() | Time of blacklisting |

---

## 3. Relationships & Referential Integrity

```
users ──< cards >── card_types
  │
  └── otp_verifications (via phone)

admins (independent)
token_blacklist (independent)
```

| Relationship | Type | Constraint |
|-------------|------|-----------|
| `users` → `cards` | One-to-Many | FK: `cards.user_id → users.id` ON DELETE CASCADE |
| `card_types` → `cards` | One-to-Many | FK: `cards.card_type_id → card_types.id` ON DELETE RESTRICT |

- **CASCADE DELETE:** যদি একজন user delete হয়, তার সব cards automatically delete হয়
- **RESTRICT:** কোনো card_type delete করা যাবে না যদি সেই type-এর কোনো card থাকে

---

## 4. Normalization (3NF)

### First Normal Form (1NF) ✅
- সব attributes atomic (কোনো repeating groups নেই)
- প্রতিটা টেবিলে Primary Key আছে

### Second Normal Form (2NF) ✅
- কোনো composite primary key নেই, তাই 2NF automatically satisfied
- সব non-key attributes সম্পূর্ণভাবে primary key-এর উপর dependent

### Third Normal Form (3NF) ✅
- **Before:** `cards` টেবিলে `card_type ENUM` ছিল → `card_type → application_fee` transitive dependency ছিল
- **After:** `card_types` আলাদা টেবিল তৈরি করে transitive dependency দূর করা হয়েছে
- কোনো non-key attribute অন্য non-key attribute-এর উপর dependent নয়

---

## 5. Constraints Summary

| Constraint Type | Table | Column | Rule |
|----------------|-------|--------|------|
| PRIMARY KEY | সব টেবিল | id | Unique row identifier |
| UNIQUE | users | nid_number, phone | একই NID/phone দুইবার নয় |
| UNIQUE | cards | card_number | প্রতিটা card number unique |
| UNIQUE | admins | username | Admin login unique |
| UNIQUE | card_types | type_name | Type name unique |
| FOREIGN KEY | cards | user_id | → users(id) |
| FOREIGN KEY | cards | card_type_id | → card_types(id) |
| CHECK | users | nid_number | LENGTH ≥ 10 |
| CHECK | users | date_of_birth | age ≥ 18 বছর |
| CHECK | card_types | application_fee | fee ≥ 0 |

---

## 6. Advanced Features

### TRIGGER: `before_card_issue`
```sql
CREATE TRIGGER before_card_issue 
BEFORE UPDATE ON cards
FOR EACH ROW 
BEGIN
    IF NEW.status = 'issued' AND OLD.status != 'issued' THEN
        SET NEW.issued_at = CURRENT_TIMESTAMP;
    END IF;
END
```
**কাজ:** যখন কোনো card-এর status 'issued' করা হয়, TRIGGER স্বয়ংক্রিয়ভাবে `issued_at` timestamp সেট করে। Admin কে manually সেট করতে হয় না।

---

### STORED PROCEDURE 1: `GetUserReport(user_id)`
```sql
CALL GetUserReport(1);
```
**কাজ:** একজন user-এর সম্পূর্ণ প্রোফাইল + তার সমস্ত card-এর তথ্য + summary statistics একসাথে return করে। তিনটা result set return করে — profile, cards list, এবং count summary।

---

### STORED PROCEDURE 2: `GetCardTypeStats()`
```sql
CALL GetCardTypeStats();
```
**কাজ:** প্রতিটা card type-এর জন্য total applications, issued count, pending count, rejected count এবং percentage একসাথে দেখায়। Admin dashboard-এর জন্য aggregation report।

---

## 7. SQL Operations Summary

| Operation | Query Type | File Reference |
|-----------|-----------|---------------|
| Register new user | INSERT | Project_Queries.sql — Query 1 |
| Get active users | SELECT + WHERE | Project_Queries.sql — Query 2 |
| Update card status | UPDATE | Project_Queries.sql — Query 3 |
| Delete suspended user | DELETE + CASCADE | Project_Queries.sql — Query 4 |
| User + card details | INNER JOIN (2 tables) | Project_Queries.sql — Query 5 |
| Cards count by type | LEFT JOIN + GROUP BY | Project_Queries.sql — Query 6 |
| Users with pending cards | Subquery (IN) | Project_Queries.sql — Query 7 |
| Apply card by type name | INSERT + Subquery | Project_Queries.sql — Query 8 |
| Users with >2 cards | GROUP BY + HAVING | Project_Queries.sql — Query 9 |
| Cards by blood group (30 days) | JOIN + DATE function | Project_Queries.sql — Query 10 |
| Dashboard summary | Aggregation (COUNT, SUM) | Project_Queries.sql — Query 11 |

---

## 8. API Endpoints

| Method | Endpoint | Operation | Description |
|--------|---------|-----------|-------------|
| POST | /api/auth/register | CREATE | নতুন user নিবন্ধন |
| POST | /api/auth/login | READ | User login |
| POST | /api/auth/send-otp | CREATE | Password reset OTP পাঠানো |
| POST | /api/auth/verify-otp | READ | OTP যাচাই |
| POST | /api/auth/reset-password | UPDATE | পাসওয়ার্ড রিসেট |
| GET | /api/user/profile | READ | User প্রোফাইল দেখা |
| PUT | /api/user/update-profile | UPDATE | প্রোফাইল আপডেট |
| GET | /api/user/cards | READ | নিজের cards দেখা |
| POST | /api/user/apply-card | CREATE | Card-এর জন্য আবেদন |
| PUT | /api/user/change-password | UPDATE | পাসওয়ার্ড পরিবর্তন |
| DELETE | /api/user/delete-account | DELETE | Account মুছে ফেলা |
| GET | /api/admin/stats | READ (Aggregation) | Dashboard statistics |
| GET | /api/admin/users | READ (JOIN) | সকল users-এর তালিকা |
| PATCH | /api/admin/users/:id/status | UPDATE | User status পরিবর্তন |
| PATCH | /api/admin/cards/:id/status | UPDATE | Card approve/reject/issue |

---

## 9. Sample Test Data

See `sample_data.sql` for ready-to-use INSERT statements:
- **6 users** (active, pending, suspended)
- **12 card applications** (various types and statuses)
- **5 OTP records**

---

*Project by: Tanvir Ahmed | Bangladesh Citizen Card System | DBMS Course Project*
