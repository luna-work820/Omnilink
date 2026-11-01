import { describe, expect, it } from 'vitest'
import { buildAdvisorProfile, buildProfileTaskResult, nextProfileQuestion, PROFILE_GOAL, PROFILE_QUESTIONS, profileQuestionMeta, profileQuestionOptions } from './profile-intake'
import { initialAdvisorQuestion, nextAdvisorQuestion } from './task-contract'

describe('first-use personal image intake', () => {
  it('advances through separate domains and stops after the final question', () => {
    let question: string | null = initialAdvisorQuestion(PROFILE_GOAL)
    const seen: string[] = []
    while (question) {
      seen.push(question)
      expect(profileQuestionOptions(question).length).toBeGreaterThan(0)
      question = nextAdvisorQuestion(PROFILE_GOAL, question)
    }
    expect(seen).toEqual(PROFILE_QUESTIONS.map((item) => item.prompt))
    expect(profileQuestionMeta(seen[0])).toMatchObject({ index: 1, section: '当前关注' })
    expect(profileQuestionMeta(seen.at(-1)!)).toMatchObject({ index: PROFILE_QUESTIONS.length, section: '头发与头皮' })
    expect(nextProfileQuestion(seen.at(-1)!)).toBeNull()
  })

  it('keeps skipped answers unknown and separates self-reported domains', () => {
    const answers = PROFILE_QUESTIONS.map(() => '跳过')
    answers[0] = '先全面了解自己'
    answers[2] = '简洁利落'
    answers[7] = '反复出现'
    answers[10] = '波浪'
    const profile = buildAdvisorProfile(answers)
    expect(profile.selfReported.style).toBe('简洁利落')
    expect(profile.selfReported.colors).toBeNull()
    expect(profile.selfReported.productReaction).toBe('反复出现')
    expect(profile.selfReported.hairTexture).toBe('波浪')
    const result = buildProfileTaskResult(answers)
    expect(result.mode).toBe('profile')
    expect(result.summary).toContain('已记录 4/13 项')
    expect(result.summary).toContain('咨询专业人士')
    expect(result.looks).toEqual([])
  })
})
