import {createLumpedRadial} from './lumped-radial.mjs';
import {createRadial} from './radial.mjs';
import {createDevelopedChannel} from './developed-channel.mjs';
import {createRadiationNetwork} from './radiation-network.mjs';
import {createThermal} from './thermal.mjs';
import {installWorkerRuntime} from './worker-runtime.mjs';
installWorkerRuntime(data=>{
 if(data.kind&&!['thermal','radiation-network','developed-channel','radial'].includes(data.kind))throw Error('未対応のモデルです。');
 if(data.kind==='radial'&&data.config?.approximation&&data.config.approximation!=='lumped')throw Error('未対応の近似モデルです。');
 return data.kind==='radial'?(data.config?.approximation==='lumped'?createLumpedRadial(data.config):createRadial(data.config)):data.kind==='radiation-network'?createRadiationNetwork(data.config):data.kind==='developed-channel'?createDevelopedChannel(data.config):createThermal(data.config);
});
