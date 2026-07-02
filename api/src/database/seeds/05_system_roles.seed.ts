import { AppDataSource } from '../../config/data-source';
import { RoleEntity } from '../../modules/access-control/entities/role.entity';
import { UserRole } from '../../modules/access-control/enums/user-role.enum';
import { IsNull } from 'typeorm';

const FULL_ACCESS = { read: true, create: true, update: true, delete: true, approve: true, disburse: true, reject: true, export: true };
const READ_ONLY   = { read: true, create: false, update: false, delete: false };
const READ_WRITE  = { read: true, create: true, update: true, delete: false };
const NO_ACCESS   = { read: false, create: false, update: false, delete: false };

export async function seedSystemRoles() {
  const repo = AppDataSource.getRepository(RoleEntity);

  const roles: Partial<RoleEntity>[] = [
    {
      role: UserRole.SUPER_ADMIN,
      name: 'Super Administrator',
      description: 'Platform owner with full access to all modules across all banks.',
      bankId: null,
      isSystemRole: true,
      isActive: true,
      permissions: {
        banks:            FULL_ACCESS,
        branches:         FULL_ACCESS,
        customers:        FULL_ACCESS,
        loans:            FULL_ACCESS,
        'loan-products':  FULL_ACCESS,
        users:            FULL_ACCESS,
        roles:            FULL_ACCESS,
        geography:        FULL_ACCESS,
        currencies:       FULL_ACCESS,
        'master-data':    FULL_ACCESS,
        accounting:       FULL_ACCESS,
        audit:            FULL_ACCESS,
        'global-settings': FULL_ACCESS,
        reports:          FULL_ACCESS,
        dashboard:        READ_ONLY,
      },
    },
    {
      role: UserRole.BANK_ADMIN,
      name: 'Bank Administrator',
      description: 'Manages all operations within their assigned bank and all its branches.',
      bankId: null,
      isSystemRole: true,
      isActive: true,
      permissions: {
        banks:            { read: true,  create: false, update: true,  delete: false },
        branches:         { read: true,  create: true,  update: true,  delete: false },
        customers:        { read: true,  create: true,  update: true,  delete: false, export: true },
        loans:            { read: true,  create: true,  update: true,  approve: true, disburse: true, reject: true, delete: false },
        'loan-products':  { read: true,  create: true,  update: true,  delete: false },
        users:            { read: true,  create: true,  update: true,  delete: false },
        roles:            { read: true,  create: true,  update: true,  delete: false },
        geography:        READ_ONLY,
        currencies:       READ_ONLY,
        'master-data':    READ_ONLY,
        accounting:       { read: true,  create: false, update: false, delete: false },
        audit:            { read: true,  create: false, update: false, delete: false },
        'global-settings': NO_ACCESS,
        reports:          { read: true,  export: true },
        dashboard:        READ_ONLY,
      },
    },
    {
      role: UserRole.BRANCH_MANAGER,
      name: 'Branch Manager',
      description: 'Manages operations within their assigned branch including approvals.',
      bankId: null,
      isSystemRole: true,
      isActive: true,
      permissions: {
        banks:            READ_ONLY,
        branches:         { read: true,  create: false, update: true,  delete: false },
        customers:        { read: true,  create: true,  update: true,  delete: false, export: true },
        loans:            { read: true,  create: true,  update: true,  approve: true, disburse: true, reject: true, delete: false },
        'loan-products':  READ_ONLY,
        users:            { read: true,  create: true,  update: true,  delete: false },
        roles:            READ_ONLY,
        geography:        READ_ONLY,
        currencies:       READ_ONLY,
        'master-data':    READ_ONLY,
        accounting:       READ_ONLY,
        audit:            READ_ONLY,
        'global-settings': NO_ACCESS,
        reports:          { read: true,  export: false },
        dashboard:        READ_ONLY,
      },
    },
    {
      role: UserRole.STAFF,
      name: 'Branch Staff',
      description: 'Handles day-to-day branch operations (data entry, customer service).',
      bankId: null,
      isSystemRole: true,
      isActive: true,
      permissions: {
        banks:            READ_ONLY,
        branches:         READ_ONLY,
        customers:        READ_WRITE,
        loans:            { read: true,  create: true,  update: true,  approve: false, disburse: false, reject: false, delete: false },
        'loan-products':  READ_ONLY,
        users:            READ_ONLY,
        roles:            READ_ONLY,
        geography:        READ_ONLY,
        currencies:       READ_ONLY,
        'master-data':    READ_ONLY,
        accounting:       READ_ONLY,
        audit:            NO_ACCESS,
        'global-settings': NO_ACCESS,
        reports:          NO_ACCESS,
        dashboard:        READ_ONLY,
      },
    },
    {
      role: UserRole.CUSTOMER,
      name: 'Customer',
      description: 'End user with access to their own accounts and loan applications.',
      bankId: null,
      isSystemRole: true,
      isActive: true,
      permissions: {
        banks:            NO_ACCESS,
        branches:         READ_ONLY,
        customers:        { read: true, create: false, update: true, delete: false },
        loans:            { read: true, create: true,  update: false, approve: false, disburse: false, reject: false, delete: false },
        'loan-products':  READ_ONLY,
        users:            NO_ACCESS,
        roles:            NO_ACCESS,
        geography:        READ_ONLY,
        currencies:       READ_ONLY,
        'master-data':    READ_ONLY,
        accounting:       { read: true, create: false, update: false, delete: false },
        audit:            NO_ACCESS,
        'global-settings': NO_ACCESS,
        reports:          NO_ACCESS,
        dashboard:        READ_ONLY,
      },
    },
  ];

  for (const roleData of roles) {
    const exists = await repo.findOne({
      where: { role: roleData.role!, bankId: IsNull() as any },
    });
    if (!exists) {
      await repo.save(repo.create(roleData));
    }
  }

  console.log(`✅ System roles seeded (${roles.length} entries)`);
}
