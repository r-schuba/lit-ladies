export function buildGoogleCalendarUrl(options: {
  title: string;
  startDate: Date;
  durationHours?: number;
  location?: string;
  description?: string;
}): string {
  const { title, startDate, durationHours = 2, location, description } = options;

  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;

  const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${fmt(startDate)}/${fmt(endDate)}`,
    ...(location ? { location } : {}),
    ...(description ? { details: description } : {}),
  });

  return `https://calendar.google.com/calendar/render?${params}`;
}

export function buildIcsContent(options: {
  title: string;
  startDate: Date;
  durationHours?: number;
  location?: string;
  description?: string;
}): string {
  const { title, startDate, durationHours = 2, location, description } = options;

  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;

  const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);
  const now = fmt(new Date());

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lit Ladies Book Club//EN',
    'BEGIN:VEVENT',
    `UID:${now}-litladies@bookclub`,
    `DTSTAMP:${now}`,
    `DTSTART:${fmt(startDate)}`,
    `DTEND:${fmt(endDate)}`,
    `SUMMARY:${title}`,
    ...(location ? [`LOCATION:${location}`] : []),
    ...(description ? [`DESCRIPTION:${description}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
