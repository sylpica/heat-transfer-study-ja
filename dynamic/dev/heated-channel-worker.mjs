import {installWorkerRuntime} from '../worker-runtime.mjs';import {createHeatedChannel} from './heated-channel.mjs';
installWorkerRuntime(data=>{if(data.kind!=='heated-channel')throw Error('指定発達流の入口出口と同一壁熱流束だけを扱います。');return createHeatedChannel(data.config);});
