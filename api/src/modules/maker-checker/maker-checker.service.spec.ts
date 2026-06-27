import { Test, TestingModule } from '@nestjs/testing';
import { MakerCheckerService } from './maker-checker.service';

describe('MakerCheckerService', () => {
  let service: MakerCheckerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MakerCheckerService],
    }).compile();

    service = module.get<MakerCheckerService>(MakerCheckerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
