import {installWorkerRuntime} from '../worker-runtime.mjs';import {createTriangleLinearTransient} from './triangle-linear-transient.mjs';
installWorkerRuntime(data=>{if(data.kind!=='triangle-linear-diffusion')throw Error('限定した線形混合境界P1だけです。');return createTriangleLinearTransient(data.config);});
