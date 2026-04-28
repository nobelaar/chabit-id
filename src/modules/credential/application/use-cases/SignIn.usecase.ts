import { CredentialRepository } from '../../domain/ports/CredentialRepository.port.js';
import { SessionRepository } from '../../domain/ports/SessionRepository.port.js';
import { PasswordHasher } from '../../domain/ports/PasswordHasher.port.js';
import { TokenService } from '../../domain/ports/TokenService.port.js';
import { AccountQueryPort } from '../../domain/ports/AccountQueryPort.port.js';
import { IdentityQueryPort } from '../../domain/ports/IdentityQueryPort.port.js';
import { Email } from '../../../../shared/domain/value-objects/Email.vo.js';
import { RawPassword } from '../../domain/value-objects/RawPassword.vo.js';
import { Session } from '../../domain/entities/Session.entity.js';
import { InvalidCredentialsError } from '../../domain/errors/Credential.errors.js';

const MAX_SESSIONS = 10;

export interface SignInDto {
  email: string;
  password: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface SignInResult {
  accessToken: string;
  updateToken: string;
}

export class SignInUseCase {
  constructor(
    private readonly credentialRepo: CredentialRepository,
    private readonly sessionRepo: SessionRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokenService: TokenService,
    private readonly accountQuery: AccountQueryPort,
    private readonly identityQuery: IdentityQueryPort,
  ) {}

  async execute(dto: SignInDto): Promise<SignInResult> {
    const email = Email.fromPrimitive(dto.email);
    const identityRef = await this.identityQuery.findIdentityRefByEmail(email);
    if (!identityRef) throw new InvalidCredentialsError();

    const credential = await this.credentialRepo.findByIdentityRef(identityRef);
    if (!credential) throw new InvalidCredentialsError();

    const match = await this.hasher.compare(RawPassword.fromPrimitive(dto.password), credential.getPasswordHash());
    if (!match) throw new InvalidCredentialsError();

    // Clean up expired sessions, enforce max
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
