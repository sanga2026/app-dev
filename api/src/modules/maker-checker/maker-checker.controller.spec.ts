import { Test, TestingModule } from '@nestjs/testing';
import { MakerCheckerController } from './maker-checker.controller';

describe('MakerCheckerController', () => {
  let controller: MakerCheckerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MakerCheckerController],
    }).compile();

    controller = module.get<MakerCheckerController>(MakerCheckerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
