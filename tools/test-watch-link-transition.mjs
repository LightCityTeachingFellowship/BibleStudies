import assert from 'node:assert/strict';
import {createLinkRouter} from '../v2/src/link-router.mjs';
const calls=[],win={location:{href:'https://lightcity.test/v2/',origin:'https://lightcity.test',assign(){}}},router={matches:()=>false,navigate(value){calls.push(value);return Promise.resolve(true)}};
const links=createLinkRouter({window:win,router,player:{},api:{ready:Promise.resolve()},resources:{}});
assert.equal(links.open('/Watch/?v=abcdefghijk&mode=audio&t=45&shared=1'),true);
let dest=new URL(calls.pop());assert.equal(dest.pathname,'/v2/watch/');assert.equal(dest.searchParams.get('v'),'abcdefghijk');assert.equal(dest.searchParams.get('mode'),'audio');assert.equal(dest.searchParams.get('t'),'45');assert.equal(dest.searchParams.get('shared'),'1');
assert.equal(links.open('/Listen/?archive=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),true);assert.match(calls.pop(),/kind=archive/);
assert.equal(links.open('/Watch/?v=bad'),false);
console.log('PASS: shared video and archive links enter the Watch route immediately with their playback parameters.');
