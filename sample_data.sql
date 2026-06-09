-- ==============================================================================
-- 🇧🇩 Bangladesh Citizen Card System — Sample Data
-- ==============================================================================
-- Run this AFTER database.sql to populate the database with realistic test data.

USE citizen_card_db;

-- ------------------------------------------------------------------------------
-- USERS (6 sample citizens)
-- ------------------------------------------------------------------------------
INSERT INTO users (nid_number, full_name, date_of_birth, phone, email, blood_group, address, password_hash, status) VALUES
('1990123456789', 'Tanvir Ahmed',       '1990-06-15', '01711111111', 'tanvir@gmail.com',  'B+',  'House 12, Road 5, Mirpur, Dhaka',        '$2b$10$hashedpassword1', 'active'),
('1992234567890', 'Nusrat Jahan',       '1992-03-22', '01722222222', 'nusrat@gmail.com',  'A+',  'Flat 3B, Gulshan-1, Dhaka',              '$2b$10$hashedpassword2', 'active'),
('1988345678901', 'Karim Uddin',        '1988-11-10', '01733333333', 'karim@gmail.com',   'O+',  'Village: Comilla Sadar, Comilla',         '$2b$10$hashedpassword3', 'active'),
('1995456789012', 'Fatema Begum',       '1995-07-30', '01744444444', 'fatema@gmail.com',  'AB+', '45 Agrabad, Chittagong',                  '$2b$10$hashedpassword4', 'pending'),
('1985567890123', 'Rafiqul Islam',      '1985-01-05', '01755555555', 'rafiq@gmail.com',   'B-',  'Sylhet Sadar, Sylhet',                    '$2b$10$hashedpassword5', 'active'),
('1998678901234', 'Sumaia Akter',       '1998-09-18', '01766666666', 'sumaia@gmail.com',  'A-',  'Rajshahi City Corporation, Rajshahi',     '$2b$10$hashedpassword6', 'suspended');

-- ------------------------------------------------------------------------------
-- CARDS (multiple cards per user — different types and statuses)
-- ------------------------------------------------------------------------------
INSERT INTO cards (user_id, card_type_id, card_number, status, applied_at, issued_at) VALUES
-- Tanvir Ahmed (user 1) — 3 cards
(1, 1, 'BD-FAM-2024-00001', 'issued',     '2024-01-10 09:00:00', '2024-02-01 10:00:00'),
(1, 3, 'BD-STU-2024-00002', 'approved',   '2024-02-15 10:30:00', NULL),
(1, 4, 'BD-VEH-2024-00003', 'processing', '2024-03-20 11:00:00', NULL),

-- Nusrat Jahan (user 2) — 2 cards
(2, 1, 'BD-FAM-2024-00004', 'issued',     '2024-01-20 08:00:00', '2024-02-10 09:00:00'),
(2, 2, 'BD-BUS-2024-00005', 'applied',    '2024-04-05 14:00:00', NULL),

-- Karim Uddin (user 3) — 2 cards
(3, 5, 'BD-AGR-2024-00006', 'issued',     '2024-01-05 07:00:00', '2024-01-25 08:00:00'),
(3, 1, 'BD-FAM-2024-00007', 'approved',   '2024-03-01 10:00:00', NULL),

-- Fatema Begum (user 4) — 1 card
(4, 3, NULL,                 'applied',    '2024-05-01 12:00:00', NULL),

-- Rafiqul Islam (user 5) — 3 cards
(5, 2, 'BD-BUS-2024-00009', 'issued',     '2024-02-01 09:00:00', '2024-02-20 10:00:00'),
(5, 4, 'BD-VEH-2024-00010', 'issued',     '2024-02-01 09:30:00', '2024-02-20 11:00:00'),
(5, 5, 'BD-AGR-2024-00011', 'rejected',   '2024-03-10 13:00:00', NULL),

-- Sumaia Akter (user 6) — 1 card
(6, 1, NULL,                 'applied',    '2024-04-20 15:00:00', NULL);

-- ------------------------------------------------------------------------------
-- OTP VERIFICATIONS (sample OTP records)
-- ------------------------------------------------------------------------------
INSERT INTO otp_verifications (phone, otp_code, purpose, is_used, expires_at) VALUES
('01711111111', '123456', 'registration',   TRUE,  '2024-01-10 09:10:00'),
('01722222222', '234567', 'registration',   TRUE,  '2024-01-20 08:10:00'),
('01733333333', '345678', 'password_reset', TRUE,  '2024-03-15 11:10:00'),
('01755555555', '456789', 'registration',   TRUE,  '2024-02-01 09:10:00'),
('01766666666', '567890', 'password_reset', FALSE, '2024-04-20 15:10:00');

-- ==============================================================================
-- ✅ Sample data summary:
-- Users:             6 (active, pending, suspended)
-- Cards:            12 (issued, approved, processing, applied, rejected)
-- Card Types:        5 (family, business, student, vehicle, agriculture)
-- OTP Records:       5
-- ==============================================================================
