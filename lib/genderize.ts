type GenderResult = 'female' | 'male' | 'unknown';

const cache = new Map<string, GenderResult>();

export async function getAuthorGender(firstName: string): Promise<GenderResult> {
  const key = firstName.toLowerCase().trim();
  if (cache.has(key)) return cache.get(key)!;

  try {
    const res = await fetch(`https://api.genderize.io/?name=${encodeURIComponent(key)}`);
    if (!res.ok) return 'unknown';
    const data = await res.json();

    // probability threshold: only trust if >= 0.75
    const gender: GenderResult =
      data.probability >= 0.75
        ? data.gender === 'female'
          ? 'female'
          : 'male'
        : 'unknown';

    cache.set(key, gender);
    return gender;
  } catch {
    return 'unknown';
  }
}
