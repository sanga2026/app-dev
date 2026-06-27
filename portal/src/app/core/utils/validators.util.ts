export class AppValidators {
  /* =========================================================================
   * 1. CORE IDENTITY REGEX (Existing)
   * ========================================================================= */
  // 📧 Email: Standard RFC 5322 compliance
  static readonly EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  // 🔐 Password: 1 Upper, 1 Lower, 1 Number, 1 Special, Min 8 chars (Increased from 6 for Banking)
  static readonly PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,25}$/;
  
  // 📱 Mobile: Exactly 10 digits
  static readonly MOBILE_REGEX = /^[0-9]{10}$/;

  // 🚀 Name Patterns: Optimized for Banking (no weird symbols, handles compound names)
  static readonly FIRST_NAME_REGEX = /^[a-zA-Z][a-zA-Z\s\-']{1,49}$/; 
  static readonly LAST_NAME_REGEX = /^[a-zA-Z][a-zA-Z\s\-']{0,49}$/;
  static readonly USERNAME_REGEX = /^[a-zA-Z]{2}[0-9]{8}$/;

  /* =========================================================================
   * 2. COMPLIANCE & BANKING REGEX (New)
   * ========================================================================= */
  // 🏦 IFSC Prefix: Exactly 4 uppercase letters
  static readonly IFSC_PREFIX_REGEX = /^[A-Z]{4}$/i;

  // 🏛️ Tax ID (GSTIN/PAN Format): Exactly 15 alphanumeric characters
  static readonly TAX_ID_REGEX = /^[A-Z0-9]{15}$/i;

  // 📍 Indian Postal Code: Exactly 6 digits
  static readonly POSTAL_CODE_REGEX = /^[0-9]{6}$/;

  // 🌐 Corporate Website URL
  static readonly URL_REGEX = /^((https?:\/\/)?(www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(\/[a-zA-Z0-9.-]*)*\/?$/;

  public static readonly CIN_REGEX = /^[LUu][0-9]{5}[A-Za-z]{2}[0-9]{4}[A-Za-z]{3}[0-9]{6}$/;

  /* =========================================================================
   * 3. BRANCH SPECIFIC REGEX (New)
   * ========================================================================= */
  // 🏦 Full IFSC Code: 4 Letters, a zero '0', and 6 Alphanumeric characters
  static readonly FULL_IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/i;

  // 🏢 Branch Code: Alphanumeric, exactly 1 to 10 characters
  static readonly BRANCH_CODE_REGEX = /^[A-Z0-9]{1,10}$/i;

  // ⏰ Time Format: 24-hour HH:mm
  static readonly TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

  // Add the helper methods at the bottom of the class:
  static isValidFullIfsc(ifsc: string): boolean {
    return !!ifsc && this.FULL_IFSC_REGEX.test(ifsc);
  }
  static isValidBranchCode(code: string): boolean {
    return !!code && this.BRANCH_CODE_REGEX.test(code);
  }
  
  /* =========================================================================
   * VALIDATION METHODS
   * ========================================================================= */

  static isValidEmail(email: string): boolean {
    return !!email && this.EMAIL_REGEX.test(email);
  }

  static isStrongPassword(password: string): boolean {
    return !!password && this.PASSWORD_REGEX.test(password);
  }

  static isValidMobile(mobile: string): boolean {
    return !!mobile && this.MOBILE_REGEX.test(mobile);
  }

  static isValidFirstName(name: string): boolean {
    if (!name) return false;
    const trimmed = name.trim();
    // Banking Rule: Minimum 2 characters for a first name
    return trimmed.length >= 2 && this.FIRST_NAME_REGEX.test(trimmed);
  }

  static isValidLastName(name: string): boolean {
    if (!name) return false;
    const trimmed = name.trim();
    // Last name can be a single character in some cultures (e.g., initials)
    return trimmed.length >= 1 && this.LAST_NAME_REGEX.test(trimmed);
  }

  static isValidUsername(username: string): boolean {
    return !!username && this.USERNAME_REGEX.test(username);
  }

  static isValidIfscPrefix(prefix: string): boolean {
    return !!prefix && this.IFSC_PREFIX_REGEX.test(prefix.toUpperCase());
  }

  static isValidTaxId(taxId: string): boolean {
    return !!taxId && this.TAX_ID_REGEX.test(taxId);
  }

  static isValidPostalCode(postalCode: string): boolean {
    return !!postalCode && this.POSTAL_CODE_REGEX.test(postalCode);
  }

  static isValidUrl(url: string): boolean {
    // URL is often optional in forms, so if it's empty, we might want to return true
    // depending on context. But for strict format checking:
    if (!url) return false; 
    return this.URL_REGEX.test(url);
  }

  static isValidRegistrationNumber(CIN: string): boolean {
    // URL is often optional in forms, so if it's empty, we might want to return true
    // depending on context. But for strict format checking:
    if (!CIN) return false; 
    return this.CIN_REGEX.test(CIN);
  }

  
}