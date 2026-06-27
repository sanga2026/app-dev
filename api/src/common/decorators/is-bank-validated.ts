// src/common/decorators/is-bank-validated.ts

import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';
// 🚀 Adjust this import path if your AppValidators is located elsewhere
import { AppValidators } from '../utils/app-validators'; 

/* =========================================================================
 * 1. CORE IDENTITY DECORATORS
 * ========================================================================= */

export function IsBankEmail(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: any) => typeof value === 'string' && AppValidators.EMAIL_REGEX.test(value),
        defaultMessage: () => 'Invalid email address format.',
      },
    });
  };
}

export function IsBankIdentifier(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: any) => {
          if (typeof value !== 'string') return false;
          
          // 🛡️ Hacker-Free logic: Check if it's a valid email OR numeric username
          const isEmail = AppValidators.EMAIL_REGEX.test(value);
          const isNumericUsername = AppValidators.USERNAME_REGEX.test(value);
          
          return isEmail || isNumericUsername;
        },
        defaultMessage: () => 'Identifier must be a valid email or a system ID.',
      },
    });
  };
}

export function IsBankPassword(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: any) => typeof value === 'string' && AppValidators.PASSWORD_REGEX.test(value),
        defaultMessage: () => 'Password must be 8-25 chars with uppercase, lowercase, number, and special character.',
      },
    });
  };
}

export function IsBankName(type: 'first' | 'middle' | 'last', validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: any) => {
          if (typeof value !== 'string') return false;
          
          let regex: RegExp;
          if (type === 'first') {
            regex = AppValidators.FIRST_NAME_REGEX;
          } else if (type === 'middle') {
            // Make sure you define MIDDLE_NAME_REGEX in your AppValidators file!
            // It is usually the same as FIRST_NAME_REGEX but might allow fewer minimum characters.
            regex = AppValidators.MIDDLE_NAME_REGEX; 
          } else {
            regex = AppValidators.LAST_NAME_REGEX;
          }
          
          return regex.test(value.trim());
        },
        defaultMessage: () => {
          if (type === 'first') {
            return 'First name must be between 3 and 100 characters long and contain only letters.';
          }
          if (type === 'middle') {
            return 'Middle name must contain only letters and valid name characters.';
          }
          return 'Last name must contain only letters and valid name characters.';
        },
      },
    });
  };
}

export function IsBankMobile(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: any) => {
          if (typeof value !== 'string') return false;
          
          // 1. 🛡️ Hacker-Free: Strip all non-numeric characters (removes the '+', spaces, dashes)
          const cleanValue = value.replace(/\D/g, ''); 
          
          // 2. 🌍 Define the country codes your platform actively supports (without the '+')
          const supportedCodes = ['91', '1', '44', '971'];
          
          let finalValue = cleanValue;

          // 3. 🔍 Dynamically check for and strip the country code
          for (const code of supportedCodes) {
            // If the string starts with the country code AND the remaining length is exactly 10
            if (cleanValue.startsWith(code) && cleanValue.length === code.length + 10) {
              finalValue = cleanValue.substring(code.length);
              break; // Stop searching once we find a match
            }
          }

          // 4. ✅ Validate the pure 10-digit base number against your core regex
          return AppValidators.MOBILE_REGEX.test(finalValue);
        },
        defaultMessage: () => 'Mobile number must be a valid 10-digit number with a supported country code.',
      },
    });
  };
}

/* =========================================================================
 * 2. REGULATORY & COMPLIANCE DECORATORS (NEW)
 * ========================================================================= */

export function IsBankIfscPrefix(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: any) => {
          if (typeof value !== 'string') return false;
          // 🛡️ Forgive lowercase inputs but enforce the 4-letter rule
          return AppValidators.IFSC_PREFIX_REGEX.test(value.trim());
        },
        defaultMessage: () => 'IFSC Prefix must be exactly 4 letters (e.g., SBIN).',
      },
    });
  };
}

export function IsBankTaxId(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: any) => {
          if (typeof value !== 'string') return false;
          return AppValidators.TAX_ID_REGEX.test(value.trim());
        },
        defaultMessage: () => 'Tax ID (GSTIN/PAN) must be exactly 15 alphanumeric characters.',
      },
    });
  };
}

export function IsBankPostalCode(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: any) => {
          if (typeof value !== 'string') return false;
          // 🛡️ Hacker-Free: Strip spaces in case user types "400 013" instead of "400013"
          const cleanValue = value.replace(/\s/g, '');
          return AppValidators.POSTAL_CODE_REGEX.test(cleanValue);
        },
        defaultMessage: () => 'Postal Code (PIN) must be exactly 6 digits.',
      },
    });
  };
}


export function IsBankRegistrationNumber(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: any) => {
          if (typeof value !== 'string') return false;

          // 🛡️ Hacker-Free: Trim whitespace and force check the length first
          const cleanValue = value.trim();
          
          if (cleanValue.length !== 21) return false;

          // 🚀 FIX: You must 'return' the result of the test!
          return AppValidators.CIN_REGEX.test(cleanValue);
        },
        defaultMessage: () => 
          'Registration Number must be a valid 21-character CIN (e.g., U74140KA2026PLC123456).',
      },
    });
  };
}