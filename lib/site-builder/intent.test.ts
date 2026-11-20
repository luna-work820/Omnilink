import {describe,it,expect} from 'vitest'
import {isWebsiteInstruction} from './intent'
describe('workbench website intent',()=>{
 it.each(['帮我创建网站','网站设计，冷白色，大幅商品图','修改网站首页','商品详情页显示规格'])('routes explicit instruction %s',prompt=>expect(isWebsiteInstruction(prompt)).toBe(true))
 it.each(['不要创建网站','取消生成','网站是什么','网站设计多少钱','帮我给商品定价',''])('keeps non-design intent out: %s',prompt=>expect(isWebsiteInstruction(prompt)).toBe(false))
 it('continues the same website context only when active',()=>{
  for(const prompt of ['暖一点','改成两列','间距大一点','重新生成']){expect(isWebsiteInstruction(prompt,true)).toBe(true);expect(isWebsiteInstruction(prompt,false)).toBe(false)}
  expect(isWebsiteInstruction('帮我给商品定价',true)).toBe(false)
 })
})
