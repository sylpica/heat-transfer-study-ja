import hashlib,json,unittest
from pathlib import Path
import numpy as np
from independent_pressure import neumann,projection_checks,manufacture_checks,lid_checks
from graetz_reference import reference
from independent_channel import evaluate

OUT=Path(__file__).resolve().parents[2]/'docs/dynamic/support-forced'
def read(name):return json.loads((OUT/name).read_text())

class IndependentChecks(unittest.TestCase):
    def test_neumann_manufactured_modes_and_density_units(self):
        n=20;h=.07;j,i=np.meshgrid(np.arange(n),np.arange(n),indexing='ij')
        exact=np.cos(np.pi*3*(i+.5)/n)*np.cos(np.pi*5*(j+.5)/n)
        ev=4/h**2*(np.sin(np.pi*3/(2*n))**2+np.sin(np.pi*5/(2*n))**2)
        self.assertLess(abs(neumann(ev*exact,h)-exact).max(),1e-14)
        self.assertLess(abs(neumann(1000*ev*exact,h)-1000*exact).max(),1e-10)

    def test_independent_projection_lu_gauge_and_velocity(self):
        rows=projection_checks(read('PRESSURE_CASES.json'),read('PRESSURE_PROJECTION_FRESH.json'))
        self.assertEqual(len(rows),6)
        for r in rows:
            self.assertTrue(all(i>0 for i in r['iterations']))
            self.assertLess(r['pcgVersusDctMaxPa'],1e-9)
            self.assertLess(r['correctedVelocityMaximumDifference'],1e-9)
            self.assertLess(r['initialConstantGaugeDifferencePa'],1e-9)
        self.assertLess(rows[0]['denseGraphLuVersusDctMaxPa'],1e-9)

    def test_continuous_forcing_separates_space_time_and_pcg(self):
        rows=manufacture_checks(read('PRESSURE_CASES.json'))
        for r in rows:self.assertLess(r['independentOldTimeVersusPcgMaxPa'],1e-8)
        zero=[r for r in rows if r['velocityAmplitude']==0]
        for r in zero:
            self.assertLess(r['analyticDiscreteMaxDifferencePa'],1e-12)
            self.assertAlmostEqual(r['returnedPressureRelativeRmsLag'],r['zOverSinZ']-1,places=12)
        moving=[r for r in rows if r['velocityAmplitude']==1 and r['steps']==2048]
        for a,b in zip(moving,moving[1:]):
            self.assertGreater(np.log2(a['returnedPressureRelativeRmsEnd']/b['returnedPressureRelativeRmsEnd']),1.9)
        # This is an observed unresolved accuracy limitation, never a pass gate.
        self.assertGreater(moving[-1]['returnedPressureRelativeRmsEnd'],.06)

    def test_lid_cross_method_reconstruction_is_numerical_not_exact(self):
        r=lid_checks();self.assertFalse(r['externalExactPressureBenchmark'])
        diffs=[s['differenceVersusPsiOmega128Rms'] for s in r['macComparisons']]
        self.assertTrue(all(a>b for a,b in zip(diffs,diffs[1:])))
        self.assertLess(diffs[-1],.001)
        self.assertGreater(r['psiOmega64Versus128Rms'],0)

    def test_independent_continuous_graetz_solutions(self):
        r=reference();self.assertAlmostEqual(r['equalFlux']['nusselt'],140/17,places=14)
        self.assertLess(r['equalWallTemperature']['relativeSeriesShootingDifference'],1e-9)
        self.assertLess(r['equalWallTemperature']['relativeFluxIntegralDifference'],1e-9)

    def test_existing_channels_match_momentum_integrals_and_thermal_limits(self):
        r=evaluate(read('CHANNEL_CASES.json'),read('GRAETZ_CONTINUOUS.json'))
        for p in r['pressure']:self.assertLess(p['relativeDifference'],1e-12)
        for bnd in ['wall-heat-flux','wall-temperature']:
            series=[s for s in r['graetz'] if s['boundary']==bnd]
            self.assertTrue(all(abs(a['relativeNuDifference'])>abs(b['relativeNuDifference']) for a,b in zip(series,series[1:])))
            self.assertLess(abs(series[-1]['relativeNuDifference']),.001)
            self.assertLess(max(s['energyRelativeResidual'] for s in series),1e-10)
        q=r['graetz'][-2]
        self.assertLess(q['quarticCellMeanMaximumErrorK'],.001)
        self.assertLess(q['bulkAbsoluteErrorK'],1e-8)

    def test_archived_input_and_generator_provenance(self):
        for name in ['INDEPENDENT_PRESSURE.json','INDEPENDENT_CHANNEL.json']:
            data=read(name)
            for path,expected in data['inputsSHA256'].items():
                self.assertEqual(hashlib.sha256((OUT/path).read_bytes()).hexdigest(),expected)
        mapping={'INDEPENDENT_PRESSURE.json':'independent_pressure.py','INDEPENDENT_CHANNEL.json':'independent_channel.py','GRAETZ_CONTINUOUS.json':'graetz_reference.py'}
        for record,script in mapping.items():self.assertEqual(read(record)['generatorSHA256'],hashlib.sha256(Path(__file__).with_name(script).read_bytes()).hexdigest())

if __name__=='__main__':unittest.main()
