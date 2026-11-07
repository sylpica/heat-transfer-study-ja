import {installWorkerRuntime} from '../worker-runtime.mjs';
import {createWallTemperaturePipe} from './pipe-wall-temperature.mjs';
installWorkerRuntime(data=>{
 if(data.kind!=='wall-temperature-circular-pipe')throw Error('円管の一定壁温＋指定発達流だけを扱います。');
 return createWallTemperaturePipe(data.config);
});
