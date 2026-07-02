export interface Country {
  code: string;
  name: string;
  dialCode?: string;
  currencyCode?: string;
  flag?: string;
  isActive: boolean;
}

export interface State {
  id: string;
  countryCode: string;
  name: string;
  code?: string;
  isActive: boolean;
}

export interface Town {
  id: string;
  stateId: string;
  name: string;
  pinCode?: string;
  isActive: boolean;
}

export interface Village {
  id: string;
  townId: string;
  name: string;
  pinCode?: string;
  isActive: boolean;
}
