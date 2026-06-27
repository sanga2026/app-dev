// src/modules/banks/dto/onboard-bank.dto.ts

import { IsEnum } from 'class-validator';
import { CreateBankDto } from './create-bank.dto';

export enum SubscriptionPlan {
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
}

/**
 * 🏦 The Master Onboarding Payload
 * Inherits all standard Bank fields from CreateBankDto, 
 * and adds the SaaS Subscription Plan required for onboarding.
 */
export class OnboardBankDto extends CreateBankDto {
  
  @IsEnum(SubscriptionPlan, { message: 'Invalid Subscription Plan selected.' })
  subscriptionPlan: SubscriptionPlan;

}