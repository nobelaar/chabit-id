import { generateSecret, generateURI } from 'otplib';
import { CredentialRepository } from '../../domain/ports/CredentialRepository.port.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { TotpAlreadyEnabledError } from '../../domain/errors/TOTP.errors.js';

export interface SetupTOTPResult {
  secret: string;
  otpauthUrl: string;
}

export class SetupTOTPUseCase {
  constructor(private readonly credentialRepo: CredentialRepository) {}

  async execute(identityRef: string): Promise<SetupTOTPResult> {
    const credential = await this.credentialRepo.findByIdentityRef(IdentityRef.fromPrimitive(identityRef));
    if (!credential) throw new Error('Credential not found');
    if (credential.isTotpEnabled()) throw new TotpAlreadyEnabledError();

    const secret = generateSecret();
    const otpauthUrl = generateURI({ issuer: 'Chabit', label: identityRef, secret, strategy: 'totp' });

    credential.setupTotp(secret);
    await this.credentialRepo.save(credential);

    return { secret, otpauthUrl };
  }
}
