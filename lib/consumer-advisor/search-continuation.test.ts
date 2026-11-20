import {describe,expect,it} from 'vitest'
import {discoverySpecSchema} from './discovery-contract'
import {applySearchPatch,ruleSearchPatch,hasRuleSearchPatch,searchPatchSchema} from './search-continuation'
const previous=discoverySpecSchema.parse({query:'100美元以内的耳环，不要珍珠',termGroups:[['耳环','earrings']],
  excludedTerms:['珍珠','pearl'],maxPrice:100,currency:'USD',deliveryCountry:'CN',requireVerifiedDelivery:true,
  retrieval:{mode:'hybrid',profile:'bge-small-zh-v1.5-512-v1'}})
describe('same-task search edits',()=>{
  it('never inserts defaults into an empty patch',()=>expect(searchPatchSchema.parse({})).toEqual({}))
  it.each(['换成金色','换金色','make them gold'])('keeps the budget, exclusion, category and delivery when editing %s',(prompt)=>{
    const next=applySearchPatch(previous,ruleSearchPatch(prompt,previous)!)
    expect(next).toMatchObject({maxPrice:100,currency:'USD',excludedTerms:['珍珠','pearl'],deliveryCountry:'CN',requireVerifiedDelivery:true,retrieval:previous.retrieval})
    expect(next.termGroups).toEqual([['耳环','earrings'],['金色','gold','golden']])
    expect(next.query).toContain('金色')
    expect(previous.termGroups).toHaveLength(1)
  })
  it.each([['50美元以内',50,'USD'],['under EUR 80',80,'EUR'],['under 40',40,'USD']])('changes only the explicit price fields in %s',(prompt,amount,currency)=>{
    const next=applySearchPatch(previous,ruleSearchPatch(prompt as string,previous)!)
    expect(next).toMatchObject({maxPrice:amount,currency,excludedTerms:previous.excludedTerms,deliveryCountry:'CN'})
  })
  it('clears restrictions only when explicitly requested',()=>{
    expect(applySearchPatch(previous,{maxPrice:null})).toMatchObject({maxPrice:null,excludedTerms:previous.excludedTerms})
    expect(applySearchPatch(previous,{excludedTerms:[],deliveryCountry:null})).toMatchObject({excludedTerms:[],requireVerifiedDelivery:false})
    expect(applySearchPatch(previous,{excludedTerms:['nickel'],addTermGroups:[['black onyx']]})).toMatchObject({excludedTerms:['珍珠','pearl','nickel'],termGroups:[['耳环','earrings'],['black onyx']]})
    expect(applySearchPatch(previous,ruleSearchPatch('取消预算',previous)!)).toMatchObject({minPrice:null,maxPrice:null})
  })
  it('does not treat a new topic, compound request or question as a bounded edit',()=>{
    for(const prompt of ['你好','换个话题','换成金色而且不要玻璃','重新找100欧元以内的项链','金色适合我吗？'])expect(hasRuleSearchPatch(prompt)).toBe(false)
  })
  it('retains explicit hard requirements while changing a selected color',()=>{
    const first=applySearchPatch(previous,{addTermGroups:[['cotton']]})
    const black=applySearchPatch(first,ruleSearchPatch('只要黑色',first)!)
    const white=applySearchPatch(black,ruleSearchPatch('换成白色',black)!)
    expect(white.requiredTermGroups).toEqual([['cotton'],['白色','white']])
    expect(white.termGroups).not.toContainEqual(['黑色','black'])
    expect(white.maxPrice).toBe(100)
  })
  it('drops an old keyword category when that category is explicitly replaced',()=>{
    const prior=discoverySpecSchema.parse({...previous,query:'裙子',termGroups:[['裙子']],requiredTermGroups:[['裙子']],categoryTerm:'裙子'})
    const next=applySearchPatch(prior,{termGroups:[['裤子']]})
    expect(next.categoryTerm).toBeUndefined()
    expect(next.requiredTermGroups).toEqual([])
    expect(next.termGroups).toEqual([['裤子']])
  })
  it('rejects contradictory prices and private execution settings instead of silently relaxing conditions',()=>{
    expect(()=>applySearchPatch({...previous,minPrice:80},{maxPrice:50})).toThrow()
    expect(searchPatchSchema.safeParse({retrieval:{profile:'wrong'}}).success).toBe(false)
    expect(searchPatchSchema.safeParse({excludedProductIds:[]}).success).toBe(false)
  })
})
