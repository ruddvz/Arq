import assert from 'node:assert/strict'
import { adviseExpansion, loadConfigs, mergedBudget, validateAdaptiveConfig } from './zeus-adaptive-budget.mjs'

const configs = loadConfigs()

{
  const result = validateAdaptiveConfig(configs)
  assert.equal(result.ok, true, result.errors.join('\n'))
}

{
  const budget = mergedBudget('fast', configs)
  assert.equal(budget.sources, 4)
  assert.equal(budget.contextChars, 8000)
  assert.equal(budget.toolCallsBeforeReevaluation, 8)
  assert.equal(budget.parallelMutationLanes, 1)
}

{
  const result = adviseExpansion({
    tier: 'fast',
    category: 'sources',
    used: 1,
    expectedDecisionValue: false
  }, configs)
  assert.equal(result.allowed, false)
  assert.match(result.reason, /no expected decision/i)
}

{
  const result = adviseExpansion({
    tier: 'fast',
    category: 'sources',
    used: 2,
    expectedDecisionValue: true
  }, configs)
  assert.equal(result.allowed, true)
  assert.equal(result.reevaluate, false)
}

{
  const result = adviseExpansion({
    tier: 'fast',
    category: 'sources',
    used: 4,
    expectedDecisionValue: true
  }, configs)
  assert.equal(result.allowed, false)
  assert.equal(result.reevaluate, true)
  assert.equal(result.reasonRequired, true)
}

{
  const result = adviseExpansion({
    tier: 'deep',
    category: 'toolCallsBeforeReevaluation',
    used: 40,
    expectedDecisionValue: true,
    protectedProof: true
  }, configs)
  assert.equal(result.allowed, true)
  assert.equal(result.reevaluate, true)
  assert.equal(result.reasonRequired, true)
}

{
  assert.equal(configs.core.cache.criticalEvidenceCache, false)
  assert.equal(configs.adaptive.continualHarnessLifecycle.storeHiddenReasoning, false)
  assert.equal(configs.adaptive.telemetry.rawPrompt, false)
  assert.equal(configs.adaptive.telemetry.hiddenReasoning, false)
}

console.log('Zeus adaptive CTO budget tests: PASS')
