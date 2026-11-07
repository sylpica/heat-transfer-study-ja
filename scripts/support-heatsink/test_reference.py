from pathlib import Path
from dataclasses import replace
import hashlib,json,unittest
import numpy as np
from scipy.sparse.linalg import spsolve
from prototype import Conditions,build,solve,measure,allocate_flow
from validation import spreading_series,spreading_fv,single_fin,radiation_checks,flow_checks,actual_fin_block_limit

OUT=Path(__file__).resolve().parents[2]/'docs/dynamic/support-heatsink'
def read(name):return json.loads((OUT/name).read_text())

class ReferenceChecks(unittest.TestCase):
    def test_hydraulics_against_continuum_and_conservative_transfer(self):
        q=flow_checks(Conditions())
        self.assertLess(max(abs(x) for x in q['relativeMobilityErrors']),.02)
        self.assertLess(q['fixedFlowToPressureRoundTripRelativeError'],1e-12)
        self.assertLess(q['conservativeVelocityTransferMaximumRelativeError'],1e-12)
        self.assertLess(max(abs(x) for x in q['relativeFlowAllocationErrors']),.001)

    def test_stopped_flow_is_not_misrepresented_as_natural_convection(self):
        self.assertRaisesRegex(ValueError,'Natural convection',build,replace(Conditions(),flow=0))
        self.assertRaisesRegex(ValueError,'natural convection',allocate_flow,[.003],.03,.12,1.8e-5,12,16,flow=0)

    def test_spreading_fv_against_independent_cosine_solution(self):
        c=replace(Conditions(),fins=1,gap=.0195,patch_width=.01)
        a,b=spreading_series(c,320),spreading_series(c,640)
        self.assertLess(abs(a['totalSourceResistanceKPerW']/b['totalSourceResistanceKPerW']-1),1e-4)
        measured=spreading_fv(c,8)
        self.assertLess(abs(measured['sourceResistanceKPerW']/b['totalSourceResistanceKPerW']-1),.02)
        self.assertLess(measured['relativeEnergyResidual'],1e-8)

    def test_single_fin_efficiency_and_actual_two_dimensional_block_limit(self):
        a=single_fin(Conditions(),64)
        self.assertLess(a['relativeHeatError'],.002)
        self.assertLess(a['maximumRelativeCellMeanTemperatureError'],.002)
        q=actual_fin_block_limit(Conditions(),2)
        self.assertLess(q['relativeHeatError'],.002)
        self.assertLess(q['maximumAxialTemperatureVariationK'],1e-10)

    def test_gray_and_black_radiation_analytic_limits(self):
        q=radiation_checks()
        self.assertLess(q['grayTwoPlateRelativeError'],1e-12)
        self.assertLess(q['blackCavityOpeningRelativeError'],1e-12)
        self.assertLess(q['viewClosure'],1e-12)

    def test_no_source_uniform_temperature_and_zero_radiation_linear_limit(self):
        c=Conditions();a=build(replace(c,power=0),1,hydraulic_refinement=2);u,h=solve(a)
        self.assertEqual(float(abs(u).max()),0)
        a=build(replace(c,emissivity=0),1,hydraulic_refinement=2);u,h=solve(a)
        self.assertEqual(a['R'].nnz,0)
        self.assertLess(float(abs(u-spsolve(a['K'],a['b'])).max()),1e-9)
        q=measure(a,u,h);self.assertEqual(q['radiationOutwardW'],0)
        self.assertLess(q['relativeEnergyResidual'],1e-8)

    def test_final_archived_full_field_really_satisfies_the_assembled_system(self):
        data=read('REFERENCE_v2.json');row=data['cases'][2]
        field=np.load(OUT/row['field']);a=build(Conditions(),4,hydraulic_refinement=2)
        q=measure(a,field['theta'],row['nonlinearHistory'])
        self.assertLess(q['solidResidualMaximumW'],1e-9)
        self.assertLess(q['fluidResidualMaximumW'],1e-9)
        self.assertLess(q['relativeEnergyResidual'],1e-8)
        self.assertLess(abs(q['fluidInternalBalanceW']),1e-8)
        self.assertLess(abs(q['radiationInternalBalanceW']),1e-8)
        self.assertAlmostEqual(q['sourceAverageTemperatureK'],row['sourceAverageTemperatureK'],places=9)
        self.assertGreater(q['baseTemperatureRangeK'],1)

    def test_grid_objectives_and_failed_initial_evidence_are_retained(self):
        first=read('REFERENCE.json')['cases'][2];self.assertGreater(first['hydraulicMobilityRelativeError'],.02)
        initial=read('VALIDATION.json')['spreading']['fv'][-1];self.assertGreater(abs(initial['relativeResistanceError']),.02)
        rows=read('REFERENCE_v2.json')['cases'];a,b=rows[1],rows[2]
        for key in ['sourceAverageTemperatureK','maximumBaseCellTemperatureK']:
            self.assertLess(abs(a[key]-b[key])/(b[key]-300),.03)
        self.assertLess(b['hydraulicMobilityRelativeError'],.02)
        self.assertLess(b['sourceAverageTemperatureK'],rows[3]['sourceAverageTemperatureK'])
        self.assertGreater(b['radiationOutwardW'],0)

    def test_field_and_code_provenance(self):
        data=read('REFERENCE_v2.json')
        for row in data['cases']:self.assertEqual(hashlib.sha256((OUT/row['field']).read_bytes()).hexdigest(),row['fieldSHA256'])
        for name,expected in data['sourceSHA256'].items():
            self.assertEqual(hashlib.sha256(Path(__file__).with_name(name).read_bytes()).hexdigest(),expected)
        self.assertFalse(data['releaseApproved']);self.assertFalse(data['generalCFD'])

if __name__=='__main__':unittest.main()
