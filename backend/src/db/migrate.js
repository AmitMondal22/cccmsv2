import dotenv from 'dotenv';
dotenv.config();
import { sequelize } from '../models/index.js';

async function migrate() {
  try {
    console.log('🔄 Connecting to PostgreSQL...');
    await sequelize.authenticate();
    console.log('✅ Connected to PostgreSQL');

    console.log('🔄 Syncing models...');
    await sequelize.sync({ alter: true });
    console.log('✅ All models synced successfully');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack || error);
    if (error.original) console.error('DB error:', error.original);
    process.exit(1);
  }
}

migrate();
