import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { assessmentMemoryProposal } from './assessment-memory-proposal'
import { assistantIdentityContext, readAiAssistantProfile } from './ai-assistant-profile'
import { memoryContext } from './ai-assistant-memory'
describe('assessment confirmation boundary', () => {
  it('keeps partial assessment results out of long term memory', async () => {
    expect(await assessmentMemoryProposal(readAiAssistantProfile({shoppingPreferenceSurvey:{status:'in_progress',answers:{A1:'home'}}}))).toBeNull()
  })
  it('captures the questionnaire version and raw evidence without claiming confirmation', async () => {
    const profile = readAiAssistantProfile({shoppingPreferenceSurvey:{status:'complete',version:'1.1.0',answers:{A1:'home'},skipped:[],ladders:{}}})
    const proposal = await assessmentMemoryProposal(profile)
    expect(proposal).toMatchObject({sourceKind:'assessment',origin:'inferred',sourcePayload:{assessmentVersion:'1.1.0',answers:{A1:'home'}}})
    expect(proposal).not.toHaveProperty('confirmedAt')
    expect(proposal).not.toHaveProperty('status','active')
  })
  it('does not infer confirmation from editable profile metadata', () => {
    expect(assistantIdentityContext({name:'Luna',preferences:{clothing:'UNCONFIRMED',other:''},shoppingPreferences:{style:'UNCONFIRMED'}}))
      .toEqual({name:'Luna',assistantName:'AI assistant'})
    expect(memoryContext([{id:'unconfirmed',domain:'other',text:'UNCONFIRMED',origin:'inferred',status:'proposed',evidence:null,sourceMessageId:null,supportIds:[],confirmedAt:null,revision:1,supersedeIds:[]}])).toBe('无')
  })
})
