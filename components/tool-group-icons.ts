// The icon and colour of each free tools group (lib/tool-pages.ts TOOL_GROUPS), shared by the /tools hub and the Free Tools menu
import { ClipboardList, Image as ImageIcon, Trophy, Wallet, type LucideIcon } from 'lucide-react';

export const TOOL_GROUP_ICONS: Record<string, { Icon: LucideIcon; color: string }> = {
  'team-and-subs': { Icon: ClipboardList, color: 'var(--c-blue)' },
  'graphics-and-cards': { Icon: ImageIcon, color: 'var(--c-green)' },
  tournaments: { Icon: Trophy, color: 'var(--c-amber)' },
  'club-admin': { Icon: Wallet, color: 'var(--c-red)' },
};
