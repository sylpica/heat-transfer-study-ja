import {installWorkerRuntime} from '../worker-runtime.mjs';import {createConjugateChannel} from './conjugate-channel.mjs';
installWorkerRuntime(data=>{if(data.kind!=='solid-wall-prescribed-flow')throw Error('開発用の有限厚壁＋指定発達流の温度だけです。');return createConjugateChannel(data.config);});
