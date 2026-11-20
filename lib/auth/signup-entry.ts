export const SIGNUP_INVITATION_VERSION = 1
export const SIGNUP_DESTINATION = '/discover'

export function needsSignupInvitation(metadata: Record<string, unknown> | undefined) {
  return metadata?.signup_invitation_version === SIGNUP_INVITATION_VERSION
    && metadata?.signup_invitation_seen !== true
}

export function signupInvitationStorageKey(userId: string) {
  return `omnilink:signup-invitation:${SIGNUP_INVITATION_VERSION}:${userId}`
}
