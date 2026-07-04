#!/usr/bin/env npx tsx
import { parseAuthCallbackParams } from "../src/auth/authUrlParse";

const token = parseAuthCallbackParams("youtrader://auth?token_hash=abc123xyz&type=signup").merged.token_hash;
if (token !== "abc123xyz") {
  throw new Error(`auth callback params redacted or broken: got ${token}`);
}
console.log("[YouTrader:auth-url-parse-qa] passed");
