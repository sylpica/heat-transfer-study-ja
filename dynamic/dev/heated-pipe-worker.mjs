import {installWorkerRuntime} from '../worker-runtime.mjs';
import {createHeatedPipe} from './heated-pipe.mjs';
installWorkerRuntime(data=>{
 if(data.kind!=='heated-circular-pipe')throw Error('円管の指定発達流＋環帯平均温度だけを扱います。');
 return createHeatedPipe(data.config);
});
