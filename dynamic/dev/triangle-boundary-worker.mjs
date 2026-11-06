// Each A/B actor keeps its own accepted model; linear-only physics stays on its
// original factory rather than rewriting stored state kinds/signatures.
import {installWorkerRuntime} from '../worker-runtime.mjs';
import {createTriangleLinearTransient} from './triangle-linear-transient.mjs';
import {createTriangleSurfaceTransient} from './triangle-surface-transient.mjs';
installWorkerRuntime(data=>{if(data.kind!=='triangle-mixed-thermal-diffusion')throw Error('対応する凸P1の混合境界だけです。');return (data.config?.boundaries?.some(b=>b.type==='surface-exchange')?createTriangleSurfaceTransient:createTriangleLinearTransient)(data.config);});
