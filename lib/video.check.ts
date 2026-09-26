// Self-check for news video links.
// Run: npx esbuild lib/video.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { videoEmbed } from './video';

const yt = { kind: 'youtube', src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' };
assert.deepEqual(videoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10'), yt);
assert.deepEqual(videoEmbed('https://youtu.be/dQw4w9WgXcQ'), yt);
assert.deepEqual(videoEmbed('https://www.youtube.com/embed/dQw4w9WgXcQ'), yt);
assert.deepEqual(videoEmbed('https://m.youtube.com/shorts/dQw4w9WgXcQ'), yt);
assert.deepEqual(videoEmbed('https://media.club.org/goal.MP4'), { kind: 'mp4', src: 'https://media.club.org/goal.MP4' });
assert.equal(videoEmbed('http://media.club.org/goal.mp4'), null);
assert.equal(videoEmbed('https://evil.example/embed/dQw4w9WgXcQ'), null);
assert.equal(videoEmbed('javascript:alert(1)'), null);
assert.equal(videoEmbed(''), null);

console.log('video: embed links OK');
