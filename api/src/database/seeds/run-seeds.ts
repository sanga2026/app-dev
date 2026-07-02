import { AppDataSource } from '../../config/data-source';
import { seedCurrencies } from './01_currencies.seed';
import { seedCountries } from './02_countries.seed';
import { seedIndiaStates } from './03_india_states.seed';
import { seedDocumentTypes } from './04_document_types.seed';
import { seedSystemRoles } from './05_system_roles.seed';
import { seedSuperAdminUser } from './06_super_admin.seed';

async function runSeeds() {
  console.log('🌱 Initializing database connection...');

  try {
    await AppDataSource.initialize();
    console.log('✅ Database connected.\n');

    console.log('▶  Running: Currencies');
    await seedCurrencies();

    console.log('▶  Running: Countries');
    await seedCountries();

    console.log('▶  Running: India States');
    await seedIndiaStates();

    console.log('▶  Running: Document Types');
    await seedDocumentTypes();

    console.log('▶  Running: System Roles');
    await seedSystemRoles();

    console.log('▶  Running: Super Admin User');
    await seedSuperAdminUser();

    console.log('\n🎉 All seeds completed successfully!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

runSeeds();
