require('dotenv').config();
const db = require('./config/db');

async function migrate() {
    console.log('Starting migration...');
    try {
        // 1. Create card_types table
        await db.query(`
            CREATE TABLE IF NOT EXISTS card_types (
                id INT AUTO_INCREMENT PRIMARY KEY,
                type_name VARCHAR(50) NOT NULL UNIQUE,
                application_fee DECIMAL(10,2) DEFAULT 0.00
            )
        `);
        console.log('Created card_types table');

        // 2. Insert default data (Ignore if exists)
        await db.query(`
            INSERT IGNORE INTO card_types (type_name) VALUES 
            ('family'), ('business'), ('student'), ('vehicle'), ('agriculture')
        `);
        console.log('Inserted card types');

        // 3. Add card_type_id to cards
        try {
            await db.query('ALTER TABLE cards ADD COLUMN card_type_id INT AFTER user_id');
            console.log('Added card_type_id to cards');
        } catch (e) {
            console.log('card_type_id might already exist');
        }

        // 4. Migrate data from ENUM to ID
        await db.query(`
            UPDATE cards c
            JOIN card_types ct ON c.card_type = ct.type_name
            SET c.card_type_id = ct.id
        `);
        console.log('Migrated existing card types to IDs');

        // 5. Add Foreign Key and Drop ENUM
        try {
            // Delete orphaned cards if any
            await db.query('DELETE FROM cards WHERE card_type_id IS NULL');
            
            // Alter constraint
            await db.query('ALTER TABLE cards MODIFY card_type_id INT NOT NULL');
            await db.query('ALTER TABLE cards ADD FOREIGN KEY (card_type_id) REFERENCES card_types(id) ON DELETE RESTRICT');
            await db.query('ALTER TABLE cards DROP COLUMN card_type');
            console.log('Added FK and dropped ENUM');
        } catch (e) {
            console.log('FK error or already done:', e.message);
        }

        // 6. Add CHECK constraints to users
        try {
            await db.query('ALTER TABLE users ADD CONSTRAINT check_nid CHECK (LENGTH(nid_number) >= 10)');
            await db.query('ALTER TABLE users ADD CONSTRAINT check_age CHECK (date_of_birth <= DATE_SUB(CURDATE(), INTERVAL 18 YEAR))');
            console.log('Added CHECK constraints to users');
        } catch (e) {
            console.log('Check constraints might already exist:', e.message);
        }

        // 7. Add Trigger
        try {
            await db.query('DROP TRIGGER IF EXISTS before_card_issue');
            await db.query(`
                CREATE TRIGGER before_card_issue 
                BEFORE UPDATE ON cards
                FOR EACH ROW 
                BEGIN
                    IF NEW.status = 'issued' AND OLD.status != 'issued' THEN
                        SET NEW.issued_at = CURRENT_TIMESTAMP;
                    END IF;
                END
            `);
            console.log('Added trigger before_card_issue');
        } catch (e) {
            console.log('Trigger creation error:', e.message);
        }

        console.log('Migration successful!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit(0);
    }
}

migrate();
