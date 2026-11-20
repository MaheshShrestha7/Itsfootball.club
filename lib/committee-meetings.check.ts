import assert from 'node:assert/strict';
import { agendaMinutes, buildMinutes, carriedActions, meetingSteps, meetingTitle, numberAgenda, topicKey, type AgendaItem, type CommitteeAction, type CommitteeMeeting } from './committee-meetings';

const it = (id: string, minutes: number, extra: Partial<AgendaItem> = {}): AgendaItem => ({ id, title: id, minutes, ...extra });

// Numbering: headings add up their sub-topics and aren't steps of their own
const agenda = [it('a', 5), it('b', 99), it('b1', 10, { sub: true }), it('b2', 15, { sub: true }), it('c', 10)];
assert.deepEqual(numberAgenda(agenda).map(r => [r.no, r.heading, r.minutes]), [['1', false, 5], ['2', true, 25], ['2.1', false, 10], ['2.2', false, 15], ['3', false, 10]]);
assert.deepEqual(meetingSteps(agenda).map(r => r.item.id), ['a', 'b1', 'b2', 'c']);
assert.equal(agendaMinutes(agenda), 40);
// A sub-topic at the top is a plain item
assert.deepEqual(numberAgenda([it('x', 5, { sub: true })]).map(r => r.no), ['1']);

// Topics
const general = { kind: 'general' as const, topic: null, event_id: null };
const cup = { kind: 'topic' as const, topic: 'Xmas', event_id: 'e1' };
assert.equal(topicKey(general), 'general');
assert.equal(topicKey(cup), 'event:e1');
assert.equal(topicKey({ kind: 'topic', topic: ' Canteen ', event_id: null }), 'topic:canteen');
assert.equal(meetingTitle(cup, 'Christmas Cup'), 'Christmas Cup meeting');
assert.equal(meetingTitle(general), 'Committee meeting');

// Carry-over: open actions from earlier meetings on the same topic only
const mtg = (id: string, starts_at: string, t: Pick<CommitteeMeeting, 'kind' | 'topic' | 'event_id'> = general) => ({ id, starts_at, ...t });
const meetings = [mtg('g1', '2026-11-04T08:00:00Z'), mtg('c1', '2026-11-25T08:00:00Z', cup), mtg('g2', '2026-12-02T08:00:00Z'), mtg('g3', '2026-12-09T08:00:00Z')];
const act = (id: string, meeting_id: string, extra: Partial<CommitteeAction> = {}): CommitteeAction => ({
  id, club_id: 'c', meeting_id, item_id: null, text: id, owner_id: null, owner_name: 'Mei', due_on: null, status: 'open', closed_at: null, closed_in: null, created_at: '2026-11-04T09:00:00Z', ...extra,
});
const actions = [act('open-g1', 'g1'), act('done-g1', 'g1', { status: 'done', closed_in: 'g2' }), act('old-done', 'g1', { status: 'done', closed_in: 'g1' }), act('cup', 'c1'), act('later', 'g3')];
assert.deepEqual(carriedActions(actions, meetings, meetings[2]).map(a => a.id).sort(), ['done-g1', 'open-g1']);
assert.deepEqual(carriedActions(actions, meetings, mtg('c2', '2026-12-09T08:00:00Z', cup)).map(a => a.id), ['cup']);

// Minutes
const meeting: CommitteeMeeting = {
  id: 'g2', club_id: 'c', kind: 'general', topic: null, event_id: null, starts_at: '2026-12-02T08:30:00Z', location: 'Clubrooms', status: 'done',
  agenda: [it('a', 5, { notes: 'Hello' }), it('b', 0), it('b1', 10, { sub: true, notes: 'Entries', decisions: ['Close entries 12 Dec', ' '] , lead_id: 'm1' }), it('b2', 5, { sub: true }), it('c', 5, { decisions: ['Buy nets'] })],
  attendance: { m1: 'present', m2: 'apology', gone: 'present' },
  current_item: null, item_started_at: null, started_at: '2026-12-02T08:32:00Z', ended_at: '2026-12-02T09:51:00Z', figures: null,
  agenda_sent_at: null, minutes_sent_at: null, share_token: null, shared_at: null,
};
const people: Record<string, string> = { m1: 'Priya Sharma (President)', m2: 'Luca Romano (Head Coach)' };
const r = buildMinutes({
  club: 'ANCC', meeting, title: 'Committee meeting', actions: [act('new', 'g2'), act('open-g1', 'g1')], carried: carriedActions(actions, meetings, meetings[2]),
  meetings, person: id => people[id] || null, next: { starts_at: '2027-02-02T08:30:00Z', location: 'Clubrooms' }, tz: 'Australia/Sydney',
});
assert.equal(r.day, 'Wednesday 2 December 2026'); // 8:32 am UTC is 7:32 pm in Sydney
assert.equal(r.time, '7:32 pm to 8:51 pm');
assert.deepEqual(r.present, ['Priya Sharma (President)']); // someone no longer on the committee drops out
assert.deepEqual(r.apologies, ['Luca Romano (Head Coach)']);
assert.deepEqual(r.decisions, [{ text: 'Close entries 12 Dec', no: '2.1' }, { text: 'Buy nets', no: '3' }]);
assert.deepEqual(r.actions.map(a => [a.text, a.from]), [['open-g1', 'From 4 Nov'], ['new', null]]);
assert.deepEqual(r.closed, ['done-g1 (Mei)']);
assert.deepEqual(r.notes.map(n => [n.no, n.heading, n.lead]), [['1', false, null], ['2', true, null], ['2.1', false, 'Priya Sharma']]);
assert.match(r.next || '', /^Tuesday 2 February 2027, 7:30 pm, Clubrooms$/);

console.log('committee-meetings: ok');
