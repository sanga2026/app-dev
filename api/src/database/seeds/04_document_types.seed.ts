import { AppDataSource } from '../../config/data-source';
import { DocumentTypeEntity, DocumentCategory } from '../../modules/master-data/entities/document-type.entity';

export async function seedDocumentTypes() {
  const repo = AppDataSource.getRepository(DocumentTypeEntity);

  const documents: Partial<DocumentTypeEntity>[] = [
    // IDENTITY
    {
      id: 'PAN',
      name: 'Permanent Account Number',
      category: DocumentCategory.IDENTITY,
      validationRegex: '^[A-Z]{5}[0-9]{4}[A-Z]{1}$',
      placeholder: 'ABCDE1234F',
      country: 'INDIA',
      isActive: true,
      isMandatory: true,
    },
    {
      id: 'AADHAAR',
      name: 'Aadhaar Card',
      category: DocumentCategory.IDENTITY,
      validationRegex: '^[0-9]{12}$',
      placeholder: '1234 5678 9012',
      country: 'INDIA',
      isActive: true,
      isMandatory: false,
    },
    {
      id: 'PASSPORT',
      name: 'Passport',
      category: DocumentCategory.IDENTITY,
      validationRegex: '^[A-Z][1-9][0-9]{7}$',
      placeholder: 'A1234567',
      country: 'INDIA',
      isActive: true,
      isMandatory: false,
    },
    {
      id: 'VOTER_ID',
      name: 'Voter ID Card',
      category: DocumentCategory.IDENTITY,
      validationRegex: '^[A-Z]{3}[0-9]{7}$',
      placeholder: 'ABC1234567',
      country: 'INDIA',
      isActive: true,
      isMandatory: false,
    },
    {
      id: 'DRIVING_LICENSE',
      name: 'Driving License',
      category: DocumentCategory.IDENTITY,
      validationRegex: '^[A-Z]{2}[0-9]{2}[0-9]{11}$',
      placeholder: 'KA0120231234567',
      country: 'INDIA',
      isActive: true,
      isMandatory: false,
    },
    // ADDRESS
    {
      id: 'UTILITY_BILL',
      name: 'Utility Bill (Electricity/Water)',
      category: DocumentCategory.ADDRESS,
      validationRegex: null as any,
      placeholder: null as any,
      country: 'INDIA',
      isActive: true,
      isMandatory: false,
    },
    {
      id: 'BANK_STATEMENT',
      name: 'Bank Statement',
      category: DocumentCategory.ADDRESS,
      validationRegex: null as any,
      placeholder: null as any,
      country: 'INDIA',
      isActive: true,
      isMandatory: false,
    },
    {
      id: 'RENT_AGREEMENT',
      name: 'Rent Agreement',
      category: DocumentCategory.ADDRESS,
      validationRegex: null as any,
      placeholder: null as any,
      country: 'INDIA',
      isActive: true,
      isMandatory: false,
    },
    // BUSINESS
    {
      id: 'GSTIN',
      name: 'GSTIN Certificate',
      category: DocumentCategory.BUSINESS,
      validationRegex: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$',
      placeholder: '27AAPFU0939F1ZV',
      country: 'INDIA',
      isActive: true,
      isMandatory: false,
    },
    {
      id: 'CIN',
      name: 'Company Identification Number',
      category: DocumentCategory.BUSINESS,
      validationRegex: '^[LUu][0-9]{5}[A-Za-z]{2}[0-9]{4}[A-Za-z]{3}[0-9]{6}$',
      placeholder: 'L17110MH1973PLC019786',
      country: 'INDIA',
      isActive: true,
      isMandatory: false,
    },
    // INCOME
    {
      id: 'FORM_16',
      name: 'Form 16 (TDS Certificate)',
      category: DocumentCategory.INCOME,
      validationRegex: null as any,
      placeholder: null as any,
      country: 'INDIA',
      isActive: true,
      isMandatory: false,
    },
    {
      id: 'ITR',
      name: 'Income Tax Return',
      category: DocumentCategory.INCOME,
      validationRegex: null as any,
      placeholder: null as any,
      country: 'INDIA',
      isActive: true,
      isMandatory: false,
    },
    {
      id: 'SALARY_SLIP',
      name: 'Salary Slip',
      category: DocumentCategory.INCOME,
      validationRegex: null as any,
      placeholder: null as any,
      country: 'INDIA',
      isActive: true,
      isMandatory: false,
    },
  ];

  for (const doc of documents) {
    const exists = await repo.findOne({ where: { id: doc.id! } });
    if (!exists) {
      await repo.save(repo.create(doc));
    }
  }

  console.log(`✅ Document types seeded (${documents.length} entries)`);
}
