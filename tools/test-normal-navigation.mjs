import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const template=readFileSync('app-shell.html','utf8');
const code=template.match(/<script>([\s\S]*?)<\/script>/)[1].replace("{{ '/' | relative_url | jsonify }}", "'/'");
for(const [input,expected] of [['?page=%2FVideos%2F','/Videos/'],['?page=%2FWatch%2F%3Fv%3Dabc','/Watch/?v=abc'],['?page=https%3A%2F%2Fevil.test%2F','/Home/'],['?page=%2Fapp%2F','/Home/'],['','/Home/']]){
 let destination;const location={href:'https://example.test/app/'+input,origin:'https://example.test',replace:value=>destination=new URL(value)};
 vm.runInNewContext(code,{URL,location});assert.equal(destination.origin,'https://example.test');assert.equal(destination.pathname+destination.search,expected);
}
assert.ok(!readFileSync('_includes/pwa-head.html','utf8').includes('navigation-launcher.js'));
console.log('PASS: ordinary links do not launch the shell; old shell links return safely to the requested page.');
