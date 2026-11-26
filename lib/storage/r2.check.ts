import assert from 'node:assert/strict';
import { parseListXml } from './r2';

const page = parseListXml(`<?xml version="1.0" encoding="UTF-8"?><ListBucketResult><Name>b</Name><IsTruncated>true</IsTruncated>
<NextContinuationToken>tok&amp;1</NextContinuationToken>
<Contents><Key>clubs/a/x&amp;y.png</Key><Size>120</Size></Contents><Contents><Key>clubs/a/z.jpg</Key><Size>5</Size></Contents>
<CommonPrefixes><Prefix>clubs/a/</Prefix></CommonPrefixes><CommonPrefixes><Prefix>clubs/b/</Prefix></CommonPrefixes></ListBucketResult>`);
assert.deepEqual(page.prefixes, ['clubs/a/', 'clubs/b/']);
assert.deepEqual(page.files, [{ key: 'clubs/a/x&y.png', size: 120 }, { key: 'clubs/a/z.jpg', size: 5 }]);
assert.equal(page.next, 'tok&1');
assert.equal(parseListXml('<ListBucketResult><IsTruncated>false</IsTruncated><NextContinuationToken>t</NextContinuationToken></ListBucketResult>').next, undefined);
console.log('r2 ok');
