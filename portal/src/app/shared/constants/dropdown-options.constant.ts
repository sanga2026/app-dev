// Non-geographic enums — these are code-driven constants, NOT master data.
// Geography (countries, states, towns, villages) is loaded from the API via GeographyService.
// Document types are loaded from the API via MasterDataService.

export const DROPDOWN_OPTIONS = {

  // Phone dialing codes — kept here as they rarely change
  COUNTRY_CODES: [
    { label: '+91 (India)',   value: '+91'  },
    { label: '+1 (US/CA)',    value: '+1'   },
    { label: '+44 (UK)',      value: '+44'  },
    { label: '+971 (UAE)',    value: '+971' },
    { label: '+65 (SG)',      value: '+65'  },
    { label: '+61 (AU)',      value: '+61'  },
    { label: '+81 (JP)',      value: '+81'  },
    { label: '+86 (CN)',      value: '+86'  },
    { label: '+27 (ZA)',      value: '+27'  },
  ],

  BRANCH_TYPES: [
    { label: 'DROPDOWN_VALUES.BRANCH_TYPES.RETAIL_BRANCH',    value: 'RETAIL_BRANCH'    },
    { label: 'DROPDOWN_VALUES.BRANCH_TYPES.CORPORATE_BRANCH', value: 'CORPORATE_BRANCH' },
    { label: 'DROPDOWN_VALUES.BRANCH_TYPES.SERVICE_CENTER',   value: 'SERVICE_CENTER'   },
    { label: 'DROPDOWN_VALUES.BRANCH_TYPES.REGIONAL_OFFICE',  value: 'REGIONAL_OFFICE'  },
    { label: 'DROPDOWN_VALUES.BRANCH_TYPES.ZONAL_OFFICE',     value: 'ZONAL_OFFICE'     },
    { label: 'DROPDOWN_VALUES.BRANCH_TYPES.HEAD_OFFICE',      value: 'HEAD_OFFICE'      },
  ],

  TIERS: [
    { label: 'DROPDOWN_VALUES.TIERS.METRO',      value: 'METRO'      },
    { label: 'DROPDOWN_VALUES.TIERS.URBAN',      value: 'URBAN'      },
    { label: 'DROPDOWN_VALUES.TIERS.SEMI_URBAN', value: 'SEMI-URBAN' },
    { label: 'DROPDOWN_VALUES.TIERS.RURAL',      value: 'RURAL'      },
  ],

  TITLES: [
    { label: 'Mr.',   value: 'Mr.'   },
    { label: 'Mrs.',  value: 'Mrs.'  },
    { label: 'Ms.',   value: 'Ms.'   },
    { label: 'Shri',  value: 'Shri'  },
    { label: 'Smt.',  value: 'Smt.'  },
    { label: 'Kum.',  value: 'Kum.'  },
    { label: 'Dr.',   value: 'Dr.'   },
  ],

  GENDERS: [
    { label: 'DROPDOWN_VALUES.GENDERS.MALE',   value: 'MALE'   },
    { label: 'DROPDOWN_VALUES.GENDERS.FEMALE', value: 'FEMALE' },
    { label: 'DROPDOWN_VALUES.GENDERS.OTHER',  value: 'OTHER'  },
  ],

  MARITAL_STATUSES: [
    { label: 'DROPDOWN_VALUES.MARITAL.SINGLE',   value: 'SINGLE'   },
    { label: 'DROPDOWN_VALUES.MARITAL.MARRIED',  value: 'MARRIED'  },
    { label: 'DROPDOWN_VALUES.MARITAL.DIVORCED', value: 'DIVORCED' },
    { label: 'DROPDOWN_VALUES.MARITAL.WIDOWED',  value: 'WIDOWED'  },
  ],

  CUSTOMER_CATEGORIES: [
    { label: 'DROPDOWN_VALUES.CATEGORIES.PUBLIC',         value: 'PUBLIC'         },
    { label: 'DROPDOWN_VALUES.CATEGORIES.STAFF',          value: 'STAFF'          },
    { label: 'DROPDOWN_VALUES.CATEGORIES.SENIOR_CITIZEN', value: 'SENIOR_CITIZEN' },
    { label: 'DROPDOWN_VALUES.CATEGORIES.CORPORATE',      value: 'CORPORATE'      },
  ],

  KYC_STATUSES: [
    { label: 'DROPDOWN_VALUES.KYC.PENDING',  value: 'PENDING'  },
    { label: 'DROPDOWN_VALUES.KYC.VERIFIED', value: 'VERIFIED' },
    { label: 'DROPDOWN_VALUES.KYC.REJECTED', value: 'REJECTED' },
    { label: 'DROPDOWN_VALUES.KYC.EXPIRED',  value: 'EXPIRED'  },
  ],

  LOAN_TYPES: [
    { label: 'DROPDOWN_VALUES.LOAN_TYPES.PERSONAL',    value: 'PERSONAL'    },
    { label: 'DROPDOWN_VALUES.LOAN_TYPES.HOME',        value: 'HOME'        },
    { label: 'DROPDOWN_VALUES.LOAN_TYPES.VEHICLE',     value: 'VEHICLE'     },
    { label: 'DROPDOWN_VALUES.LOAN_TYPES.EDUCATION',   value: 'EDUCATION'   },
    { label: 'DROPDOWN_VALUES.LOAN_TYPES.BUSINESS',    value: 'BUSINESS'    },
    { label: 'DROPDOWN_VALUES.LOAN_TYPES.AGRICULTURE', value: 'AGRICULTURE' },
    { label: 'DROPDOWN_VALUES.LOAN_TYPES.GOLD',        value: 'GOLD'        },
  ],

  RISK_CATEGORIES: [
    { label: 'DROPDOWN_VALUES.RISK.LOW',    value: 'LOW'    },
    { label: 'DROPDOWN_VALUES.RISK.MEDIUM', value: 'MEDIUM' },
    { label: 'DROPDOWN_VALUES.RISK.HIGH',   value: 'HIGH'   },
  ],

  TIMEZONES: [
    { label: 'Asia/Kolkata (IST)',           value: 'Asia/Kolkata'          },
    { label: 'America/New_York (EST)',        value: 'America/New_York'      },
    { label: 'America/Los_Angeles (PST)',     value: 'America/Los_Angeles'   },
    { label: 'Europe/London (GMT)',           value: 'Europe/London'         },
    { label: 'Europe/Paris (CET)',            value: 'Europe/Paris'          },
    { label: 'Asia/Dubai (GST)',              value: 'Asia/Dubai'            },
    { label: 'Asia/Singapore (SGT)',          value: 'Asia/Singapore'        },
    { label: 'Australia/Sydney (AEST)',       value: 'Australia/Sydney'      },
    { label: 'Pacific/Auckland (NZST)',       value: 'Pacific/Auckland'      },
    { label: 'Asia/Tokyo (JST)',              value: 'Asia/Tokyo'            },
  ],
};
