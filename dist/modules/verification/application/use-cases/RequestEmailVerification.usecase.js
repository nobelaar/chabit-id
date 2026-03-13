import { Email } from '../../../../shared/domain/value-objects/Email.vo.js';
import { logger } from '../../../../shared/infrastructure/logger.js';
import { EmailVerification } from '../../domain/entities/EmailVerification.entity.js';
import { VerificationBlockedError, VerificationCooldownError, HourlyLimitExceededError, EmailDeliveryError, DuplicatePendingVerificationError, } from '../../domain/errors/Verification.errors.js';
const BLOCKED_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
const REQUEST_COOLDOWN_MS = 60 * 1000; // 60 seconds
const HOURLY_LIMIT = 5;
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
export class RequestEmailVerificationUseCase {
    verificationRepo;
    eventRepo;
    hasher;
    generator;
    emailSender;
    constructor(verificationRepo, eventRepo, hasher, generator, emailSender) {
        this.verificationRepo = verificationRepo;
        this.eventRepo = eventRepo;
        this.hasher = hasher;
        this.generator = generator;
        this.emailSender = emailSender;
    }
    async execute(dto) {
        const email = Email.fromPrimitive(dto.email);
        // 1. Check latest verification for this email
        const latest = await this.verificationRepo.findLatestByEmail(email);
        if (latest !== null) {
            const now = new Date();
            // a. If BLOCKED and within cooldown window → reject
            if (latest.getStatus().isBlocked()) {
                const blockedAt = latest.getBlockedAt() ?? latest.getSentAt();
                const retryAfter = new Date(blockedAt.getTime() + BLOCKED_COOLDOWN_MS);
                if (now < retryAfter) {
                    throw new VerificationBlockedError(retryAfter);
                }
                // Cooldown expired — allow new request
            }
            else if (latest.getStatus().isPending()) {
                if (latest.isExpired()) {
                    // b. Pending but expired → expire it, no cooldown penalty
                    latest.expire();
                    const expiredId = latest.getId().toPrimitive();
                    const expiredEmail = email.toPrimitive();
                    await this.verificationRepo.save(latest);
                    this.eventRepo
                        .save({ email: expiredEmail, type: 'expired', verificationId: expiredId })
                        .catch((err) => logger.warn({ err }, '[RequestEmailVerification] Failed to save expired event'));
                }
                else {
                    // c. Still pending and not expired
                    const sentAt = latest.getSentAt();
                    const cooldownEnd = new Date(sentAt.getTime() + REQUEST_COOLDOWN_MS);
                    if (now < cooldownEnd) {
                        this.eventRepo
                            .save({ email: email.toPrimitive(), type: 'cooldown_rejected' })
                            .catch((err) => logger.warn({ err }, '[RequestEmailVerification] Failed to save cooldown_rejected event'));
                        throw new VerificationCooldownError(cooldownEnd);
                    }
                    // d. Cooldown passed → expire and continue
                    latest.expire();
                    const expiredId = latest.getId().toPrimitive();
                    const expiredEmail = email.toPrimitive();
                    await this.verificationRepo.save(latest);
                    this.eventRepo
                        .save({ email: expiredEmail, type: 'expired', verificationId: expiredId })
                        .catch((err) => logger.warn({ err }, '[RequestEmailVerification] Failed to save expired event'));
                }
            }
        }
        // 2. Hourly limit check
        const hourlyCount = await this.verificationRepo.countByEmailInLastHour(email);
        if (hourlyCount >= HOURLY_LIMIT) {
            this.eventRepo
                .save({ email: email.toPrimitive(), type: 'hourly_limit_exceeded' })
                .catch((err) => logger.warn({ err }, '[RequestEmailVerification] Failed to save event'));
            throw new HourlyLimitExceededError();
        }
        // 3. Generate OTP
        const code = this.generator.generate();
        const salt = this.hasher.generateSalt();
        const hash = this.hasher.hash(code, salt);
        // 4. Send email — if it fails, nothing is persisted
        try {
            await this.emailSender.sendOtp(email, code);
        }
        catch {
            throw new EmailDeliveryError(email.toPrimitive());
        }
        // 5. Persist the verification (DB assigns the id)
        const expiresAt = new Date(Date.now() + OTP_TTL_MS);
        const verification = EmailVerification.create({
            email,
            otpHash: hash,
            otpSalt: salt,
            maxAttempts: MAX_ATTEMPTS,
            expiresAt,
        });
        try {
            await this.verificationRepo.save(verification);
        }
        catch (err) {
            // Two concurrent requests raced — the unique partial index blocked the second INSERT.
            // Map to a cooldown error so the client gets a 429 instead of a 500.
            if (err instanceof DuplicatePendingVerificationError) {
                throw new VerificationCooldownError(new Date(Date.now() + REQUEST_COOLDOWN_MS));
            }
            throw err;
        }
        // 6. Fire-and-forget event
        this.eventRepo
            .save({
            email: email.toPrimitive(),
            type: 'requested',
            verificationId: verification.getId().toPrimitive(),
        })
            .catch((err) => logger.warn({ err }, '[RequestEmailVerification] Failed to save event'));
        return { verificationId: verification.getId().toPrimitive() };
    }
}
