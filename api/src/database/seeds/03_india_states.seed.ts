import { AppDataSource } from '../../config/data-source';
import { StateEntity } from '../../modules/geography/entities/state.entity';

export async function seedIndiaStates() {
  const repo = AppDataSource.getRepository(StateEntity);

  const states: Partial<StateEntity>[] = [
    { countryCode: 'IN', name: 'Andhra Pradesh',      code: 'IN-AP', isActive: true },
    { countryCode: 'IN', name: 'Arunachal Pradesh',   code: 'IN-AR', isActive: true },
    { countryCode: 'IN', name: 'Assam',               code: 'IN-AS', isActive: true },
    { countryCode: 'IN', name: 'Bihar',               code: 'IN-BR', isActive: true },
    { countryCode: 'IN', name: 'Chhattisgarh',        code: 'IN-CG', isActive: true },
    { countryCode: 'IN', name: 'Goa',                 code: 'IN-GA', isActive: true },
    { countryCode: 'IN', name: 'Gujarat',             code: 'IN-GJ', isActive: true },
    { countryCode: 'IN', name: 'Haryana',             code: 'IN-HR', isActive: true },
    { countryCode: 'IN', name: 'Himachal Pradesh',    code: 'IN-HP', isActive: true },
    { countryCode: 'IN', name: 'Jharkhand',           code: 'IN-JH', isActive: true },
    { countryCode: 'IN', name: 'Karnataka',           code: 'IN-KA', isActive: true },
    { countryCode: 'IN', name: 'Kerala',              code: 'IN-KL', isActive: true },
    { countryCode: 'IN', name: 'Madhya Pradesh',      code: 'IN-MP', isActive: true },
    { countryCode: 'IN', name: 'Maharashtra',         code: 'IN-MH', isActive: true },
    { countryCode: 'IN', name: 'Manipur',             code: 'IN-MN', isActive: true },
    { countryCode: 'IN', name: 'Meghalaya',           code: 'IN-ML', isActive: true },
    { countryCode: 'IN', name: 'Mizoram',             code: 'IN-MZ', isActive: true },
    { countryCode: 'IN', name: 'Nagaland',            code: 'IN-NL', isActive: true },
    { countryCode: 'IN', name: 'Odisha',              code: 'IN-OR', isActive: true },
    { countryCode: 'IN', name: 'Punjab',              code: 'IN-PB', isActive: true },
    { countryCode: 'IN', name: 'Rajasthan',           code: 'IN-RJ', isActive: true },
    { countryCode: 'IN', name: 'Sikkim',              code: 'IN-SK', isActive: true },
    { countryCode: 'IN', name: 'Tamil Nadu',          code: 'IN-TN', isActive: true },
    { countryCode: 'IN', name: 'Telangana',           code: 'IN-TS', isActive: true },
    { countryCode: 'IN', name: 'Tripura',             code: 'IN-TR', isActive: true },
    { countryCode: 'IN', name: 'Uttar Pradesh',       code: 'IN-UP', isActive: true },
    { countryCode: 'IN', name: 'Uttarakhand',         code: 'IN-UK', isActive: true },
    { countryCode: 'IN', name: 'West Bengal',         code: 'IN-WB', isActive: true },
    // Union Territories
    { countryCode: 'IN', name: 'Andaman and Nicobar Islands', code: 'IN-AN', isActive: true },
    { countryCode: 'IN', name: 'Chandigarh',          code: 'IN-CH', isActive: true },
    { countryCode: 'IN', name: 'Dadra and Nagar Haveli and Daman and Diu', code: 'IN-DH', isActive: true },
    { countryCode: 'IN', name: 'Delhi',               code: 'IN-DL', isActive: true },
    { countryCode: 'IN', name: 'Jammu and Kashmir',   code: 'IN-JK', isActive: true },
    { countryCode: 'IN', name: 'Ladakh',              code: 'IN-LA', isActive: true },
    { countryCode: 'IN', name: 'Lakshadweep',         code: 'IN-LD', isActive: true },
    { countryCode: 'IN', name: 'Puducherry',          code: 'IN-PY', isActive: true },
  ];

  for (const state of states) {
    const exists = await repo.findOne({ where: { code: state.code!, countryCode: 'IN' } });
    if (!exists) {
      await repo.save(repo.create(state));
    }
  }

  console.log(`✅ India states/UTs seeded (${states.length} entries)`);
}
