// Development-only fixed-property air example; not a fluid-property service.
export function thermalWallConfig({grid=8,wallTemperature=310,wallMode='finite-capacity'}={}){
 if(![8,16,32].includes(grid))throw Error('画面の格子は8/16/32だけです。');
 if(typeof wallTemperature!=='number'||!Number.isFinite(wallTemperature)||wallTemperature<300||wallTemperature>310)throw Error('壁の初期温度は300〜310 Kです。');
 if(!['finite-capacity','isothermal-thermostat'].includes(wallMode))throw Error('壁モードが未対応です。');
 const rho=1.177,cp=1006,k=.0264;
 return {nx:grid,ny:grid,width:.01,height:.01,depth:.01,rho,cp,nu:1.575e-5,alpha:k/(rho*cp),beta:1/300,gravityBeta:9.81/300,initial:300,wallInitialTemperature:wallTemperature,coldTemperature:300,wallCapacityJPerK:.001,wallInputW:0,maxTemperature:1000,wallMode,scalarScheme:'central'};
}
export function thermalWallApplicability(config,snapshot){
 const maximumFaceSpeed=Math.max(...snapshot.u.map(Math.abs),...snapshot.v.map(Math.abs)),excursion=Math.max(Math.abs(snapshot.wallOffsetTemperatureK),...snapshot.offsetTemperature.map(Math.abs));
 return {rhoKgPerM3:config.rho,cpJPerKgK:config.cp,kWPerMK:config.rho*config.cp*config.alpha,alphaM2PerS:config.alpha,maximumEffectiveRa:snapshot.maximumEffectiveRa,betaTemperatureExcursion:config.beta*excursion,maximumFaceSpeedMPerS:maximumFaceSpeed,eckertEstimate:excursion===0?null:maximumFaceSpeed**2/(config.cp*excursion),eckertDefinition:'max face-component speed squared / (cp * max retained thermal excursion); diagnostic estimate, not a viscous-heating solution',viscousHeatingOmitted:true,propertiesFixedNear300K:true,generalConjugateCFDApproved:false};
}
