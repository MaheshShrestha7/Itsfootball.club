import assert from 'node:assert/strict';
import { findPlayers, firstNames, parseAiReply, parseShort, scoringSide } from './chat-score';

// Short format
assert.deepEqual(parseShort('g sam 23'), { kind: 'goal', side: 'us', player: 'sam', type: 'goal', minute: 23, added: undefined });
assert.deepEqual(parseShort('G Sam Lee'), { kind: 'goal', side: 'us', player: 'sam lee', type: 'goal' });
assert.deepEqual(parseShort('g them'), { kind: 'goal', side: 'them', player: undefined, type: 'goal' });
assert.deepEqual(parseShort('g them 31'), { kind: 'goal', side: 'them', player: undefined, type: 'goal', minute: 31, added: undefined });
assert.deepEqual(parseShort("g sam 45+2'"), { kind: 'goal', side: 'us', player: 'sam', type: 'goal', minute: 45, added: 2 });
assert.deepEqual(parseShort('pen jack'), { kind: 'goal', side: 'us', player: 'jack', type: 'penalty' });
assert.deepEqual(parseShort('og them'), { kind: 'goal', side: 'them', player: undefined, type: 'own_goal' });
assert.deepEqual(parseShort('og'), { kind: 'goal', side: 'us', player: undefined, type: 'own_goal' });
assert.deepEqual(parseShort('y jack'), { kind: 'card', side: 'us', player: 'jack', color: 'yellow' });
assert.deepEqual(parseShort('red them smith 70'), { kind: 'card', side: 'them', player: 'smith', color: 'red', minute: 70, added: undefined });
assert.deepEqual(parseShort('KO'), { kind: 'kickoff' });
assert.deepEqual(parseShort('Half time.'), { kind: 'halftime' });
assert.deepEqual(parseShort('2h'), { kind: 'second_half' });
assert.deepEqual(parseShort('ft'), { kind: 'fulltime' });
assert.deepEqual(parseShort('undo'), { kind: 'undo' });
assert.deepEqual(parseShort('2'), { kind: 'pick', n: 2 });
assert.deepEqual(parseShort('Yes'), { kind: 'yes' });
// Not the short format: our goal without a name, a card without a name, sentences, numbers as names
assert.equal(parseShort('g'), null);
assert.equal(parseShort('y'), null);
assert.equal(parseShort('y them'), null);
assert.equal(parseShort('sam again, great header'), null);
assert.equal(parseShort('they scored'), null);
assert.equal(parseShort('g 23 sam'), null);
assert.equal(parseShort('g sam 200'), null);
assert.equal(parseShort(''), null);
assert.equal(parseShort('constructor'), null);
assert.equal(parseShort('toString sam'), null);

// Names
const squad = [{ id: '1', name: 'Sam Lee' }, { id: '2', name: 'Sam Gurung' }, { id: '3', name: 'Jack Tan' }, { id: '4', name: 'Arjun Rai' }, { id: '5', name: 'Zoë Ng' }];
assert.deepEqual(findPlayers('sam', squad).map(p => p.id), ['1', '2']);
assert.deepEqual(findPlayers('Sam Lee', squad).map(p => p.id), ['1']);
assert.deepEqual(findPlayers('gurung', squad).map(p => p.id), ['2']);
assert.deepEqual(findPlayers('jac', squad).map(p => p.id), ['3']);
assert.deepEqual(findPlayers('zoe', squad).map(p => p.id), ['5']);
assert.deepEqual(findPlayers('bob', squad), []);
assert.deepEqual(firstNames(squad), ['Sam', 'Jack', 'Arjun', 'Zoë']);

// The AI's answers
assert.deepEqual(parseAiReply('{"action":"goal","side":"us","player":"Sam","minute":null}'), { kind: 'goal', side: 'us', player: 'Sam', minute: undefined, type: 'goal' });
assert.deepEqual(parseAiReply('Sure! ```json\n{"action":"goal","side":"them","player":null,"minute":31}\n```'), { kind: 'goal', side: 'them', player: undefined, minute: 31, type: 'goal' });
assert.deepEqual(parseAiReply('{"action":"fulltime","side":"us","player":null,"minute":null}'), { kind: 'fulltime' });
assert.deepEqual(parseAiReply('{"action":"yellow","side":"us","player":"Jack","minute":40}'), { kind: 'card', side: 'us', player: 'Jack', minute: 40, color: 'yellow' });
assert.equal(parseAiReply('{"action":"unknown"}'), null);
assert.equal(parseAiReply('{"action":"goal","side":"us","player":null}'), null, 'our goal needs a name');
assert.equal(parseAiReply('{"action":"delete_match"}'), null);
assert.equal(parseAiReply('not json'), null);
assert.equal(parseAiReply('{"action":"goal","side":"us","player":"<script>"}'), null);
assert.equal((parseAiReply('{"action":"goal","side":"them","player":null,"minute":999}') as { minute?: number }).minute, undefined);

// Own goals count for the other side
assert.equal(scoringSide({ side: 'us', type: 'goal' }), 'us');
assert.equal(scoringSide({ side: 'us', type: 'own_goal' }), 'them');
assert.equal(scoringSide({ side: 'them', type: 'own_goal' }), 'us');

console.log('chat-score checks passed');
