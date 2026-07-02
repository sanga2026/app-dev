import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CountryEntity } from './entities/country.entity';
import { StateEntity } from './entities/state.entity';
import { TownEntity } from './entities/town.entity';
import { VillageEntity } from './entities/village.entity';
import {
  CreateCountryDto, UpdateCountryDto,
  CreateStateDto, UpdateStateDto,
  CreateTownDto, UpdateTownDto,
  CreateVillageDto, UpdateVillageDto,
} from './dto/geography.dto';
import { UserEntity } from '../users/entities/user.entity';
import { UserRole } from '../access-control/enums/user-role.enum';

@Injectable()
export class GeographyService {
  constructor(
    @InjectRepository(CountryEntity) private readonly countryRepo: Repository<CountryEntity>,
    @InjectRepository(StateEntity)   private readonly stateRepo: Repository<StateEntity>,
    @InjectRepository(TownEntity)    private readonly townRepo: Repository<TownEntity>,
    @InjectRepository(VillageEntity) private readonly villageRepo: Repository<VillageEntity>,
  ) {}

  // ─── COUNTRIES ───────────────────────────────────────────────────────────────

  findAllCountries(activeOnly = false): Promise<CountryEntity[]> {
    return this.countryRepo.find({
      where: activeOnly ? { isActive: true } : {},
      order: { name: 'ASC' },
    });
  }

  async findCountry(code: string): Promise<CountryEntity> {
    const country = await this.countryRepo.findOne({ where: { code: code.toUpperCase() } });
    if (!country) throw new NotFoundException(`Country '${code}' not found.`);
    return country;
  }

  async createCountry(dto: CreateCountryDto, user: UserEntity): Promise<CountryEntity> {
    this.ensureSuperAdmin(user);
    const exists = await this.countryRepo.findOne({ where: { code: dto.code.toUpperCase() } });
    if (exists) throw new ConflictException(`Country '${dto.code}' already exists.`);
    return this.countryRepo.save(this.countryRepo.create({ ...dto, code: dto.code.toUpperCase() }));
  }

  async updateCountry(code: string, dto: UpdateCountryDto, user: UserEntity): Promise<CountryEntity> {
    this.ensureSuperAdmin(user);
    const country = await this.findCountry(code);
    Object.assign(country, dto);
    return this.countryRepo.save(country);
  }

  // ─── STATES ──────────────────────────────────────────────────────────────────

  async findStates(countryCode: string, activeOnly = false): Promise<StateEntity[]> {
    await this.findCountry(countryCode); // validates country exists
    return this.stateRepo.find({
      where: { countryCode: countryCode.toUpperCase(), ...(activeOnly ? { isActive: true } : {}) },
      order: { name: 'ASC' },
    });
  }

  async findState(id: string): Promise<StateEntity> {
    const state = await this.stateRepo.findOne({ where: { id } });
    if (!state) throw new NotFoundException(`State '${id}' not found.`);
    return state;
  }

  async createState(countryCode: string, dto: CreateStateDto, user: UserEntity): Promise<StateEntity> {
    this.ensureSuperAdmin(user);
    await this.findCountry(countryCode);
    return this.stateRepo.save(
      this.stateRepo.create({ ...dto, countryCode: countryCode.toUpperCase() }),
    );
  }

  async updateState(id: string, dto: UpdateStateDto, user: UserEntity): Promise<StateEntity> {
    this.ensureSuperAdmin(user);
    const state = await this.findState(id);
    Object.assign(state, dto);
    return this.stateRepo.save(state);
  }

  // ─── TOWNS ───────────────────────────────────────────────────────────────────

  async findTowns(stateId: string, activeOnly = false): Promise<TownEntity[]> {
    await this.findState(stateId);
    return this.townRepo.find({
      where: { stateId, ...(activeOnly ? { isActive: true } : {}) },
      order: { name: 'ASC' },
    });
  }

  async findTown(id: string): Promise<TownEntity> {
    const town = await this.townRepo.findOne({ where: { id } });
    if (!town) throw new NotFoundException(`Town '${id}' not found.`);
    return town;
  }

  async createTown(stateId: string, dto: CreateTownDto, user: UserEntity): Promise<TownEntity> {
    this.ensureSuperAdmin(user);
    await this.findState(stateId);
    return this.townRepo.save(this.townRepo.create({ ...dto, stateId }));
  }

  async updateTown(id: string, dto: UpdateTownDto, user: UserEntity): Promise<TownEntity> {
    this.ensureSuperAdmin(user);
    const town = await this.findTown(id);
    Object.assign(town, dto);
    return this.townRepo.save(town);
  }

  // ─── VILLAGES ────────────────────────────────────────────────────────────────

  async findVillages(townId: string, activeOnly = false): Promise<VillageEntity[]> {
    await this.findTown(townId);
    return this.villageRepo.find({
      where: { townId, ...(activeOnly ? { isActive: true } : {}) },
      order: { name: 'ASC' },
    });
  }

  async findVillage(id: string): Promise<VillageEntity> {
    const village = await this.villageRepo.findOne({ where: { id } });
    if (!village) throw new NotFoundException(`Village '${id}' not found.`);
    return village;
  }

  async createVillage(townId: string, dto: CreateVillageDto, user: UserEntity): Promise<VillageEntity> {
    this.ensureSuperAdmin(user);
    await this.findTown(townId);
    return this.villageRepo.save(this.villageRepo.create({ ...dto, townId }));
  }

  async updateVillage(id: string, dto: UpdateVillageDto, user: UserEntity): Promise<VillageEntity> {
    this.ensureSuperAdmin(user);
    const village = await this.findVillage(id);
    Object.assign(village, dto);
    return this.villageRepo.save(village);
  }

  private ensureSuperAdmin(user: UserEntity): void {
    if (user.roleType !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admins can manage geography master data.');
    }
  }

  async removeCountry(code: string, user: UserEntity) {
    this.ensureSuperAdmin(user);
    const country = await this.findCountry(code);
    await this.countryRepo.remove(country);
    return { message: `Country '${code}' deleted.` };
  }

  async removeState(id: string, user: UserEntity) {
    this.ensureSuperAdmin(user);
    const state = await this.findState(id);
    await this.stateRepo.remove(state);
    return { message: `State '${id}' deleted.` };
  }

  async removeTown(id: string, user: UserEntity) {
    this.ensureSuperAdmin(user);
    const town = await this.findTown(id);
    await this.townRepo.remove(town);
    return { message: `Town '${id}' deleted.` };
  }

  async removeVillage(id: string, user: UserEntity) {
    this.ensureSuperAdmin(user);
    const village = await this.findVillage(id);
    await this.villageRepo.remove(village);
    return { message: `Village '${id}' deleted.` };
  }
}
