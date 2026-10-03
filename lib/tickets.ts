// Event tickets: the rules the checkout route applies (shared with the event page so both say the same).
// Price and event come from the events row on the server; the client only sends an event id and a quantity.

export const MAX_TICKETS_PER_ORDER = 10;

/** Sales stay open until the event ends (or 6 hours after kick-off when it has no end time) */
const SALES_GRACE_MS = 6 * 3600 * 1000;

export interface TicketedEvent {
  is_public: boolean;
  ticket_price_cents: number;
  start_time: string;
  end_time?: string | null;
}

export const salesOpen = (event: Pick<TicketedEvent, 'start_time' | 'end_time'>, now = Date.now()) =>
  (event.end_time ? new Date(event.end_time).getTime() : new Date(event.start_time).getTime() + SALES_GRACE_MS) > now;

/** Why this order can't go ahead, or null. `left` is tickets_left(): null = no capacity limit */
export function ticketOrderError(event: TicketedEvent | null, quantity: number, left: number | null, now = Date.now()): string | null {
  if (!event || !event.is_public) return 'Event not found.';
  if (!(event.ticket_price_cents > 0)) return 'This event doesn’t sell tickets.';
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_TICKETS_PER_ORDER) {
    return `Choose between 1 and ${MAX_TICKETS_PER_ORDER} tickets.`;
  }
  if (!salesOpen(event, now)) return 'Ticket sales for this event have closed.';
  if (left !== null && quantity > left) return left === 0 ? 'This event is sold out.' : `Only ${left} ticket${left === 1 ? '' : 's'} left.`;
  return null;
}
