import { Email } from '../../../../shared/domain/value-objects/Email.vo.js';
import { logger } from '../../../../shared/infrastructure/logger.js';
import { OtpCode } from '../../domain/value-objects/OtpCode.vo.js';
import { VerificationNotFoundError, VerificationExpiredError, VerificationBlockedError, InvalidOtpError, } from '../../domain/errors/Verification.errors.js';
const BLOCKED_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
export class VerifyEmailUseCase {
    verificationRepo;
    eventRepo;
    hasher;
    txRunner;
    constructor(verificationRepo, eventRepo, hasher, txRunner) {
        this.verificationRepo = verificationRepo;
        this.eventRepo = eventRepo;
        this.hasher = hasher;
        this.txRunner = txRunner;
    }
    async execute(dto) {
        const email = Email.fromPrimitive(dto.email);
        const code = OtpCode.fromPrimitive(dto.code);
        // All DB writes happen inside the transaction.
        // Domain errors are NOT thrown inside run() — they are returned as outcome values
        // so that the transaction commits successfully before the error reaches the caller.
        const outcome = await this.txRunner.run(async (tx) => {
            // SELECT FOR UPDATE — lock the row within this transaction
            const verification = await this.verificationRepo.findPendingByEmailForUpdate(email, tx);
            if (verification === null) {
                return { kind: 'not_found' };
            }
            if (verification.isExpired()) {
                verification.expire();
                await this.verificationRepo.save(verification, tx);
                return {
                    kind: 'expired',
                    verificationId: verification.getId().toPrimitive(),
                    email: email.toPrimitive(),
                };
            }
            const result = verification.attempt(code, this.hasher);
            await this.verificationRepo.save(verification, tx);
            if (result === 'used') {
                return {
                    kind: 'used',
                    verificationId: verification.getId().toPrimitive(),
                    usedAt: verification.getUsedAt(),
                    email: email.toPrimitive(),
                };
            }
            if (result === 'blocked') {
                return {
                    kind: 'blocked',
                    verificationId: verification.getId().toPrimitive(),
                    blockedAt: verification.getBlockedAt(),
                    email: email.toPrimitive(),
                };
            }
            // wrong_code
            return {
                kind: 'wrong_code',
                verificationId: verification.getId().toPrimitive(),
                attemptsRemaining: verification.getMaxAttempts() - verification.getAttempts(),
                email: email.toPrimitive(),
            };
        });
        // Post-commit: fire-and-forget events and throw domain errors
        switch (outcome.kind) {
            case 'not_found':
                throw new VerificationNotFoundError(email.toPrimitive());
            case 'expired':
                this.eventRepo
                    .save({ email: outcome.email, type: 'expired', verificationId: outcome.verificationId })
                    .catch((err) => logger.warn({ err }, '[VerifyEmail] Failed to save event'));
                throw new VerificationExpiredError();
            case 'used':
                this.eventRepo
                    .save({ email: outcome.email, type: 'verified', verificationId: outcome.verificationId })
                    .catch((err) => logger.warn({ err }, '[VerifyEmail] Failed to save event'));
                return { verificationId: outcome.verificationId, usedAt: outcome.usedAt };
            case 'blocked': {
                this.eventRepo
                    .save({ email: outcome.email, type: 'blocked', verificationId: outcome.verificationId })
                    .catch((err) => logger.warn({ err }, '[VerifyEmail] Failed to save event'));
                const retryAfter = new Date(outcome.blockedAt.getTime() + BLOCKED_COOLDOWN_MS);
                throw new VerificationBlockedError(retryAfter);
            }
            case 'wrong_code':
                this.eventRepo
                    .save({
                    email: outcome.email,
                    type: 'attempt_failed',
                    metadata: { attemptsRemaining: outcome.attemptsRemaining },
                    verificationId: outcome.verificationId,
                })
                    .catch((err) => logger.warn({ err }, '[VerifyEmail] Failed to save event'));
                throw new InvalidOtpError(outcome.attemptsRemaining);
        }
    }
}
