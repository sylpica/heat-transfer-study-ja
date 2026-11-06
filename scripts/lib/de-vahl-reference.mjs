// Table V definitions received from the owner's independent validation line.
// Reference attribution and limits are recorded in DE_VAHL_DEFINITIONS_20261106.md.
export const deVahlRa1000 = Object.freeze({volumeMean:1.118,verticalMidplaneMean:1.118,hotWallMean:1.117});
export function compareDeVahlWallNusselt(value,definition){
 if(!Number.isFinite(value)||definition?.quantity!=='Nu_0'||definition.location!=='hot-wall x=0'||definition.referenceLength!=='height')throw Error('A defined finite hot-wall Nu_0 is required; volume or midplane averages are different quantities.');
 const reference=deVahlRa1000.hotWallMean,difference=value-reference;
 return {quantity:'Nu_0',location:'hot-wall x=0',Ra:1000,Pr:.71,value,reference,difference,relativeDifference:difference/reference,referenceOrigin:'de Vahl Davis (1983), Table V p.256; independent Fairis scan-reading report received 2026-11-06',scope:'Discretization comparison at this grid, not a general CFD or release approval'};
}
