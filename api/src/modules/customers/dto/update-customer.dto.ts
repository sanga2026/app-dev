// src/modules/customers/dto/update-customer.dto.ts

import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateCustomerDto } from './create-customer.dto';

// 🚀 Prevent users from updating core identity and tenancy fields via generic update
export class UpdateCustomerDto extends PartialType(
  OmitType(CreateCustomerDto, [
    'bankId', 
    'branchId', 
    'governmentId', 
    'governmentIdType'
  ] as const)
) {}