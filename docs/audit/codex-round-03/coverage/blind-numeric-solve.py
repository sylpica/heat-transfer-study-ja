#!/usr/bin/env python3
"""Independent arithmetic from the answer-free packet. Never reads an answer key."""
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
PACKET = HERE / 'blind-numeric-packet.json'
questions = {q['id']: q for q in json.loads(PACKET.read_text())['questions']}
rows = []

def record(id, index, value, units, working, alternatives):
    assert id in questions and 0 <= index < 4
    rows.append(dict(id=id, independent_choice_index=index,
                     computed_or_physical_result=dict(value=value, units=units),
                     working=working, alternative_choices_review=alternatives))

record('book-1-2-closed-energy-rate', 2, 120-30, 'W',
       'Incoming heat increases stored energy; outward work decreases it. dU/dt=Q-W=120-30=+90 W.',
       '150 W adds outward work incorrectly; negative values reverse storage sign.')
record('supp-deep-heat-generation-center-v1', 1, 30+8e4*.02**2/(2*20), 'degC',
       'Integrate k T_xx=-q_gen with symmetry at the center. Half thickness L=0.020 m; T_center-T_surface=q_gen L^2/(2k)=0.8 K, hence 30.8 degC.',
       '30.0 ignores generation; 30.4 loses a factor two; 31.6 doubles the rise.')
record('supp-deep-fin-base-heat-v1', 2, 200*1e-4*math.sqrt(25*.04/(200*1e-4))*60*.608859, 'W',
       'Insulated-tip fin theta=theta_b cosh[m(L-x)]/cosh(mL). Base derivative gives Q=k Ac m theta_b tanh(mL), with m=sqrt(hP/kAc)=sqrt(50), yielding 5.16635 W.',
       '8.485 W omits tanh(mL); neither 4.500 nor 6.000 W follows this finite-fin boundary condition.')
record('supp-deep-fick-equimolar-flux-v1', 0, 101325/(8.31446261815324*300)*2e-5/.01*(.20-.05), 'mol/(m^2 s)',
       'Total molar flux is zero, so N_A=-c D dy_A/dx. c=P/(RT)=40.622 mol/m^3, dy_A/dx=-15 /m; N_A=+0.0121866 mol/(m^2 s).',
       'Negative sign contradicts the concentration gradient; 0.01396 includes Stefan flow absent here; 0.00122 is tenfold too small.')
record('supp-deep-fick-stefan-ratio-v1', 3, math.log((1-.05)/(1-.20))/(.20-.05), 'ratio',
       'For stagnant B, N_A=-cD dy_A/dx+y_A N_A; integrate to N_A=cD/L ln[(1-y_AL)/(1-y_A0)]. Divide by equimolar cD(y_A0-y_AL)/L: ln(.95/.80)/.15=1.14567.',
       '1.00 drops Stefan convection; 0.87 is the reciprocal; 2.00 is not the integral result.')
record('supp-deep-rad-radiosity-v1', 1, .8*1451.616+.2*459.300, 'W/m^2',
       'Opaque gray surface outgoing radiosity is emitted plus reflected incident power: J=.8(1451.616)+.2(459.300)=1253.1528 W/m^2.',
       '1161.293 is emission only; 793.852 subtracts irradiation and is net flux; 459.300 is incoming irradiation.')
record('supp-found-ntu-thermal-v1', 2, (1-math.exp(-300/300))*300*(60-20)/1000, 'kW',
       'NTU=UA/Cmin=1. For Cr=0 effectiveness=1-e^-1; Q=epsilon Cmin (Th,in-Tc,in)=7.58545 kW.',
       '12.00 kW is the ideal upper bound; 4.415 kW is its untransferred fraction; 6.000 kW assumes epsilon=.5.')
record('supp-next-parallel-extra-branch-v1', 2, 60*(1/.1+1/.2+1/.3), 'W',
       'All parallel paths share 60 K. Add their heat rates: 600+300+200=1100 W.',
       '600 and 900 omit branches; 1500 does not follow the specified conductances.')
record('supp-batch2-pump-shaft-v1', 2, 50000*.001/.5, 'W',
       'Hydraulic power=delta_p times volumetric flow=50 W. Shaft power supplies hydraulic power divided by efficiency: 50/.50=100 W.',
       '25 multiplies by efficiency; 50 omits efficiency; 200 introduces an extra factor two.')
record('supp-batch2-outer-base-u-v1', 1, 100*.50/1.00, 'W/(m^2 K)',
       'Conductance is independent of reference area: Ui Ai=Uo Ao=50 W/K. Uo=50/1=50 W/(m^2 K).',
       '25 applies the area conversion twice; 100 ignores the area change; 200 reverses the ratio.')
record('supp-batch2-fo-scale-t-v1', 2, 100*(.040/.020)**2, 's',
       'Fo=alpha t/L^2 is held fixed with identical alpha. Doubling L requires t to grow by 4, to 400 s.',
       '100 omits length scaling; 200 uses L instead of L^2; 800 uses L^3.')
