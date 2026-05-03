import { verifySync } from 'otplib';
import { CredentialRepository } from '../../domain/ports/CredentialRepository.port.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { TotpAlreadyEnabledError, TotpNotSetupError, InvalidTotpCodeError } from '../../domain/errors/TOTP.errors.js';

export class EnableTOTPUseCase {
  constructor(private readonly credentialRepo: CredentialRepository) {}

  async execute(identityRef: string, code: string): Promise<void> {
    const credential = await this.credentialRepo.findByIdentityRef(IdentityRef.fromPrimitive(identityRef));
    if (!credential) throw new Error('Credential not found');
    if (credential.isTotpEnabled()) throw new TotpAlreadyEnabledError();

    const secret = credential.getTotpSecret();
    if (!secret) throw new TotpNotSetupError();

    const result = verifySync({ token: code, secret, strategy: 'totp' });
    if (!result.valid) throw new InvalidTotpCodeError();

    credential.enableTotp();
    await this.credentialRepo.save(credential);
  }
}
