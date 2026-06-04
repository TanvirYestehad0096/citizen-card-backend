-- ============================================
-- Bangladesh Citizen Card System — Database Schema
-- ============================================

CREATE DATABASE IF NOT EXISTS citizen_card_db;
USE citizen_card_db;

-- ─────────────────────────────────────────────
-- 1. USERS TABLE
-- ─────────────────────────────────────────────
CREATE TABLE users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    nid_number    VARCHAR(20)  NOT NULL UNIQUE,
    full_name     VARCHAR(100) NOT NULL,
    date_of_birth DATE         NOT NULL,
    phone         VARCHAR(15)  NOT NULL UNIQUE,
    email         VARCHAR(150) DEFAULT NULL,
    blood_group   ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') DEFAULT NULL,
    address       TEXT         DEFAULT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status        ENUM('pending', 'active', 'suspended') DEFAULT 'pending',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Run these if table already exists (for existing deployments):
-- ALTER TABLE users ADD COLUMN email       VARCHAR(150) DEFAULT NULL AFTER phone;
-- ALTER TABLE users ADD COLUMN blood_group ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') DEFAULT NULL AFTER email;
-- ALTER TABLE users ADD COLUMN address     TEXT         DEFAULT NULL AFTER blood_group;

-- ─────────────────────────────────────────────
-- 2. CARDS TABLE (card types per user)
-- ─────────────────────────────────────────────
CREATE TABLE cards (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    card_type   ENUM('family', 'business', 'student', 'vehicle', 'agriculture') NOT NULL,
    card_number VARCHAR(30) UNIQUE,
    status      ENUM('applied', 'processing', 'approved', 'rejected', 'issued') DEFAULT 'applied',
    applied_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    issued_at   TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────────
-- 3. OTP TABLE
-- ─────────────────────────────────────────────
CREATE TABLE otp_verifications (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    phone      VARCHAR(15) NOT NULL,
    otp_code   VARCHAR(6)  NOT NULL,
    purpose    ENUM('registration', 'password_reset') NOT NULL,
    is_used    BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
-- 4. ADMIN TABLE
-- ─────────────────────────────────────────────
CREATE TABLE admins (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(100),
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
-- 5. SESSIONS TABLE (JWT blacklist for logout)
-- ─────────────────────────────────────────────
CREATE TABLE token_blacklist (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    token      TEXT NOT NULL,
    expired_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
-- DEFAULT ADMIN (password: Admin@1234)
-- ─────────────────────────────────────────────
INSERT INTO admins (username, password_hash, full_name)
VALUES (
    'admin',
    '$2b$10$placeholder_replace_with_real_bcrypt_hash',
    'System Administrator'
);
