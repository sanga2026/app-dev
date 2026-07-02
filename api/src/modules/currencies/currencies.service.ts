import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrencyEntity } from './entities/currency.entity';
import { CreateCurrencyDto, UpdateCurrencyDto } from './dto/currency.dto';
import { UserEntity } from '../users/entities/user.entity';
import { UserRole } from '../access-control/enums/user-role.enum';

@Injectable()
export class CurrenciesService {
  constructor(
    @InjectRepository(CurrencyEntity)
    private readonly repo: Repository<CurrencyEntity>,
  ) {}

  findAll(activeOnly = false): Promise<CurrencyEntity[]> {
    return this.repo.find({
      where: activeOnly ? { isActive: true } : {},
      order: { name: 'ASC' },
    });
  }

  async findOne(code: string): Promise<CurrencyEntity> {
    const currency = await this.repo.findOne({ where: { code: code.toUpperCase() } });
    if (!currency) throw new NotFoundException(`Currency '${code}' not found.`);
    return currency;
  }

  async create(dto: CreateCurrencyDto, user: UserEntity): Promise<CurrencyEntity> {
    this.ensureSuperAdmin(user);
    const existing = await this.repo.findOne({ where: { code: dto.code.toUpperCase() } });
    if (existing) throw new ConflictException(`Currency '${dto.code}' already exists.`);
    const currency = this.repo.create({ ...dto, code: dto.code.toUpperCase() });
    return this.repo.save(currency);
  }

  async update(code: string, dto: UpdateCurrencyDto, user: UserEntity): Promise<CurrencyEntity> {
    this.ensureSuperAdmin(user);
    const currency = await this.findOne(code);
    Object.assign(currency, dto);
    return this.repo.save(currency);
  }

  async toggleStatus(code: string, user: UserEntity): Promise<CurrencyEntity> {
    this.ensureSuperAdmin(user);
    const currency = await this.findOne(code);
    currency.isActive = !currency.isActive;
    return this.repo.save(currency);
  }

  async remove(code: string, user: UserEntity): Promise<{ message: string }> {
    this.ensureSuperAdmin(user);
    const currency = await this.findOne(code);
    await this.repo.remove(currency);
    return { message: `Currency '${code}' deleted.` };
  }

  private ensureSuperAdmin(user: UserEntity): void {
    if (user.roleType !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admins can manage currencies.');
    }
  }
}
