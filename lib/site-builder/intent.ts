export function isWebsiteInstruction(prompt:string,continuing=false){
  const text=prompt.trim()
  if(!text)return false
  if(/(不要|别|不想|停止|取消|不用|无需).{0,12}(建站|网站|网页|首页|导航|详情页)/.test(text)||/^(取消|停止)(生成|构建|修改|任务)?[。！!\s]*$/.test(text))return false
  if(/(建站|网站设计|设计网站|创建网站|制作网站|搭建网站|修改网站|网站首页|网站导航|网页设计|店铺首页|商品详情页|首页|网站|网页)/.test(text)){
    if(/(是什么|什么意思|是否|能不能|可以吗|区别|如何|怎么做|多少钱)[？?]?\s*$/.test(text)&&!/(帮我|给我|请|直接|开始).*(设计|创建|生成|修改|建站)/.test(text))return false
    return true
  }
  return continuing&&/(改|换|调整|大一点|小一点|暖一点|冷一点|简洁|颜色|布局|两列|三列|字号|图片|风格|间距|留白|重新生成|重试)/.test(text)
}
