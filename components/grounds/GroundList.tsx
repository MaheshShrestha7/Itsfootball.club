// A grid of ground cards (directory and suburb pages): name, suburb and the short facts
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { councilName, factTags, groundPath, type GroundRow } from '@/lib/grounds';

export default function GroundList({ grounds, showSuburb = true }: { grounds: GroundRow[]; showSuburb?: boolean }) {
  return (
    <ul className="tool-links" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))' }}>
      {grounds.map(g => (
        <li key={g.id} data-ground={[g.name, g.suburb, g.postcode, councilName(g)].filter(Boolean).join(' ').toLowerCase()}>
          <Link href={groundPath(g)} className="glass-panel tool-link tool-link-main">
            <strong>{g.name}</strong>
            {showSuburb && (
              <span style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
                <MapPin size={13} aria-hidden="true" /> {g.suburb} {g.state}
              </span>
            )}
            {factTags(g) && <span>{factTags(g)}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
