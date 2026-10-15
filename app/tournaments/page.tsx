import { redirect } from 'next/navigation';
import { MAKER_PATH } from '@/lib/public-tournaments';

// No directory of public tournaments yet: /tournaments goes to the maker
export default function TournamentsIndex() {
  redirect(MAKER_PATH);
}
