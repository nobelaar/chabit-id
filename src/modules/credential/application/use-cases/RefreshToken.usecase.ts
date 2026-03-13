import { CredentialRepository } from '../../domain/ports/CredentialRepository.port.js';
import { SessionRepository } from '../../domain/ports/SessionRepository.port.js';
import { TokenService } from '../../domain/ports/TokenService.port.js';
import { AccountQueryPort } from '../../domain/ports/AccountQueryPort.port.js';
import { UpdateToken } from '../../domain/value-objects/UpdateToken.vo.js';
import { CredentialNotFoundError, SessionNotFoundError, SessionExpiredError } from '../../domain/errors/Credential.errors.js';

export interface RefreshTokenDto { updateToken: string; }
export interface RefreshTokenResult { accessToken: string; updateToken: string; }

export class RefreshTokenUseCase {
  constructor(
    private readonly credentialRepo: CredentialRepository,
    private readonly sessionRepo: SessionRepository,
    private readonly tokenService: TokenService,
    private readonly accountQuery: AccountQueryPort,
  ) {}

  async execute(dto: RefreshTokenDto): Promise<RefreshTokenResult> {
    const token = UpdateToken.fromPrimitive(dto.updateToken);
    const session = await this.sessionRepo.findByUpdateToken(token);
    if (!session) throw new SessionNotFoundError();
    if (session.isExpired()) throw new SessionExpiredError();

    const credential = await this.credentialRepo.findById(session.getCredentialId());
    if (!credential) throw new CredentialNotFoundError();

    const accounts = await this.accountQuery.getAccountsByIdentityRef(credential.getIdentityRef());
    const newToken = this.tokenService.generateUpdateToken();
    session.rotate(newToken);
    await this.sessionRepo.save(session);

    const accessToken = this.tokenService.generateAccessToken({
      sub: credential.getIdentityRef(),
      sid: session.getId(),
      username: credential.getUsername().toPrimitive(),
      accounts,
    });

    return { accessToken, updateToken: newToken.toPrimitive() };
  }
}
