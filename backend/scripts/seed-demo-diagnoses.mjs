import { diagnosisService } from '../services/diagnosisService.js';

// image1.png → Bob Brown (大肿块，重度吸烟者)
const id1 = await diagnosisService.createDiagnosis({
  patientId: 14,
  doctorId: 1,
  status: 'CREATED',
  clinicalContext: {
    clinicalIndication: 'Persistent cough for 3 months, hemoptysis, weight loss 5kg',
    examType: 'CT Chest with Contrast',
    examDate: '2025-11-29',
    smokingHistory: { status: 'current', packYears: 35, cigarettesPerDay: 20 },
    relevantHistory: 'COPD diagnosed 2020, occupational asbestos exposure, family history of lung cancer (father)'
  }
});
console.log('✅ Bob Brown (image1.png) → Diagnosis ID:', id1);

// image2.png → Jane Smith (小结节，偶然发现)
const id2 = await diagnosisService.createDiagnosis({
  patientId: 2,
  doctorId: 1,
  status: 'CREATED',
  clinicalContext: {
    clinicalIndication: 'Routine health screening, incidental finding on chest X-ray',
    examType: 'CT Chest without Contrast',
    examDate: '2025-11-29',
    smokingHistory: { status: 'never', packYears: 0 },
    relevantHistory: 'No significant medical history, non-smoker, office worker'
  }
});
console.log('✅ Jane Smith (image2.png) → Diagnosis ID:', id2);

console.log('\n📋 Image-Patient Mapping:');
console.log('   image1.png → Bob Brown (PID 14, Diagnosis', id1, ') - 高危吸烟者');
console.log('   image2.png → Jane Smith (PID 2, Diagnosis', id2, ') - 偶然发现');

process.exit(0);
