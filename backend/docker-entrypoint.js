import { spawn } from 'child_process';
import { sequelize, User } from './src/models/index.js';

// Enforce Indian Standard Time globally
process.env.TZ = 'Asia/Kolkata';

async function waitForDb(maxRetries = 30, delayMs = 1500) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await sequelize.authenticate();
      console.log('✅ Connected to PostgreSQL database.');
      return;
    } catch (err) {
      console.log(`⏳ [${attempt}/${maxRetries}] Waiting for PostgreSQL to be ready... (${err.message})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('Could not connect to PostgreSQL within retry limit.');
}

function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], { stdio: 'inherit' });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Script ${scriptPath} exited with code ${code}`));
    });
  });
}

async function main() {
  try {
    await waitForDb();

    // Check if initial seeding is needed
    let userCount = 0;
    try {
      userCount = await User.count();
    } catch {
      // Table doesn't exist yet, seed script will create columns & sync
      userCount = 0;
    }

    if (userCount === 0) {
      console.log('🌱 Database is empty (0 users found). Running initial database seed...');
      await runScript('src/db/seed.js');
      console.log('✅ Initial database seed completed!');
    } else {
      console.log(`ℹ️ Existing database detected with ${userCount} user(s). Skipping seed.`);
    }

    // Determine target command
    const args = process.argv.slice(2);
    const targetScript = args.length > 0 ? args : ['src/index.js'];

    console.log(`🚀 Starting Techavo CCMS: node ${targetScript.join(' ')}`);
    const app = spawn(process.execPath, targetScript, { stdio: 'inherit' });

    process.on('SIGINT', () => app.kill('SIGINT'));
    process.on('SIGTERM', () => app.kill('SIGTERM'));

    app.on('exit', (code) => {
      process.exit(code ?? 0);
    });
  } catch (err) {
    console.error('❌ Startup error:', err);
    process.exit(1);
  }
}

main();

