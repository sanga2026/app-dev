import { AppDataSource } from '../../config/data-source';
import { CurrencyEntity } from '../../modules/currencies/entities/currency.entity';

export async function seedCurrencies() {
  const repo = AppDataSource.getRepository(CurrencyEntity);

  const currencies: Partial<CurrencyEntity>[] = [
    { code: 'INR', name: 'Indian Rupee',       symbol: '₹',  decimalPlaces: 2, isActive: true },
    { code: 'USD', name: 'US Dollar',           symbol: '$',  decimalPlaces: 2, isActive: true },
    { code: 'EUR', name: 'Euro',                symbol: '€',  decimalPlaces: 2, isActive: true },
    { code: 'GBP', name: 'British Pound',       symbol: '£',  decimalPlaces: 2, isActive: true },
    { code: 'JPY', name: 'Japanese Yen',        symbol: '¥',  decimalPlaces: 0, isActive: true },
    { code: 'CNY', name: 'Chinese Yuan',        symbol: '¥',  decimalPlaces: 2, isActive: true },
    { code: 'CHF', name: 'Swiss Franc',         symbol: 'Fr', decimalPlaces: 2, isActive: true },
    { code: 'AUD', name: 'Australian Dollar',   symbol: 'A$', decimalPlaces: 2, isActive: true },
    { code: 'CAD', name: 'Canadian Dollar',     symbol: 'C$', decimalPlaces: 2, isActive: true },
    { code: 'SGD', name: 'Singapore Dollar',    symbol: 'S$', decimalPlaces: 2, isActive: true },
    { code: 'AED', name: 'UAE Dirham',          symbol: 'د.إ', decimalPlaces: 2, isActive: true },
    { code: 'SAR', name: 'Saudi Riyal',         symbol: '﷼',  decimalPlaces: 2, isActive: true },
    { code: 'BDT', name: 'Bangladeshi Taka',    symbol: '৳',  decimalPlaces: 2, isActive: true },
    { code: 'NPR', name: 'Nepalese Rupee',      symbol: '₨',  decimalPlaces: 2, isActive: true },
    { code: 'LKR', name: 'Sri Lankan Rupee',    symbol: '₨',  decimalPlaces: 2, isActive: true },
    { code: 'PKR', name: 'Pakistani Rupee',     symbol: '₨',  decimalPlaces: 2, isActive: true },
    { code: 'MYR', name: 'Malaysian Ringgit',   symbol: 'RM', decimalPlaces: 2, isActive: true },
    { code: 'THB', name: 'Thai Baht',           symbol: '฿',  decimalPlaces: 2, isActive: true },
    { code: 'IDR', name: 'Indonesian Rupiah',   symbol: 'Rp', decimalPlaces: 0, isActive: true },
    { code: 'ZAR', name: 'South African Rand',  symbol: 'R',  decimalPlaces: 2, isActive: true },
    { code: 'NZD', name: 'New Zealand Dollar',  symbol: 'NZ$', decimalPlaces: 2, isActive: true },
    { code: 'HKD', name: 'Hong Kong Dollar',    symbol: 'HK$', decimalPlaces: 2, isActive: true },
    { code: 'KRW', name: 'South Korean Won',    symbol: '₩',  decimalPlaces: 0, isActive: true },
    { code: 'BRL', name: 'Brazilian Real',      symbol: 'R$', decimalPlaces: 2, isActive: true },
    { code: 'MXN', name: 'Mexican Peso',        symbol: '$',  decimalPlaces: 2, isActive: true },
    { code: 'NOK', name: 'Norwegian Krone',     symbol: 'kr', decimalPlaces: 2, isActive: true },
    { code: 'SEK', name: 'Swedish Krona',       symbol: 'kr', decimalPlaces: 2, isActive: true },
    { code: 'DKK', name: 'Danish Krone',        symbol: 'kr', decimalPlaces: 2, isActive: true },
    { code: 'RUB', name: 'Russian Ruble',       symbol: '₽',  decimalPlaces: 2, isActive: true },
    { code: 'TRY', name: 'Turkish Lira',        symbol: '₺',  decimalPlaces: 2, isActive: true },
  ];

  for (const currency of currencies) {
    const exists = await repo.findOne({ where: { code: currency.code! } });
    if (!exists) {
      await repo.save(repo.create(currency));
    }
  }

  console.log(`✅ Currencies seeded (${currencies.length} entries)`);
}
