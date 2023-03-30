export interface CreateCertificateResponse {
  id: string;
  type: string;
  common_name: string;
  additional_domains: string;
  created: string;
  expires: string;
  status: string;
  validation_type: any;
  validation_emails: any;
  replacement_for: string;
  validation: Validation;
}

export interface Validation {
  email_validation: EmailValidation;
  other_methods: OtherMethods;
}

export interface EmailValidation {
  [key: string]: string[];
}

export interface OtherMethods {
  [key: string]: OtherValidation;
}

export interface OtherValidation {
  file_validation_url_http: string;
  file_validation_url_https: string;
  file_validation_content: string[];
  cname_validation_p1: string;
  cname_validation_p2: string;
}
