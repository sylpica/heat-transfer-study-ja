import {installWorkerRuntime} from '../worker-runtime.mjs';
import {createRansChannel} from './rans-channel.mjs';
// Separate development port: no expression, callback, or generic model loading.
installWorkerRuntime(data=>{if(data.kind!=='rans-channel')throw Error('定常平均流の受動温度だけを計算します。');return createRansChannel(data.config);});
