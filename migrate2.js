require('dotenv').config();
const db = require('./config/db');

async function migrate() {
    try {
        await db.query('ALTER TABLE users ADD CONSTRAINT check_nid CHECK (LENGTH(nid_number) >= 10)');
        console.log('Added NID check');
    } catch(e) { console.log(e.message); }
    try {
        await db.query('ALTER TABLE card_types ADD CONSTRAINT check_fee CHECK (application_fee >= 0)');
        console.log('Added fee check');
    } catch(e) { console.log(e.message); }
    process.exit(0);
}
migrate();
