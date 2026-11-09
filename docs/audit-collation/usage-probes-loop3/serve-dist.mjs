// ループ3使い倒し用：dist を 127.0.0.1:4180 で配信する
import {startServer} from '../../../scripts/serve.mjs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const server=await startServer({root:resolve(repo,'dist'),port:4180});
console.log('dist server: http://127.0.0.1:'+server.address().port);
