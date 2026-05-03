export class TotpAlreadyEnabledError extends Error {
  constructor() { super('2FA is already enabled'); this.name = 'TotpAlreadyEnabledError'; }
}

export class TotpNotEnabledError extends Error {
  constructor() { super('2FA is not enabled'); this.name = 'TotpNotEnabledError'; }
}

export class TotpNotSetupError extends Error {
  constructor() { super('2FA setup not started — call /auth/2fa/setup first'); this.name = 'TotpNotSetupError'; }
}

export class InvalidTotpCodeError extends Error {
  constructor() { super('Invalid or expired 2FA code'); this.name = 'InvalidTotpCodeError'; }
}

export class InvalidChallengeTokenError extends Error {
  constructor() { super('Invalid or expired challenge token'); this.name = 'InvalidChallengeTokenError'; }
}
