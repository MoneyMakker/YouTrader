export type AuthProvider = "apple" | "google" | "email";

export type AuthScreenCopy = {
  headline: string;
  subtitle: string;
  apple: string;
  google: string;
  email: string;
  secureNote: string;
  termsPrefix: string;
  termsLabel: string;
  termsAnd: string;
  privacyLabel: string;
  termsSuffix: string;
  cancel: string;
};

export type EmailAuthModalCopy = {
  signInTitle: string;
  signUpTitle: string;
  forgotTitle: string;
  checkEmailTitle: string;
  checkEmailBody: string;
  emailPlaceholder: string;
  passwordPlaceholder: string;
  confirmPasswordPlaceholder: string;
  signIn: string;
  createAccount: string;
  sendReset: string;
  createAccountLink: string;
  forgotPassword: string;
  backToSignIn: string;
  cancel: string;
};
