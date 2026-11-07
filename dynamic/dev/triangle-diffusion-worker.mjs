import {installWorkerRuntime} from '../worker-runtime.mjs';import {createTriangleDiffusion} from './triangle-diffusion.mjs';
installWorkerRuntime(data=>{if(data.kind!=='triangle-diffusion')throw Error('一定物性・全周固定温度のP1伝導だけを扱います。');return createTriangleDiffusion(data.config);});
