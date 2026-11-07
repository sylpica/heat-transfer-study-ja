import {installWorkerRuntime} from '../worker-runtime.mjs';
import {createOrthogonalDiffusion} from './orthogonal-diffusion.mjs';
installWorkerRuntime(data=>{
 if(data.kind!=='orthogonal-fixed-temperature')throw Error('直交凹領域の一定物性・全周固定温度だけを扱います。');
 return createOrthogonalDiffusion(data.config);
});
