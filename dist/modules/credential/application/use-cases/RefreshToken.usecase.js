import { UpdateToken } from '../../domain/value-objects/UpdateToken.vo.js';
import { CredentialNotFoundError, SessionNotFoundError, SessionExpiredError } from '../../domain/errors/Credential.errors.js';
export class RefreshTokenUseCase {
    credentialRepo;
    sessionRepo;
    tokenService;
    accountQuery;
    constructor(credentialRepo, sessionRepo, tokenService, accountQuery) {
        this.credentialRepo = credentialRepo;
        this.sessionRepo = sessionRepo;
        this.tokenService = tokenService;
        this.accountQuery = accountQuery;
    }
    async execute(dto) {
        const token = UpdateToken.fromPrimitive(dto.updateToken);
        const session = await this.sessionRepo.findByUpdateToken(token);
        if (!session)
            throw new SessionNotFoundError();
        if (session.isExpired())
            throw new SessionExpiredError();
        const credential = await this.credentialRepo.findById(session.getCredentialId());
        if (!credential)
            throw new CredentialNotFoundError();
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
