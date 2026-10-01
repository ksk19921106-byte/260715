export function loginEmail(englishName: string): string | null {
  const name = englishName.trim().toLowerCase();
  return /^[a-z][a-z0-9._-]{1,63}$/.test(name) ? `${name}@icbanq.com` : null;
}

export function mustChangePassword(metadata: Record<string, unknown> | undefined) {
  return metadata?.portal_password_initialized !== true || metadata?.portal_password_reset_required === true;
}

export function passwordProblem(current: string, next: string): string | null {
  if (!current) return "현재 비밀번호를 입력해주세요.";
  if (next.length < 12 || next.length > 128) return "새 비밀번호는 12~128자로 입력해주세요.";
  if (!/[A-Za-z]/.test(next) || !/[0-9]/.test(next)) return "새 비밀번호에 영문과 숫자를 포함해주세요.";
  if (current === next) return "현재 비밀번호와 다른 비밀번호를 입력해주세요.";
  return null;
}

export function safeAccountNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return "/";
  return value;
}
