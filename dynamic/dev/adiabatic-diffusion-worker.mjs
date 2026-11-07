import {createAdiabaticDiffusion} from './adiabatic-diffusion.mjs';import {installAsyncDiffusionRuntime} from './adiabatic-diffusion-runtime.mjs';
installAsyncDiffusionRuntime(async data=>{
 if(data.kind!=='experimental-adiabatic-diffusion')throw Error('開発用の断熱矩形拡散だけです。');const c=data.config;if(!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>!['physical','backend','inputRoundingBudgetK','energyToleranceFraction'].includes(k)))throw Error('未対応の非同期拡散条件です。');
 return createAdiabaticDiffusion(c.physical,{backend:c.backend??'auto',inputRoundingBudgetK:c.inputRoundingBudgetK??1e-6,energyToleranceFraction:c.energyToleranceFraction??1e-6});
});
