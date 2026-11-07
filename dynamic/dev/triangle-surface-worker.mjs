import {installWorkerRuntime} from '../worker-runtime.mjs';import {createTriangleSurfaceTransient} from './triangle-surface-transient.mjs';
installWorkerRuntime(data=>{if(data.kind!=='triangle-surface-diffusion')throw Error('限定したP1表面境界モデルだけです。');return createTriangleSurfaceTransient(data.config);});
