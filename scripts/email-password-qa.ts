#!/usr/bin/env npx tsx
import { runEmailPasswordQaOrThrow } from "../src/auth/emailPassword.qa";

const results = runEmailPasswordQaOrThrow();
console.log(`[YouTrader:email-password-qa] ${results.length} scenarios passed`);
