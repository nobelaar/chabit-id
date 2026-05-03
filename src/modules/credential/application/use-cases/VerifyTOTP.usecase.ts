import { verifySync } from 'otplib';
import { CredentialRepository } from '../../domain/ports/CredentialRepository.port.js';
import { SessionRepository } from '../../domain/ports/SessionRepository.port.js';
import { TokenService } from '../../domain/ports/TokenService.port.js';
import { AccountQueryPort } from '../../domain/ports/AccountQueryPort.port.js';
import { CredentialId } from '../../domain/value-objects/CredentialId.vo.js';
import { Session } from '../../domain/entities/Session.entity.js';
import { InvalidTotpCodeError, InvalidChallengeTokenError } from '../../domain/errors/TOTP.errors.js';

export interface VerifyTOTPDto {
  challengeToken: string;
  code: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface VerifyTOTPResult {
  accessToken: string;
  updateToken: string;
}

const MAX_SESSIONS = 10;

export class VerifyTOTPUseCase {
  constructor(
    private readonly credentialRepo: CredentialRepository,
    private readonly sessionRepo: SessionRepository,
    private readonly tokenService: TokenService,
    private readonly accountQuery: AccountQueryPort,
  ) {}

  async execute(dto: VerifyTOTPDto): Promise<VerifyTOTPResult> {
    let credentialId: string;
    try {
      credentialId = this.tokenService.verifyChallengeToken(dto.challengeToken);
    } catch {
      throw new InvalidChallengeTokenError();
    }

    const credential = await this.credentialRepo.findById(CredentialId.fromPrimitive(credentialId));
    if (!credential) throw new InvalidChallengeTokenError();

    const secret = credential.getTotpSecret();
    if (!secret) throw new InvalidChallengeTokenError();

    const result = verifySync({ token: dto.code, secret, strategy: 'totp' });
    if (!result.valid) throw new InvalidTotpCodeError();

    await this.sessionRepo.deleteExpiredByCredentialId(credential.getId());
    const activeCount = await this.sessionRepo.countActiveByCredentialId(credential.getId());
    if (activeCount >= MAX_SESSIONS) {
      await this.sessionRepo.deleteOldestByCredentialId(credential.getId());
    }

    const accounts = await this.accountQuery.getAccountsByIdentityRef(credential.getIdentityRef());
    const sessionId = this.tokenService.generateSessionId();
    const updateToken = this.tokenService.generateUpdateToken();

    const session = Session.create({
      id: sessionId,
      credentialId: credential.getId(),
      updateToken,
      userAgent: dto.userAgent,
      ipAddress: dto.ipAddress,
    });
    await this.sessionRepo.save(session);

    const accessToken = this.tokenService.generateAccessToken({
      sub: credential.getIdentityRef(),
      sid: sessionId,
      username: credential.getUsername().toPrimitive(),
      accounts,
    });

    return { accessToken, updateToken: updateToken.toPrimitive() };
  }
}
