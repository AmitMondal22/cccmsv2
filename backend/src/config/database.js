import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
dotenv.config();

// Enforce Indian Standard Time globally in Node process
process.env.TZ = 'Asia/Kolkata';

const sequelize = new Sequelize(
  process.env.DB_NAME || 'techavo_ccms',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    timezone: '+05:30', // Indian Standard Time
    logging: false,
    dialectOptions: {
      useUTC: false, // Return timestamps in IST
      dateStrings: true,
      typeCast: true,
    },
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      underscored: true,
      timestamps: true,
    },
  }
);

export default sequelize;
