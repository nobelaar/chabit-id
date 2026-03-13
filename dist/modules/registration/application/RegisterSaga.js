import { VerificationId } from '../../verification/domain/value-objects/VerificationId.vo.js';
import { IdentityId } from '../../identity/domain/value-objects/IdentityId.vo.js';
import { CredentialId } from '../../credential/domain/value-objects/CredentialId.vo.js';
import { IdentityRef } from '../../../shared/domain/value-objects/IdentityRef.vo.js';
import { EmailNotVerifiedError } from '../../identity/domain/errors/Identity.errors.js';
import { logger } from '../../../shared/infrastructure/logger.js';
export class RegisterSaga {
    verificationRepo;
    createIdentity;
    identityRepo;
    createCredential;
    credentialRepo;
    createAccount;
    accountRepo;
    signIn;
    constructor(verificationRepo, createIdentity, identityRepo, createCredential, credentialRepo, createAccount, accountRepo, signIn) {
        this.verificationRepo = verificationRepo;
        this.createIdentity = createIdentity;
        this.identityRepo = identityRepo;
        this.createCredential = createCredential;
        this.credentialRepo = credentialRepo;
        this.createAccount = createAccount;
        this.accountRepo = accountRepo;
        this.signIn = signIn;
    }
    async execute(input) {
        // ── Guard: verify email verification ──────────────────────────────
        const verificationId = VerificationId.fromPrimitive(input.verificationId);
        const verification = await this.verificationRepo.findById(verificationId);
        if (!verification || !verification.getStatus().isUsed()) {
            throw new EmailNotVerifiedError();
        }
        if (verification.getEmail().toPrimitive() !== input.email.trim().toLowerCase()) {
            throw new EmailNotVerifiedError();
        }
        const emailVerifiedAt = verification.getUsedAt();
        // ── Step 1: CreateIdentity ─────────────────────────────────────────
        let identityId;
        try {
            const result = await this.createIdentity.execute({
                fullName: input.fullName,
                email: input.email,
                phone: input.phone,
                nationality: input.nationality,
                country: input.country,
                emailVerifiedAt,
            });
            identityId = result.identityId;
        }
        catch (err) {
            throw err; // no compensation needed — nothing was created yet
        }
        // ── Sub-step 1a: LinkVerificationToIdentity — fire & forget ────────
        try {
            const identityRef = IdentityRef.fromPrimitive(identityId);
            verification.linkToIdentity(identityRef);
            await this.verificationRepo.save(verification);
        }
        catch (err) {
            logger.warn({ err }, '[RegisterSaga] Sub-step 1a (LinkVerification) failed — tolerated');
        }
        // ── Step 2: CreateCredential ───────────────────────────────────────
        let credentialId;
        try {
            const result = await this.createCredential.execute({
                identityRef: identityId,
                username: input.username,
                password: input.password,
            });
            credentialId = result.credentialId;
        }
        catch (err) {
            // Compensate Step 1
            await this.identityRepo.hardDelete(IdentityId.fromPrimitive(identityId)).catch(e => logger.error({ err: e }, '[RegisterSaga] Compensation Step 1 failed'));
            throw err;
        }
        // ── Step 3: CreateAccount(USER) ────────────────────────────────────
        let accountId;
        try {
            const result = await this.createAccount.execute({
                identityRef: identityId,
                type: 'USER',
            });
            accountId = result.accountId;
        }
        catch (err) {
            // Compensate Step 2 then Step 1
            await this.credentialRepo.hardDelete(CredentialId.fromPrimitive(credentialId)).catch(e => logger.error({ err: e }, '[RegisterSaga] Compensation Step 2 failed'));
            await this.identityRepo.hardDelete(IdentityId.fromPrimitive(identityId)).catch(e => logger.error({ err: e }, '[RegisterSaga] Compensation Step 1 failed'));
            throw err;
        }
        // ── Step 4: SignIn ─────────────────────────────────────────────────
        // No compensation on failure — user exists, can sign in manually
        try {
            const tokens = await this.signIn.execute({
                username: input.username,
                password: input.password,
                userAgent: input.userAgent,
                ipAddress: input.ipAddress,
            });
            // suppress unused variable warning
            void accountId;
            return tokens;
        }
        catch (err) {
            // Don't compensate — identity/credential/account are valid
            // Client should sign in via POST /auth/sign-in
            logger.error({ err }, '[RegisterSaga] Step 4 (SignIn) failed — user registered but tokens not issued');
            throw err;
        }
    }
}
