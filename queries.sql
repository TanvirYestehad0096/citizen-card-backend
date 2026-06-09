-- ==============================================================================
-- 🎓 DBMD PROJECT - REQUIRED SQL QUERIES (10+ Queries)
-- =============================================================================

-- ---------------------------------------------------------
-- 1. INSERT (Create) - Insert a new user
-- ---------------------------------------------------------
INSERT INTO users (nid_number, full_name, date_of_birth, phone, password_hash)
VALUES ('19901234567890', 'Rakib Hasan', '1990-05-15', '01711000000', '$2b$10$hashedpassword');

-- ---------------------------------------------------------
-- 2. SELECT (Read) - Basic condition filtering
-- ---------------------------------------------------------
SELECT id, full_name, phone, status 
FROM users 
WHERE status = 'active' 
ORDER BY created_at DESC;

-- ---------------------------------------------------------
-- 3. UPDATE (Update) - Change card status dynamically
-- ---------------------------------------------------------
UPDATE cards 
SET status = 'approved', card_number = 'BD-FAM-123456-7890' 
WHERE id = 5;

-- ---------------------------------------------------------
-- 4. DELETE (Delete) - Remove a user and their cards (Cascade)
-- ---------------------------------------------------------
DELETE FROM users 
WHERE id = 12 AND status = 'suspended';

-- ---------------------------------------------------------
-- 5. INNER JOIN - Fetch user details along with their applied cards
-- ---------------------------------------------------------
SELECT u.full_name, u.nid_number, ct.type_name AS card_type, c.status 
FROM users u
INNER JOIN cards c ON u.id = c.user_id
INNER JOIN card_types ct ON c.card_type_id = ct.id
WHERE u.id = 5;

-- ---------------------------------------------------------
-- 6. LEFT JOIN & AGGREGATION (GROUP BY) - Count cards by type
-- ---------------------------------------------------------
SELECT ct.type_name, COUNT(c.id) as total_applications 
FROM card_types ct 
LEFT JOIN cards c ON ct.id = c.card_type_id 
GROUP BY ct.type_name
ORDER BY total_applications DESC;

-- ---------------------------------------------------------
-- 7. SUBQUERY (in SELECT) - Find users with pending cards
-- ---------------------------------------------------------
SELECT full_name, phone 
FROM users 
WHERE id IN (
    SELECT user_id FROM cards WHERE status = 'applied'
);

-- ---------------------------------------------------------
-- 8. SUBQUERY (in INSERT) - Apply for a card using type name lookup
-- ---------------------------------------------------------
INSERT INTO cards (user_id, card_type_id, card_number, status, applied_at) 
SELECT 5, id, 'BD-BUS-999-123', 'applied', NOW() 
FROM card_types 
WHERE type_name = 'business';

-- ---------------------------------------------------------
-- 9. AGGREGATION (HAVING) - Find users with more than 2 cards
-- ---------------------------------------------------------
SELECT u.full_name, COUNT(c.id) as card_count 
FROM users u
JOIN cards c ON u.id = c.user_id
GROUP BY u.id, u.full_name
HAVING card_count > 2;

-- ---------------------------------------------------------
-- 10. COMPLEX QUERY (JOIN + Subquery + Aggregation + Date Condition)
-- Get total cards issued in the last 30 days grouped by blood group
-- ---------------------------------------------------------
SELECT u.blood_group, COUNT(c.id) as issued_last_30_days
FROM users u
JOIN cards c ON u.id = c.user_id
WHERE c.status = 'issued' 
  AND c.issued_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
  AND u.blood_group IS NOT NULL
GROUP BY u.blood_group;

-- 11. VIEW - Admin dashboard summary
SELECT 
    COUNT(DISTINCT u.id) AS total_users,
    COUNT(c.id) AS total_cards,
    SUM(CASE WHEN c.status = 'issued' THEN 1 ELSE 0 END) AS issued_cards,
    SUM(CASE WHEN c.status = 'pending' THEN 1 ELSE 0 END) AS pending_cards
FROM users u
LEFT JOIN cards c ON u.id = c.user_id;
