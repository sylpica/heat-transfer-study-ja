#!/usr/bin/env python3
"""Read own saved MAC fields; independently sum finite-volume section heat.

This does not generate a separate CFD solution or validate general flow physics.
No product JS diagnostic function or raw external reference table is used.
"""
from pathlib import Path
import json, math, hashlib, subprocess
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]

def analyze(n):
    path = ROOT / f'docs/dynamic/CFD_FINE_NATURAL_N{n}_20261106_v1.json'
    data = json.loads(path.read_text())
    config, state = data['config'], data['finalState']
    assert config['scalarScheme'] == 'central'
    assert config['width'] == config['height'] == config['depth'] == 1
    assert config['rho'] == config['cp'] == config['alpha'] == 1
    temp = [state['temperature'][j*n:(j+1)*n] for j in range(n)]
    speed = [state['u'][j*(n+1):(j+1)*(n+1)] for j in range(n)]
    fluxes, mass = [], []
    for i in range(n+1):
        heat, flow = [], []
        for j in range(n):
            if i == 0:
                conductive = 2*n*(config['leftTemperature'] - temp[j][0])
                transported = 0.
            elif i == n:
                conductive = 2*n*(temp[j][-1] - config['rightTemperature'])
                transported = 0.
            else:
                conductive = n*(temp[j][i-1] - temp[j][i])
                transported = speed[j][i]*((temp[j][i-1]+temp[j][i])/2 - config['referenceTemperature'])
            heat.append((conductive + transported)/n)
            flow.append(speed[j][i]/n)
        fluxes.append(math.fsum(heat))
        mass.append(math.fsum(flow))
    volume = math.fsum([fluxes[0]/2, *fluxes[1:-1], fluxes[-1]/2])/n
    actual = data['history'][-1]
    differences = {
        'wall': fluxes[0] - actual['leftWallNu'],
        'midplane': fluxes[n//2] - actual['verticalMidplaneNu'],
        'volume': volume - actual['volumeMeanNu'],
        'allNativeSectionsMaximum': max(abs(a-b['nusselt']) for a,b in zip(fluxes,actual['sectionHeat'])),
    }
    assert max(abs(v) for v in differences.values()) < 1e-10
    return {
        'grid': n, 'sourceFile': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'timeS': state['time'], 'steady': data['steady'], 'allFineObjectivesPassed': data['allFineObjectivesPassed'],
        'Nu0_hotWall': fluxes[0], 'NuHalf_verticalMidplane': fluxes[n//2], 'Nu_volumeTrapezoidalNativeSections': volume,
        'maximumNuSectionSpread': max(fluxes)-min(fluxes), 'maximumSectionMassFlowKgPerS': max(map(abs,mass)),
        'maximumDifferenceFromProductDiagnostics': differences,
        'localNuMaximum': actual['localNuMaximum'], 'uMaximum': actual['uMaximum'], 'vMaximum': actual['vMaximum'],
        'fineObjectives': data['checks'],
    }

if __name__ == '__main__':
    rows = [analyze(n) for n in (16,32,64)]
    a,b,c = [r['Nu0_hotWall'] for r in rows]
    order = math.log2((a-b)/(b-c))
    extrapolated = c + (c-b)/(2**order-1)
    result = {
        'generatedAtUTC': datetime.now(timezone.utc).isoformat(),
        'sourceCommit': subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
        'method': 'Separate Python math.fsum evaluation of native section conductive and actual central advective heat, from saved own MAC fields. No JS diagnostic functions used. Not an independent momentum/temperature solution.',
        'rows': rows, 'wallNuObservedOrder16_32_64': order, 'wallNuRichardsonEstimate': extrapolated,
        'richardsonIsNotExactReferenceOrGeneralAccuracyProof': True,
        'steadyConservationNote': 'The steady conservative discrete equations make native wall/section means converge to the same computed heat. Table V printed Nu0/NuHalf/Nu have separate definition labels and finite reported benchmark accuracy; do not change a computed definition or tune it to printed rounding.',
        'referenceDefinitionsReceivedFromOwner': {'Ra1000_hotWallNu0':1.117,'Ra1000_midplaneNuHalf':1.118,'Ra1000_volumeNu':1.118},
        'externalReportCountsAddedToLocalTests': False, 'generalCFDAccuracyVerified':False, 'releaseApproved':False,
    }
    output = ROOT/'docs/dynamic/CFD_FINE_NATURAL_SUMMARY_20261106.json'
    assert not output.exists(), 'Protect existing summary.'
    output.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'output':str(output),'wallNuOrder':order,'wallNuRichardson':extrapolated,'maximumDiagnosticDifference':max(abs(v) for r in rows for v in r['maximumDifferenceFromProductDiagnostics'].values())}))
