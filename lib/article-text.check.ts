// Self-check for news article body helpers (legacy plain text vs editor HTML).
// Run: npx esbuild lib/article-text.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { articleText, isArticleEmpty, isArticleHtml, textToHtml, toArticleHtml } from './article-text';

assert.equal(isArticleHtml('Won 3-1 < last week'), false, 'a lone < is not HTML');
assert.equal(isArticleHtml('<p>Hi</p>'), true);
assert.equal(isArticleHtml('Final: <Team A> 2-1 <Team B> <3'), false, 'tag-like words in old plain text');
assert.equal(isArticleHtml('Hi<br>there'), true);
assert.equal(articleText('Final: <Team A> won'), 'Final: <Team A> won', 'plain text is left alone');
assert.equal(textToHtml('Line one\nline two\n\n\nNext <b>para</b> & more'), '<p>Line one<br>line two</p><p>Next &#60;b&#62;para&#60;/b&#62; &#38; more</p>');
assert.equal(toArticleHtml('<h2>Title</h2>'), '<h2>Title</h2>', 'HTML passes through');
assert.equal(toArticleHtml(null), '');

assert.equal(articleText('<h2>Big win</h2><p>We won&nbsp;3–1 &amp; Tom&#39;s <b>hat-trick</b><br>sealed it</p>'), 'Big win We won 3–1 & Tom\'s hat-trick sealed it');
assert.equal(articleText('  plain text  '), 'plain text');
assert.equal(articleText('<p>&#x1F600;</p>'), '😀');

assert.equal(isArticleEmpty('<p><br></p>'), true);
assert.equal(isArticleEmpty('<p>&nbsp;</p>'), true);
assert.equal(isArticleEmpty('<p><img src="https://x/y.jpg"></p>'), false, 'a picture alone is content');
assert.equal(isArticleEmpty('<iframe src="https://www.youtube-nocookie.com/embed/abc123"></iframe>'), false);
assert.equal(isArticleEmpty('Hello'), false);

console.log('article-text: plain text, HTML, summaries and empty bodies OK');
