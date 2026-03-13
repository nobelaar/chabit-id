export interface RequestEmailVerificationDto {
  email: string;
}

export interface RequestEmailVerificationResult {
  verificationId: number;
}

export interface VerifyEmailDto {
  email: string;
  code: string;
}

export interface VerifyEmailResult {
  verificationId: number;
  /** usedAt is needed by RegisterSaga as emailVerifiedAt for CreateIdentity */
  usedAt: Date;
}
