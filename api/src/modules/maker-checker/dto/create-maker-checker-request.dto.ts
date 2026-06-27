// --- 1. EXTERNAL IMPORTS ---
// We import standard class-validator decorators to enforce strict input validation.
// Principle: Security-First (Input filtering), Clean Core (Immutable typing).
import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

// --- 2. THE CREATE MAKER/CHECKER REQUEST DTO ---
// This class defines the strict input blueprint for initiating ANY dual-authorization workflow,
// embedding robust multi-tenancy context and the operational integrity audit context from the start.
export class CreateMakerCheckerRequestDto {
  // A. Operational Context (Required for every operational draft).
  @IsString()
  @IsNotEmpty()
  entityName: string; // The target entity type (e.g., 'LoanApplicationEntity').

  @IsString()
  @IsNotEmpty()
  @IsUUID(4) // Future Proofing: Enforce UUID structure for IDs (Performance Manifesto).
  makerId: string; // The verified user_id of the current clerk.

  @IsOptional() // Notes are optional (notes?).
  @IsString()
  notes?: string; 

  // B. Multi-Tenancy Context (CRITICAL for Row-Level Security).
  // These columns MUST be populated in the input, as RLS relies on them mathematically.
  @IsString()
  @IsNotEmpty()
  @IsUUID(4)
  bankId: string; // The tenant (Bank) identifier.

  @IsString()
  @IsNotEmpty()
  @IsUUID(4)
  branchId: string; // The operational (Branch) identifier.
}