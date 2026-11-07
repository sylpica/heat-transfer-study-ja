// Fixed 300 K reference-air properties; full circular annuli, no rectangular depth.
export function wallTemperaturePipeAirConfig(input={}){
 const allowed=['velocity','wallTemperature','inletTemperature','grid'];
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!allowed.includes(k)))throw Error('未対応の円管画面条件です。');
 const c={velocity:.5,wallTemperature:310,inletTemperature:300,grid:32,...input};
 for(const [key,min,max]of [['velocity',.24,1.5],['wallTemperature',280,330],['inletTemperature',280,330]])if(typeof c[key]!=='number'||!Number.isFinite(c[key])||c[key]<min||c[key]>max)throw Error('一定壁温空気円管の画面入力範囲を超えます。');
 if(![32,64,128].includes(c.grid))throw Error('円管画面の格子は32/64/128です。');
 return {width:.05,radius:.005,nx:c.grid,nr:c.grid/2,rho:1.177,cp:1006,k:.0264,nu:1.575e-5,bulkVelocity:c.velocity,wallTemperature:c.wallTemperature,inlet:c.inletTemperature,initial:c.inletTemperature,referenceTemperatureK:300,maxTemperature:1000};
}
