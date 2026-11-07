import {installWorkerRuntime} from '../worker-runtime.mjs';
import {createThermalWallCavity} from './thermal-wall-cavity.mjs';
installWorkerRuntime(data=>{
 if(data.kind!=='finite-thermal-wall-cavity')throw Error('一様温度の有限容量壁と閉正方形だけを扱います。');
 return createThermalWallCavity(data.config);
});
