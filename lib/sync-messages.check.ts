// Self-check for the admin's plain-language save errors.
// Run: npx esbuild lib/sync-messages.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { friendlySyncError } from './sync-messages';

assert.match(friendlySyncError('Sync failed: TypeError: Failed to fetch'), /internet connection/);
assert.match(friendlySyncError('club_members: you do not have permission to change this record'), /role can't change/);
assert.match(friendlySyncError('club_seasons: duplicate key value violates unique constraint "club_seasons_club_id_name_key"'), /already exists/);
assert.match(friendlySyncError('matches: value too long for type character varying(32)'), /too long/);
assert.match(friendlySyncError('events: null value in column "title" violates not-null constraint'), /required field/);
assert.match(friendlySyncError(undefined), /Retry/);
assert.match(friendlySyncError('something odd'), /Retry/);
console.log('sync-messages: ok');
