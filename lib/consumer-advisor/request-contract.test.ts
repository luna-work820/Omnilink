import { describe, expect, it } from 'vitest'
import { requestIdentitySchema, resolveRequestIdentity, unifiedEntityRefSchema } from './request-contract'
const session = '10000000-0000-4000-8000-000000000001'
const user = '20000000-0000-4000-8000-000000000001'
describe('V2.1 minimal transport contract', () => {
  it('preserves legacy identifiers and derives the owner only from verified identity', () => {
    expect(resolveRequestIdentity({conversationId:session,messageId:'message_1',ownerId:session,userId:session},user))
      .toEqual({requestId:'message_1',session:{id:session,ownerId:user,version:1}})
  })
  it('allocates authoritative identifiers for new guest sessions', () => {
    const identity = resolveRequestIdentity({},null)
    expect(identity.session.ownerId).toBeNull()
    expect(identity.session.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(identity.requestId).toMatch(/^[0-9a-f-]{36}$/)
  })
  it.each([{sessionId:'bad-id'}, {messageId:'a/b'}, {requestId:'a',messageId:'b'},
    {sessionId:session,conversationId:'10000000-0000-4000-8000-000000000002'}])('rejects inconsistent identities %j', (input) => {
    expect(requestIdentitySchema.safeParse(input).success).toBe(false)
  })
  it('freezes typed entity references without treating them as authorization', () => {
    expect(unifiedEntityRefSchema.parse({type:'product',id:session,version:1})).toEqual({type:'product',id:session,version:1})
    expect(unifiedEntityRefSchema.safeParse({type:'product',id:'missing'}).success).toBe(false)
    expect(unifiedEntityRefSchema.safeParse({type:'product',id:session,authorized:true}).success).toBe(false)
  })
})
