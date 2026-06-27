// src/modules/banks/dto/update-bank.dto.ts

import { PartialType } from '@nestjs/swagger';
import { CreateBankDto } from './create-bank.dto';

export class UpdateBankDto extends PartialType(CreateBankDto) {
  // You don't need to add anything else here! 
  // PartialType automatically clones CreateBankDto and applies @IsOptional() to everything.
}