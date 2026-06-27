// src/app/core/utils/security.util.ts

export class SecurityUtils {
  /**
   * Generates a cryptographically secure password meeting banking standards.
   * Standard: Min 8 chars, 1 Upper, 1 Lower, 1 Number, 1 Special.
   * @param length The total length of the desired password (default 12)
   * @returns A secure string
   */
  static generateSecurePassword(length: number = 12): string {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const nums = '0123456789';
    const specials = '@$!%*?&';
    const all = upper + lower + nums + specials;

    // Use Web Crypto API for secure random values
    const getSecureChar = (charset: string) => {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      return charset[array[0] % charset.length];
    };

    let password = '';
    // Guarantee minimum requirements
    password += getSecureChar(upper);
    password += getSecureChar(lower);
    password += getSecureChar(nums);
    password += getSecureChar(specials);

    // Fill the rest
    for (let i = 4; i < length; i++) {
      password += getSecureChar(all);
    }

    // Fisher-Yates Shuffle for security
    const passArr = password.split('');
    for (let i = passArr.length - 1; i > 0; i--) {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      const j = array[0] % (i + 1);
      [passArr[i], passArr[j]] = [passArr[j], passArr[i]];
    }

    return passArr.join('');
  }
}