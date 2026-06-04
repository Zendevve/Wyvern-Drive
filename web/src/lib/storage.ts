export const JWT_KEY = 'wyvern.jwt';

export function readJwt(): string | null {
  try {
    return localStorage.getItem(JWT_KEY);
  } catch {
    return null;
  }
}

export function writeJwt(jwt: string): void {
  try {
    localStorage.setItem(JWT_KEY, jwt);
  } catch {
    // ignore quota / privacy mode failures
  }
}

export function clearJwt(): void {
  try {
    localStorage.removeItem(JWT_KEY);
  } catch {
    // ignore
  }
}
