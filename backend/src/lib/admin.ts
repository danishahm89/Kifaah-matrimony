// Admins are listed by phone number in the ADMIN_PHONES env var
// (comma separated, E.164, e.g. "+919990543267"). Read on every call so it
// can be changed with a restart and set per test.
export function adminPhones(): string[] {
  return (process.env.ADMIN_PHONES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAdminPhone(phone: string | null | undefined): boolean {
  return !!phone && adminPhones().includes(phone);
}
