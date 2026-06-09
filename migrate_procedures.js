require('dotenv').config();
const db = require('./config/db');

async function addStoredProcedures() {
    try {
        // Drop if exists first
        await db.query('DROP PROCEDURE IF EXISTS GetUserReport');
        await db.query('DROP PROCEDURE IF EXISTS GetCardTypeStats');
        console.log('✅ Old procedures dropped');

        // Create GetUserReport
        await db.query(`
            CREATE PROCEDURE GetUserReport(IN p_user_id INT)
            BEGIN
                SELECT u.id, u.full_name, u.nid_number, u.phone, u.email,
                       u.blood_group, u.address, u.status, u.created_at
                FROM users u WHERE u.id = p_user_id;

                SELECT c.id AS card_id, ct.type_name AS card_type,
                       c.card_number, c.status AS card_status, c.applied_at, c.issued_at
                FROM cards c
                JOIN card_types ct ON c.card_type_id = ct.id
                WHERE c.user_id = p_user_id
                ORDER BY c.applied_at DESC;

                SELECT COUNT(*) AS total_cards,
                       SUM(CASE WHEN c.status = 'issued' THEN 1 ELSE 0 END) AS issued_cards,
                       SUM(CASE WHEN c.status = 'applied' THEN 1 ELSE 0 END) AS pending_cards
                FROM cards c WHERE c.user_id = p_user_id;
            END
        `);
        console.log('✅ GetUserReport procedure created');

        // Create GetCardTypeStats
        await db.query(`
            CREATE PROCEDURE GetCardTypeStats()
            BEGIN
                SELECT ct.type_name,
                       COUNT(c.id) AS total_applications,
                       SUM(CASE WHEN c.status = 'issued'   THEN 1 ELSE 0 END) AS issued,
                       SUM(CASE WHEN c.status = 'applied'  THEN 1 ELSE 0 END) AS pending,
                       SUM(CASE WHEN c.status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
                       ROUND(COUNT(c.id) * 100.0 / NULLIF((SELECT COUNT(*) FROM cards), 0), 2) AS percentage
                FROM card_types ct
                LEFT JOIN cards c ON ct.id = c.card_type_id
                GROUP BY ct.type_name
                ORDER BY total_applications DESC;
            END
        `);
        console.log('✅ GetCardTypeStats procedure created');

        // Test both procedures
        console.log('\n--- Testing GetUserReport(1) ---');
        const [results] = await db.query('CALL GetUserReport(1)');
        console.log('User:', JSON.stringify(results[0][0]));
        console.log('Cards count:', results[1].length);
        console.log('Summary:', JSON.stringify(results[2][0]));

        console.log('\n--- Testing GetCardTypeStats() ---');
        const [stats] = await db.query('CALL GetCardTypeStats()');
        stats[0].forEach(row => console.log(`  ${row.type_name}: ${row.total_applications} apps`));

        console.log('\n🎉 Both stored procedures working correctly!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

addStoredProcedures();
