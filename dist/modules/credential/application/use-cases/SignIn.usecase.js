import { Username } from '../../domain/value-objects/Username.vo.js';
import { RawPassword } from '../../domain/value-objects/RawPassword.vo.js';
import { Session } from '../../domain/entities/Session.entity.js';
import { InvalidCredentialsError } from '../../domain/errors/Credential.errors.js';
const MAX_SESSIONS = 10;
export class SignInUseCase {
    credentialRepo;
    sessionRepo;
    hasher;
    tokenService;
    accountQuery;
    constructor(credentialRepo, sessionRepo, hasher, tokenService, accountQuery) {
        this.credentialRepo = credentialRepo;
        this.sessionRepo = sessionRepo;
        this.hasher = hasher;
        this.tokenService = tokenService;
        this.accountQuery = accountQuery;
    }
    async execute(dto) {
        const username = Username.fromPrimitive(dto.username);
        const credential = await this.credentialRepo.findByUsername(username);
        if (!credential)
            throw new InvalidCredentialsError();
        const match = await this.hasher.compare(RawPassword.fromPrimitive(dto.password), credential.getPasswordHash());
        if (!match)
            throw new InvalidCredentialsError();
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
