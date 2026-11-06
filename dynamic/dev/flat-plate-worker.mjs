import {installWorkerRuntime} from '../worker-runtime.mjs';
import {createFlatPlateThermal} from './flat-plate-thermal.mjs';
installWorkerRuntime(data=>{if(data.kind!=='flat-plate-passive-temperature')throw Error('開発用の平板受動温度だけです。');return createFlatPlateThermal(data.config);});
