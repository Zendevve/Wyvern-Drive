/**
 * Render a UTC RFC3339Nano timestamp readably as "YYYY-MM-DD HH:MM:SS UTC".
 * Unparseable input is shown verbatim rather than hidden.
 */
export function formatTimestamp(rfc3339nano: string): string {
  const millis = Date.parse(rfc3339nano);
  if (Number.isNaN(millis)) return rfc3339nano;
  const iso = new Date(millis).toISOString();
  return iso.slice(0, 19).replace("T", " ") + " UTC";
}
