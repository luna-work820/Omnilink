// UTF-8 bytes are a conservative packing allowance, not provider-reported token usage.
export function packContextItems<T>(items:T[], allowance:number) {
  let used=2
  const kept:T[]=[]
  for(const item of items) {
    const size=Buffer.byteLength(JSON.stringify(item),'utf8')+1
    if(used+size>allowance)continue
    kept.push(item);used+=size
  }
  return {items:kept,budget:{allowance,used,omitted:items.length-kept.length,unit:'utf8-bytes' as const}}
}
export function clipContextText(value:string,allowance:number) {
  let used=0,text=''
  for(const character of value) {
    const size=Buffer.byteLength(character,'utf8')
    if(used+size>allowance)break
    text+=character;used+=size
  }
  return {text,budget:{allowance,used,truncated:text.length!==value.length,unit:'utf8-bytes' as const}}
}
