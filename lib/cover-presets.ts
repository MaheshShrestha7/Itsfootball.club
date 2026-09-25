// Stock football photos offered as one-click team / tournament covers
const unsplash = (id: string, w: number) => `https://images.unsplash.com/photo-${id}?w=${w}&auto=format&fit=crop&q=80`;

const PHOTOS: { label: string; id: string }[] = [
  { label: 'Stadium', id: '1574629810360-7efbbe195018' },
  { label: 'Pitch', id: '1517466787929-bc90951d0974' },
  { label: 'Derby Night', id: '1522778119026-d647f0596c20' },
  { label: 'Tunnel', id: '1577223625816-7546f13df25d' },
  { label: 'Night Match', id: '1431324155629-1a6deb1dec8d' },
  { label: 'Floodlit Pitch', id: '1487466365202-1afdb86c764e' },
  { label: 'Touchline', id: '1459865264687-595d652de67e' },
  { label: 'Match Ball', id: '1486286701208-1d58e9338013' },
  { label: 'Classic Ball', id: '1575361204480-aadea25e6e68' },
  { label: 'Champions Ball', id: '1614632537190-23e4146777db' },
  { label: 'Trophy', id: '1518091043644-c1d4457512c6' },
  { label: 'Boots & Ball', id: '1511886929837-354d827aae26' },
  { label: 'Corner', id: '1529900748604-07564a03e7a6' },
  { label: 'Kick-Off', id: '1516567727245-ad8c68f3ec93' },
  { label: 'Training Balls', id: '1551958219-acbc608c6377' },
  { label: 'Training Game', id: '1543326727-cf6c39e8f84c' },
  { label: 'Tackle', id: '1553778263-73a83bab9b0c' },
  { label: 'Volley', id: '1560272564-c83b66b1ad12' },
  { label: 'Blue Sky', id: '1570498839593-e565b39455fc' },
  { label: 'Captain', id: '1579952363873-27f3bade9f55' },
  { label: 'Park Kickabout', id: '1600679472829-3044539ce8ed' },
  { label: 'Futsal', id: '1606925797300-0b35e9d1794e' },
];

export const COVER_PRESETS = PHOTOS.map(p => ({ label: p.label, url: unsplash(p.id, 1600), thumb: unsplash(p.id, 240) }));

/** Same photo regardless of the size / quality params in the URL */
export const sameCover = (a?: string, b?: string) => !!a && !!b && a.split('?')[0] === b.split('?')[0];
