// Actual 300 K air reference properties plus explicitly hypothetical solid.
// This preset is not an identified commercial material or an h correlation.
export function conjugateAirConfig(input={}){
 const allowed=['velocity','lowerHeatFlux','upperHeatFlux','initialWallTemperature','inletTemperature','wallConductivity','contactResistance','grid'];if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!allowed.includes(k)))throw Error('未対応の共役画面条件です。');
 const c={velocity:.5,lowerHeatFlux:50,upperHeatFlux:50,initialWallTemperature:310,inletTemperature:300,wallConductivity:5,contactResistance:.001,grid:32,...input};
 for(const [k,min,max]of [['velocity',.12,.75],['lowerHeatFlux',-100,100],['upperHeatFlux',-100,100],['initialWallTemperature',280,330],['inletTemperature',280,330],['wallConductivity',.2,20],['contactResistance',0,.05]])if(typeof c[k]!=='number'||!Number.isFinite(c[k])||c[k]<min||c[k]>max)throw Error('空気/仮想固体の画面入力範囲を超えます。');
 if(![32,64,128].includes(c.grid))throw Error('共役画面の格子は32/64/128です。');const nx=c.grid,ny=nx/2,wallCells=nx/16;
 return {width:.05,height:.01,depth:.01,nx,ny,wallCells,wallThickness:.001,fluid:{rho:1.177,cp:1006,k:.0264,nu:1.575e-5},solid:{rho:1000,cp:1000,k:c.wallConductivity},bulkVelocity:c.velocity,inlet:c.inletTemperature,initial:Array.from({length:nx*(ny+2*wallCells)},(_,n)=>{const j=Math.floor(n/nx);return j<wallCells||j>=wallCells+ny?c.initialWallTemperature:c.inletTemperature;}),outerHeatFlux:{lower:c.lowerHeatFlux,upper:c.upperHeatFlux},contactResistance:c.contactResistance,referenceTemperatureK:300,source:0,maxTemperature:1000};
}
