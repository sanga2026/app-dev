import { AppDataSource } from '../../config/data-source';
import { CountryEntity } from '../../modules/geography/entities/country.entity';

export async function seedCountries() {
  const repo = AppDataSource.getRepository(CountryEntity);

  const countries: Partial<CountryEntity>[] = [
    { code: 'IN', name: 'India',             dialCode: '+91',  currencyCode: 'INR', flag: '🇮🇳', isActive: true },
    { code: 'US', name: 'United States',     dialCode: '+1',   currencyCode: 'USD', flag: '🇺🇸', isActive: true },
    { code: 'GB', name: 'United Kingdom',    dialCode: '+44',  currencyCode: 'GBP', flag: '🇬🇧', isActive: true },
    { code: 'AE', name: 'UAE',               dialCode: '+971', currencyCode: 'AED', flag: '🇦🇪', isActive: true },
    { code: 'SG', name: 'Singapore',         dialCode: '+65',  currencyCode: 'SGD', flag: '🇸🇬', isActive: true },
    { code: 'AU', name: 'Australia',         dialCode: '+61',  currencyCode: 'AUD', flag: '🇦🇺', isActive: true },
    { code: 'CA', name: 'Canada',            dialCode: '+1',   currencyCode: 'CAD', flag: '🇨🇦', isActive: true },
    { code: 'DE', name: 'Germany',           dialCode: '+49',  currencyCode: 'EUR', flag: '🇩🇪', isActive: true },
    { code: 'JP', name: 'Japan',             dialCode: '+81',  currencyCode: 'JPY', flag: '🇯🇵', isActive: true },
    { code: 'CN', name: 'China',             dialCode: '+86',  currencyCode: 'CNY', flag: '🇨🇳', isActive: true },
    { code: 'NP', name: 'Nepal',             dialCode: '+977', currencyCode: 'NPR', flag: '🇳🇵', isActive: true },
    { code: 'LK', name: 'Sri Lanka',         dialCode: '+94',  currencyCode: 'LKR', flag: '🇱🇰', isActive: true },
    { code: 'BD', name: 'Bangladesh',        dialCode: '+880', currencyCode: 'BDT', flag: '🇧🇩', isActive: true },
    { code: 'PK', name: 'Pakistan',          dialCode: '+92',  currencyCode: 'PKR', flag: '🇵🇰', isActive: true },
    { code: 'MY', name: 'Malaysia',          dialCode: '+60',  currencyCode: 'MYR', flag: '🇲🇾', isActive: true },
    { code: 'ZA', name: 'South Africa',      dialCode: '+27',  currencyCode: 'ZAR', flag: '🇿🇦', isActive: true },
    { code: 'SA', name: 'Saudi Arabia',      dialCode: '+966', currencyCode: 'SAR', flag: '🇸🇦', isActive: true },
  ];

  for (const country of countries) {
    const exists = await repo.findOne({ where: { code: country.code! } });
    if (!exists) {
      await repo.save(repo.create(country));
    }
  }

  console.log(`✅ Countries seeded (${countries.length} entries)`);
}