record('supp-batch3-left-boundary-outward-flux-v1', 0, -200, 'W/m^2',
       'Outward component q dot n=(+200 xhat) dot (-xhat)=-200 W/m^2.',
       'Positive sign would mean flux leaving at the left surface; magnitude 100 has no supplied factor.')
record('supp-batch3-generated-total-power-v1', 2, 20000*.10*1.0, 'W',
       'Integrate uniform generation over full slab volume A times thickness=.10 m^3. Total=20000*.10=2000 W.',
       '1000 W could be one symmetric half, but the question asks total; 500 and 4000 are incorrect volumes.')
record('supp-natural-beta-v1', 1, 1/(26.85+273.15), '1/K',
       'Ideal-gas beta=1/T at constant pressure requires absolute temperature. T=300 K; beta=.00333333 K^-1.',
       '.0372 uses Celsius; .000333 is tenfold small; 300 confuses T with its reciprocal.')
nu=.36+.518*64327.8689**.25/(1+(.559/.8)**(9/16))**(4/9)
record('supp-natural-geometry-cylinder-coefficient-v1', 0, nu*.028/.040, 'W/(m^2 K)',
       f'Direct evaluation of supplied correlation gives Nu_D={nu:.12g}; h=Nu_D k/D={nu*.028/.04:.12g} W/(m^2 K).',
       '6.69 is approximately Nu rather than h; 9.36 doubles h; 4.43 omits the .36 conduction term.')
record('supp-natural-geometry-temperature-average-v1', 0, 12/(1+1/5), 'K',
       'Let s=x/L. Mean deltaT=12 integral_0^1 s^(1/5) ds=12/(6/5)=10 K.',
       '10.4 is approximately midpoint, 12 is endpoint, and 6 assumes a linear profile.')
record('supp-condensation-film-reynolds-v1', 2, 4*5e-4/(.4*2e-4), 'dimensionless',
       'Use the definition provided: Re_f=4 mdot/(b mu)=.002/.00008=25.',
       '6.3 approximates Gamma/mu without factor four; 13 is about half; 50 doubles the specified result.')
record('supp-condensation-reynolds-definition-v1', 3, 4*300, 'dimensionless',
       'Same physical flow, new Reynolds convention multiplies Gamma/mu by four: 4*300=1200.',
       '75 divides instead of multiplies; 300 leaves the convention unchanged; 600 multiplies by two.')
record('supp-transition-average-slope-v1', 3, .4*2+.6*.20-.005*(400-40), 'kW/(m^2 K)',
       'Differentiate qbar=f qw+(1-f)qd: qbar_prime=f qw_prime+(1-f)qd_prime+f_prime(qw-qd)=.8+.12-1.8=-.88 kW/(m^2 K).',
       '+.92 omits wet-area change; -1.8 omits intrinsic branch slopes; +2.7 reverses the sign of area-change term.')
record('supp-tube-boiling-slip-void-v1', 3, 1/(1+(.9/.1)*(10/1000)*2), 'void fraction',
       'Mass fractions must convert to volume with density and slip. Given denominator=1+9*.01*2=1.18; alpha=.847458.',
       '.917 assumes S=1; .100 confuses void fraction with mass quality; .957 uses the opposite slip effect.')
record('supp-system-clapeyron-increment-v1', 1, 400*.50/2e6*4000, 'K',
       'Clapeyron derivative=Tsat delta_v/hfg=.0001 K/Pa. Multiply by 4 kPa=4000 Pa: rise=.40 K.',
       '.00040 omits kPa to Pa conversion; 4 and 40 insert extra factors 10 and 100.')
record('supp-tube-boiling-subcooled-budget-v1', 2, (3000-.02*100000)/(.02*2e6), 'mass quality',
       'Sensible heating to saturation consumes .020*100000=2000 W. Remaining 1000 W evaporates mass; x=1000/(.020*2e6)=.025.',
       '.075 uses all heat for latent vaporization; .05 counts the sensible portion instead; .10 is not the energy balance.')
record('supp-forced-condensation-film-shear-flow-v1', 2, 1000**2*10*1e-4**3/(3*1e-3)+1000*.1*1e-4**2/(2*1e-3), 'kg/(m s)',
       'Given gravity contribution is 0.00333333 kg/(m s), downwards interface shear adds .00050000, yielding .00383333 kg/(m s).',
       '.000500 omits gravity; .00283 subtracts assisting shear; .00333 ignores it.')
record('supp-heat-pipe-pore-tradeoff-v1', 1, .5, 'Qmax_new/Qmax_old',
       'Multiply a/r=b Qmax/r^2 by r^2: Qmax=a r/b. With a,b fixed, halving r halves Qmax.',
       'Unchanged ignores r; 2 and 4 incorrectly use the capillary pressure rise without increased hydraulic resistance.')
