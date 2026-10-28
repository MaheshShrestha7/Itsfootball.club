// Plain words for a failed background save, for club admins rather than developers. The raw
// database text (e.g. "club_members: duplicate key value violates unique constraint ...") stays
// available behind "Details" for whoever is fixing it.

const RULES: Array<[RegExp, string]> = [
  [/failed to fetch|network|load failed|timed? ?out|could not reach/i, "We couldn't reach the server. Check your internet connection, then press Retry."],
  [/permission|row-level security|not allowed|42501|jwt|not authori[sz]ed/i, "Your role can't change some of these records. Ask the club Owner or a Club Admin."],
  [/duplicate key|already exists|unique constraint|23505/i, 'Something with the same name or number already exists. Change it and try again.'],
  [/violates foreign key|23503/i, 'Something this change depends on was removed. Reload the page and try again.'],
  [/too long|value too long|22001/i, 'One of the fields is too long. Shorten it and try again.'],
  [/not-null|null value|23502|check constraint|23514|invalid input/i, 'A required field is empty or not valid. Check the form and try again.'],
];

/** One plain sentence for the admin's "not saved" banner */
export function friendlySyncError(message: string | undefined): string {
  const raw = message || '';
  for (const [pattern, text] of RULES) if (pattern.test(raw)) return text;
  return 'Please press Retry. If it keeps happening, reload the page.';
}
