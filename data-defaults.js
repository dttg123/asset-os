'use strict';
function buildIntegratedSeed(){return {mode:'live',label:'내 통합 거래기록',startedAt:'',accounts:[{id:'cash-main',kind:'cash',name:'현금·입출금'},{id:'isa-link',kind:'isa',name:'ISA 연결'},{id:'pension-link',kind:'pension',name:'연금저축 연결'},{id:'irp-link',kind:'irp',name:'IRP 연결'}],liabilities:[],ledger:[]}}
const seed={
 settings:{theme:'light',accent:'blue',fab:false,haptics:true,selectedAccountId:'',txFilter:'all',compositionGroup:'',compositionFocus:'',dividendCompositionFocus:'',dividendPeriod:'month',dividendKey:'',policyTab:'isa',pensionGoalExpanded:false,pensionAssetScope:'all',pensionAssetLens:'assetClass',pensionAssetFocus:'',integratedMonth:'',integratedLedgerFilter:'all',backupV04:{phoneEnabled:false,lastPhoneBackupAt:'',lastReleaseVersion:'',phonePermission:'unknown'}},
 policies:{
  isa:{activePolicyId:'isa-policy-2026-official',versions:[{id:'isa-policy-2026-official',kind:'isa',name:'현행 ISA 2026',version:'2026.07',status:'current',sourceLabel:'법제처·국세청',verifiedAt:'2026-07-30',userEdited:false,policySetId:'isa-policy-set-current',concurrentAccountLimit:1,coexistWithOtherIsa:false,annualLimitScope:'person',generalExemption:2000000,lowIncomeExemption:4000000,farmerExemption:4000000,taxRate:.099,annualLimit:20000000,mandatoryYears:3,transferDeductionRate:.10,transferDeductionMax:3000000,taxCreditRate:.132,effectiveFrom:'2026-01-01'}]},
  pension:{activePolicyId:'pension-policy-2026-official',versions:[{id:'pension-policy-2026-official',kind:'pension',name:'연금저축 제도 2026',version:'2026.08',status:'current',sourceLabel:'국가법령정보센터·국세청',verifiedAt:'2026-08-18',userEdited:false,annualContributionLimit:18000000,annualTaxCreditLimit:6000000,combinedTaxCreditLimit:9000000,taxCreditRate:.132,lowIncomeTaxCreditRate:.165,effectiveFrom:'2026-01-01'}]},
  irp:{activePolicyId:'irp-policy-2026-official',versions:[{id:'irp-policy-2026-official',kind:'irp',name:'IRP 제도 2026',version:'2026.07',status:'current',sourceLabel:'법제처·국세청',verifiedAt:'2026-07-30',userEdited:false,combinedTaxCreditLimit:9000000,taxCreditRate:.132,lowIncomeTaxCreditRate:.165,riskyAssetLimit:.70,effectiveFrom:'2026-01-01'}]}
 },
 accounts:[],
 pension:{
  goal:{pensionSavings:0,irp:0},
  accounts:[],

  contributions:[],transactions:[],holdings:[],incomes:[],assetSnapshots:[],
  projection:{birthYear:0,retirementAge:65,yearsToRetire:0,monthlyContribution:0,annualReturn:.06,withdrawalRate:.03,inflationRate:.02}
 },
 financialProducts:{items:[],events:[]},financeSchedules:{items:[]},insurance:{policies:[]},sourceArchives:{records:[]},moduleVerification:{isa:false,pension:false,irp:false},brokerKis:brokerKisEmptyStore(),integrated:buildIntegratedSeed()
};
