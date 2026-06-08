// Practical email check: one @, no spaces, a dot in the domain. Mirrors the
// server-side regex in submit_claim so client + server agree.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}
