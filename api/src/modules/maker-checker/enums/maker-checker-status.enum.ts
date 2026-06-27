// --- THE MAKER/CHECKER STATUS ENUM ---
// This enum defines the strict mathematical stages of our operational
// integrity workflow, ensuring clean and auditable data states.
// Principle: Clean Core (Strict Typing), Auditable Workflow.
export enum MakerCheckerStatus {
  DRAFT = 'DRAFT', // Maker is working on the request.
  SUBMITTED = 'SUBMITTED', // Maker has finalized and submitted for checking.
  PENDING_CHECKER = 'PENDING_CHECKER', // Explicitly waiting for a Checker's action.
  APPROVED = 'APPROVED', // Checker has authorized the request.
  REJECTED = 'REJECTED', // Checker has declined the request.
  DISBURSED = 'DISBURSED', // Special final state for loans, post-disbursement.
}