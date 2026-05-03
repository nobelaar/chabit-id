import { CredentialRepository } from '../../domain/ports/CredentialRepository.port.js';
import { SessionRepository } from '../../domain/ports/SessionRepository.port.js';
import { PasswordHasher } from '../../domain/ports/PasswordHasher.port.js';
import { TokenService } from '../../domain/ports/TokenService.port.js';
import { AccountQueryPort } from '../../domain/ports/AccountQueryPort.port.js';
import { Username } from '../../domain/value-objects/Username.vo.js';
import { RawPassword } from '../../domain/value-objects/RawPassword.vo.js';
import { Session } from '../../domain/entities/Session.entity.js';
import { InvalidCredentialsError, AccountLockedError } from '../../domain/errors/Credential.errors.js';

const MAX_SESSIONS = 10;

export interface SignInDto {
  username: string;
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
  ) {}

  async execute(dto: SignInDto): Promise<SignInResult> {
    const username = Username.fromPrimitive(dto.username);
    const credential = await this.credentialRepo.findByUsername(username);
    if (!credential) throw new InvalidCredentialsError();

    if (credential.isLocked()) throw new AccountLockedError(credential.getLockedUntil()!);

    const match = await this.hasher.compare(RawPassword.fromPrimitive(dto.password), credential.getPasswordHash());
    if (!match) {
      credential.recordFailedAttempt();
      await this.credentialRepo.save(credential);
      throw new InvalidCredentialsError();
    }

    credential.resetFailedAttempts();
    await this.credentialRepo.save(credential);

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
