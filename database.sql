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
    nid_number    VARCHAR(20)  NOT NULL UNIQUE CHECK (LENGTH(nid_number) >= 10),
    full_name     VARCHAR(100) NOT NULL,
    date_of_birth DATE         NOT NULL CHECK (date_of_birth <= DATE_SUB(CURDATE(), INTERVAL 18 YEAR)),
    phone         VARCHAR(15)  NOT NULL UNIQUE,
    email         VARCHAR(150) DEFAULT NULL,
    blood_group   ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') DEFAULT NULL,
    address       TEXT         DEFAULT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status        ENUM('pending', 'active', 'suspended') DEFAULT 'pending',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
-- 2. CARD TYPES TABLE (Strict 3NF Normalization)
-- ─────────────────────────────────────────────
CREATE TABLE card_types (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    type_name        VARCHAR(50) NOT NULL UNIQUE,
    application_fee  DECIMAL(10,2) DEFAULT 0.00
);

-- Insert default card types
INSERT INTO card_types (type_name) VALUES 
('family'), ('business'), ('student'), ('vehicle'), ('agriculture');

-- ─────────────────────────────────────────────
-- 3. CARDS TABLE (card requests per user)
-- ─────────────────────────────────────────────
CREATE TABLE cards (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT NOT NULL,
    card_type_id  INT NOT NULL,
    card_number   VARCHAR(30) UNIQUE,
    status        ENUM('applied', 'processing', 'approved', 'rejected', 'issued') DEFAULT 'applied',
    applied_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    issued_at     TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (card_type_id) REFERENCES card_types(id) ON DELETE RESTRICT
);

-- ─────────────────────────────────────────────
-- TRIGGER: Auto-update issued_at timestamp
-- ─────────────────────────────────────────────
DELIMITER //
CREATE TRIGGER before_card_issue 
BEFORE UPDATE ON cards
FOR EACH ROW 
BEGIN
    IF NEW.status = 'issued' AND OLD.status != 'issued' THEN
        SET NEW.issued_at = CURRENT_TIMESTAMP;
    END IF;
END //
DELIMITER ;

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
