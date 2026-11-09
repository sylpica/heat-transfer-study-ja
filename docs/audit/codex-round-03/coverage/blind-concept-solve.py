#!/usr/bin/env python3
"""Freeze conceptual judgments without consulting answer-bearing files."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
packet_path = HERE / 'blind-concept-packet.json'
packet = json.loads(packet_path.read_text())
rows = []

def record(question_id, choice, working, alternatives, qualification=None):
    row = dict(id=question_id, independent_choice_index=choice,
               working=working, alternative_choices_review=alternatives)
    if qualification:
        row['qualification'] = qualification
    rows.append(row)

record('supp-deep-rate-vs-state-v1', 3,
       'Temperature is a state variable. A rate requires a mechanism law and its boundary data: for example Fourier conduction needs conductivity and a gradient, convection needs h and fluid temperature, and radiation needs the radiative environment.',
       'Temperature times area lacks power units; absolute high temperature does not establish an outward sign; a steady body can pass heat through it.')
record('supp-found-slab-nonlinear-limit-v1', 3,
       'For constant k, the steady one-dimensional balance is k T_xx + q_gen = 0. Positive uniform generation therefore gives nonzero curvature T_xx = -q_gen/k.',
       'A nonzero generation term precludes a universally constant gradient; thickness and surface boundary conditions continue to affect the solution; prescribed surface temperatures do not require zero flux.')
record('supp-found-ntu-config-v1', 3,
       'Effectiveness follows the coupled stream energy balances and boundary conditions. Parallel and counterflow arrangements have different inlet boundary placement and generally different epsilon(NTU, Cr) functions.',
       'NTU alone omits Cr and configuration; Cr still matters in counterflow; equality at special limiting conditions does not make effectiveness universally identical.')
record('supp-next-local-versus-average-v1', 3,
       'The mean coefficient for a constant-width plate is (1/L) integral_0^L h(x) dx, whereas h_L samples a single position. The mean requires the distribution.',
       'A varying positive h does not average to zero, and an endpoint alone does not determine an integral.',
       'Read the answer as distinguishing the quantities and their definitions: specially constructed nonmonotone distributions can have mean equal to the endpoint despite variation, so literal universal numerical inequality is too strong.')
record('supp-batch3-pure-neumann-unique-v1', 3,
       'If T solves the compatible constant-k pure-Neumann problem, T+C has exactly the same gradient and boundary flux for any constant C. A point temperature or prescribed mean fixes this constant.',
       'Neither zero flux nor k fixes an absolute Celsius reference; the stated global compatibility condition addresses existence rather than uniqueness of the temperature offset.')
record('supp-batch3-variable-k-equation-v1', 3,
       'Energy conservation uses divergence of Fourier heat flux: div(k(T) grad T). Expanding it produces k Laplacian(T) + (dk/dT)|grad T|^2, so k cannot generally be moved outside the divergence.',
       'Conservation still applies, and conduction flux remains linked to the temperature gradient. Laplacian(T)=0 alone drops the conductivity derivative.')
record('supp-minimum-negative-slope-feedback-v1', 2,
       'Linearize about P=A q(T0): C d(deltaT)/dt=-A q_prime(T0) deltaT. For positive physical area and C with q_prime<0, the perturbation grows: an increase in T lowers heat removal.',
       'P is explicitly fixed, C stays positive, and the negative slope means removal decreases rather than increases.')
record('supp-tube-boiling-equilibrium-quality-v1', 0,
       'x_eq<0 means h<h_f at the local pressure, on the subcooled-liquid side of the equilibrium saturation interval. It is an enthalpy coordinate outside [0,1], not a negative physical vapor mass fraction.',
       'Neither negative vapor flow nor negative area follows; the superheated-vapor side would have x_eq>1.')
record('supp-film-radiation-coupling-v1', 0,
       'Additional radiation changes heat delivery to the liquid interface and evaporation; these can change vapor-film thickness and the conductive film coefficient. Applicability of simple addition must be checked against a coupled model and its boundary conditions.',
       'Distinct mechanisms can still interact through the state; a vapor film does not force radiation to zero; a gray-surface evaluation does not supply all film boundary conditions.')
record('supp-forced-condensation-opposing-shear-v1', 0,
       'An opposing interfacial shear contributes with sign to the momentum balance. In a local planar-film solution its contribution to the drainage rate is rho_l tau_i delta^2/(2 mu_l); upward tau_i opposes gravity drainage and can alter thickness or invalidate the assumed regime.',
       'The effect depends on shear direction; small film Reynolds number does not imply zero interface shear; external plates and internal condensation have different geometrical and dynamical conditions.')
record('supp-dropwise-distribution-not-mean-v1', 1,
       'Total heat rate depends on the population integral of individual-drop transfer, covered area, nucleation and departure. Equality of one mean diameter does not determine these nonlinear contributions.',
       'Equal mean size cannot eliminate dynamics, force identical heat-transfer coefficients, or remove conduction resistance through drops.')
record('supp-kirchhoff-steady-versus-equilibrium-v1', 2,
       'At steady temperature, external absorption and emission can have a nonzero difference balanced by active cooling. Zero storage is an overall steady energy balance, whereas radiative thermal equilibrium requires the appropriate radiative detailed balance.',
       'Steadiness does not set all rates to zero or alter material properties to unity, and it does not require matching absorption and emission at each wavelength.')
record('supp-fick-stagnant-versus-equimolar-v1', 3,
       'Fixed-frame stagnancy of B imposes N_B=0, and N_A is nonzero. Thus N_total=N_A, and N_A=J_A+y_A N_A includes the molar-average convective contribution (Stefan flow).',
       'Equimolar counterdiffusion would require N_B=-N_A; setting N_A or J_A to zero contradicts or unnecessarily restricts the supplied situation.')
record('supp-condensation-gamma-shape-v1', 1,
       'Under the thin-film, negligible inertia and negligible interface-shear approximation, integrating the local balance mu u_yy=-(rho_l-rho_v) g_t gives a parabolic velocity profile. Integrating velocity over film thickness yields Gamma=rho_l(rho_l-rho_v) g_t delta^3/(3 mu_l); geometry enters the tangential gravity and local film thickness.',
       'Film thickness is not universal; constant gravitational magnitude does not imply constant tangential driving; the linear temperature assumption does not itself determine momentum integration.',
       'The displayed g must mean the local tangential gravity component. If interpreted as the constant magnitude, the claim of validity at every point on a cylinder or sphere is false. The selected option explicitly supplies g(x), so its intended interpretation is recoverable.')
record('supp-tube-correlation-orientation-placement-v1', 2,
       'In the Kandlikar branch structure the horizontal-flow factor modifies the convection-dominated Co contribution. The nucleate-boiling Boi contribution retains its own fluid/surface factor F. Thus the branch is R[a Co^m f_o + b Boi^n F].',
       'Putting f_o on the nucleate term, taking its reciprocal, or applying it to both terms changes the specified physical branch dependence.')
record('supp-natural-geometry-cylinder-range-v1', 3,
       'Ra_D=2e10 exceeds the stated upper applicability limit 1e9 by a factor of 20. The finite algebraic value is not evidence of validity; an applicable regime and geometry correlation is needed.',
       'Finiteness does not justify extrapolation; a sphere has different geometry; replacing length by area is dimensionally invalid.')

assert {row['id'] for row in rows} == set(packet['ids'])
result = dict(
    auditor='Codex resumed coverage audit conceptual solver',
    baseline='925f6508a3369e428e3de90a4fe2b82f609dab01',
    frozen_at_utc=datetime.now(timezone.utc).isoformat(),
    input_sha256=hashlib.sha256(packet_path.read_bytes()).hexdigest(),
    key_exposure='Only the answer-free conceptual packet and preserved numerical solution files were inspected before freezing these conceptual judgments. No current question keys or prior receipt workings were consulted.',
    selection='Sixteen deliberately stratified conceptual questions; not a random statistical sample.',
    results=rows)
output_path = HERE / 'blind-concept-solutions.json'
if output_path.exists():
    raise SystemExit('Frozen output already exists; refusing to overwrite it.')
output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
print(json.dumps(dict(count=len(rows), packet_sha256=result['input_sha256'],
                     solution_sha256=hashlib.sha256(output_path.read_bytes()).hexdigest()), indent=2))
