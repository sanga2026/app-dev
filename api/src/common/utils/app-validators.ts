// src/common/utils/app-validators.ts

export class AppValidators {
  // 🔐 Strict Banking Rules
  // Exactly 2 letters (A-Z) followed by exactly 8 digits (0-9)
  static readonly USERNAME_REGEX = /^[a-zA-Z]{2}[0-9]{8}$/;
  static readonly EMAIL_REGEX =
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  static readonly MOBILE_REGEX = /^[0-9]{10}$/;

  // Password: 8-64 chars, 1 Upper, 1 Lower, 1 Number, 1 Special, Max 20 characters
  static readonly PASSWORD_REGEX =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,25}$/;

  // Names: No numbers, allow spaces/hyphens, 2-100 chars
  static readonly FIRST_NAME_REGEX = /^[a-zA-Z][a-zA-Z\s\-']{1,99}$/;
  static readonly MIDDLE_NAME_REGEX = /^[a-zA-Z][a-zA-Z\s\-']{0,99}$/;
  static readonly LAST_NAME_REGEX = /^[a-zA-Z][a-zA-Z\s\-']{0,99}$/;

  // Generic UUID/ID check for safety
  static readonly UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    /* =========================================================================
   * BANKING & COMPLIANCE REGEX
   * ========================================================================= */
  
  // 🏦 IFSC Prefix: Exactly 4 letters (Case-insensitive 'i' flag for better UX)
  static readonly IFSC_PREFIX_REGEX = /^[A-Z]{4}$/i;

  // 🏛️ Tax ID (GSTIN/PAN Format): Exactly 15 alphanumeric characters
  static readonly TAX_ID_REGEX = /^[A-Z0-9]{15}$/i;

  // 📍 Indian Postal Code: Exactly 6 digits, cannot start with 0
  static readonly POSTAL_CODE_REGEX = /^[1-9][0-9]{5}$/;

  // 🌐 Corporate Website URL
  static readonly URL_REGEX = /^((https?:\/\/)?(www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(\/[a-zA-Z0-9.-]*)*\/?$/;
  public static readonly CIN_REGEX = /^[LUu][0-9]{5}[A-Za-z]{2}[0-9]{4}[A-Za-z]{3}[0-9]{6}$/;
}
