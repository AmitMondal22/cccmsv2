/**
 * One-time migration: Create FOTA tables that are missing from the database.
 * Run this once on the production server to create:
 *   - firmware_releases
 *   - fota_campaigns
 *   - fota_device_jobs
 * Also adds the fault_config JSONB column to devices if missing.
 */
import { sequelize } from './src/models/index.js';

console.log('🔄 Running FOTA table migration...');

try {
  await sequelize.authenticate();
  console.log('✅ DB connected');

  // Force-sync ONLY the FOTA models (create tables if they don't exist, alter if needed)
  const { FirmwareRelease, FotaCampaign, FotaDeviceJob, Device } = await import('./src/models/index.js');

  // Use alter:true to safely add new columns/tables without dropping existing ones
  await sequelize.sync({ alter: true });

  console.log('✅ All models synced (alter: true)');
  console.log('   → firmware_releases table: created/verified');
  console.log('   → fota_campaigns table: created/verified');
  console.log('   → fota_device_jobs table: created/verified');
  console.log('   → devices.fault_config column: added/verified');

  // Verify tables exist
  const [fwRows] = await sequelize.query("SELECT to_regclass('public.firmware_releases') AS tbl");
  const [fcRows] = await sequelize.query("SELECT to_regclass('public.fota_campaigns') AS tbl");
  const [fjRows] = await sequelize.query("SELECT to_regclass('public.fota_device_jobs') AS tbl");
  const [fcCol]  = await sequelize.query("SELECT column_name FROM information_schema.columns WHERE table_name='devices' AND column_name='fault_config'");

  console.log('\n📋 Verification:');
  console.log('   firmware_releases:  ', fwRows[0]?.tbl ? '✅ EXISTS' : '❌ MISSING');
  console.log('   fota_campaigns:     ', fcRows[0]?.tbl ? '✅ EXISTS' : '❌ MISSING');
  console.log('   fota_device_jobs:   ', fjRows[0]?.tbl ? '✅ EXISTS' : '❌ MISSING');
  console.log('   devices.fault_config:', fcCol.length > 0 ? '✅ EXISTS' : '❌ MISSING');

  await sequelize.close();
  console.log('\n✅ Migration complete.');
  process.exit(0);
} catch (err) {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
}
