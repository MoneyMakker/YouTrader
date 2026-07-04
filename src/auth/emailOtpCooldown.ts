export const OTP_RESEND_COOLDOWN_SEC = 30;

export function formatResendCountdown(secondsLeft: number): string {
  return `Resend code (${secondsLeft}s)`;
}

export function canResendOtp(lastSentAtMs: number | null, nowMs = Date.now()): boolean {
  if (!lastSentAtMs) return true;
  return nowMs - lastSentAtMs >= OTP_RESEND_COOLDOWN_SEC * 1000;
}

export function resendCooldownSecondsLeft(lastSentAtMs: number | null, nowMs = Date.now()): number {
  if (!lastSentAtMs) return 0;
  const elapsed = Math.floor((nowMs - lastSentAtMs) / 1000);
  return Math.max(0, OTP_RESEND_COOLDOWN_SEC - elapsed);
}