v=math.sqrt(.5*.040/(2*.001))
record('supp-heatpipe-limit-entrainment-v1', 0, 2*5e-5*1e6*v, 'W',
       f'Invert specified Weber condition: v=sqrt(We sigma/(rho ell))=sqrt(10)={v:.12g} m/s. Latent power=rho Av hfg v={2*5e-5*1e6*v:.12g} W.',
       '100 W effectively assumes v=1 m/s; 447 and 632 alter the specified Weber/density factor.')
record('supp-heatpipe-limit-capillary-load-v1', 2, (4000-800)/125.10, 'W',
       'Capillary budget 4000 Pa must cover adverse gravity 800 Pa plus hydraulic loss. Q=(4000-800)/125.10=25.5795 W.',
       '38.4 adds gravity allowance; 32.0 omits gravity; 2.56 introduces a tenfold error.')
record('supp-kirchhoff-emission-weight-v1', 1, [.6*.25+.2*.75, 1000*(.6*.25+.2*.75)], '[emissivity, W/m^2]',
       'Weight each emissivity by the blackbody energy fraction at surface temperature: epsilon=.6*.25+.2*.75=.30, E=epsilon Eb=300 W/m^2.',
       '.80 sums emissivities without weights; .40 gives bands equal weights; .50 reverses the stated weights.')
nu_lo=(.0210/8)*(50000-1000)*4/(1+12.7*math.sqrt(.0210/8)*(4**(2/3)-1))
record('supp-tube-correlation-single-phase-reference-v1', 0, nu_lo*.200/.0200, 'W/(m^2 K)',
       f'Using Darcy f_D as supplied, numerator=514.5 and denominator={1+12.7*math.sqrt(.021/8)*(4**(2/3)-1):.12g}. Nu_lo={nu_lo:.12g}; h=10 Nu_lo={nu_lo*10:.12g} W/(m^2 K).',
       '259 is Nu mistaken for h; 25900 multiplies conversion twice; 10300 imposes an unsupported factor four.')
radicand=.100**3*.500*(900-.500)*10*2.45855e6/(4e-5*.0500*300)
record('supp-phase-correlation-cylinder-h-v1', 0, .62*radicand**.25, 'W/(m^2 K)',
       f'Supplied Bromley fourth-root argument={radicand:.12g}; fourth root={radicand**.25:.12g}; multiply .62 to obtain {.62*radicand**.25:.12g} W/(m^2 K).',
       '368 omits coefficient .62; 114 halves the result; 457 doubles it.')
record('supp-phase-correlation-wire-geometry-v1', 3, 45*.515*(18/(.5**2*(2*.5**2+1)))**.25, 'kW/m^2',
       'R*^2=.25; denominator=.25*1.5=.375; fourth-root argument=18/.375=48. Multiplier=.515*48^.25=1.35555; q_wire=61.0 kW/m^2.',
       '45 omits geometry correction; 118 omits .515; 36.3 is not the supplied geometry function.')
record('supp-dropwise-correlation-effective-coefficient-v1', 2, 1000*60**.8*(5*4+.3*4**2)/4, 'W/(m^2 K)',
       'At theta=4, polynomial=20+4.8=24.8. Effective h=q/theta=1000*60^.8*6.2=164027.8 W/(m^2 K), not dq/dtheta.',
       '656000 is q without temperature division; 132000 omits quadratic term; 196000 differentiates q instead of dividing it.')
fr=50**2/(800**2*10*.020)
record('supp-tube-correlation-horizontal-factor-v1', 1, (25*fr)**.3, 'dimensionless',
       f'Fr_lo=G^2/(rho_l^2 gD)={fr:.12g}<.04, so f_o=(25 Fr)^.3={(25*fr)**.3:.12g}.',
       '.488 is 25Fr before exponentiation; 1.00 uses the wrong branch; .699 uses a different exponent.')
assert set(questions)=={r['id'] for r in rows}
result=dict(auditor='Codex coverage audit numerical solver', baseline='925f6508a3369e428e3de90a4fe2b82f609dab01',
            frozen_at_utc=datetime.now(timezone.utc).isoformat(),
            input_sha256=hashlib.sha256(PACKET.read_bytes()).hexdigest(),
            key_exposure='No saved keys, answer-bearing question content, or prior receipt workings consulted before this file was first written. Prior report mentioned separate sample values; selected numeric sample excludes those specific prior sample questions.',
            selection='Deliberate stratification, not random; 32 questions from the 289 remaining receipts.',
            results=rows)
output=HERE/'blind-numeric-solutions.json'
output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(count=len(rows),packet_sha256=result['input_sha256'],solution_sha256=hashlib.sha256(output.read_bytes()).hexdigest()),indent=2))
for row in rows: print(row['id'], row['independent_choice_index'], row['computed_or_physical_result'])
