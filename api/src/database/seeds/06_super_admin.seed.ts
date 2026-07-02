import { AppDataSource } from '../../config/data-source';
import { UserEntity } from '../../modules/users/entities/user.entity';
import { RoleEntity } from '../../modules/access-control/entities/role.entity';
import { UserRole } from '../../modules/access-control/enums/user-role.enum';
import { IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';

export async function seedSuperAdminUser() {
  const userRepo = AppDataSource.getRepository(UserEntity);
  const roleRepo = AppDataSource.getRepository(RoleEntity);

  const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@banking-os.com';

  const exists = await userRepo.findOne({ where: { email } });
  if (exists) {
    console.log('✅ Super Admin user already exists — skipping.');
    return;
  }

  const superAdminRole = await roleRepo.findOne({
    where: { role: UserRole.SUPER_ADMIN, bankId: IsNull() as any },
  });

  if (!superAdminRole) {
    console.warn('⚠️  System roles not found. Run system roles seed first.');
    return;
  }

  const password = process.env.SUPER_ADMIN_PASSWORD || 'Admin@12345';
  const hashedPassword = await bcrypt.hash(password, 12);

  const user = userRepo.create({
    firstName: 'Super',
    lastName: 'Admin',
    email,
    username: 'SA00000001',
    password: hashedPassword,
    roleType: UserRole.SUPER_ADMIN,
    roleId: superAdminRole.id,
    bankId: null,
    branchId: null,
    isActive: true,
    preferences: {},
  });

  // Bypass hash hook since we already hashed manually
  (user as any)._skipPasswordHash = true;
  await userRepo.save(user);

  console.log(`✅ Super Admin user seeded`);
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   ⚠️  Change this password immediately after first login!`);
}
