import { EmailVerificationRepository } from '../../verification/domain/ports/EmailVerificationRepository.port.js';
import { VerificationId } from '../../verification/domain/value-objects/VerificationId.vo.js';
import { CreateIdentityUseCase } from '../../identity/application/use-cases/CreateIdentity.usecase.js';
import { IdentityRepository } from '../../identity/domain/ports/IdentityRepository.port.js';
import { IdentityId } from '../../identity/domain/value-objects/IdentityId.vo.js';
import { CreateCredentialUseCase } from '../../credential/application/use-cases/CreateCredential.usecase.js';
import { CredentialRepository } from '../../credential/domain/ports/CredentialRepository.port.js';
import { CredentialId } from '../../credential/domain/value-objects/CredentialId.vo.js';
import { CreateAccountUseCase } from '../../account/application/use-cases/CreateAccount.usecase.js';
import { AccountRepository } from '../../account/domain/ports/AccountRepository.port.js';
import { AccountId } from '../../account/domain/value-objects/AccountId.vo.js';
import { SignInUseCase } from '../../credential/application/use-cases/SignIn.usecase.js';
import { IdentityRef } from '../../../shared/domain/value-objects/IdentityRef.vo.js';
import { EmailNotVerifiedError } from '../../identity/domain/errors/Identity.errors.js';
import { logger } from '../../../shared/infrastructure/logger.js';
import type { WebhookSender } from '../../../shared/infrastructure/http/WebhookSender.port.js';

export interface RegisterSagaInput {
  verificationId: number;
  fullName: string;
  email: string;
  phone: string;
  nationality: string;
  country: string;
  username: string;
  password: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface RegisterSagaResult {
  accessToken: string;
  updateToken: string;
}

export class RegisterSaga {
  constructor(
    private readonly verificationRepo: EmailVerificationRepository,
    private readonly createIdentity: CreateIdentityUseCase,
    private readonly identityRepo: IdentityRepository,
    private readonly createCredential: CreateCredentialUseCase,
    private readonly credentialRepo: CredentialRepository,
    private readonly createAccount: CreateAccountUseCase,
    private readonly accountRepo: AccountRepository,
    private readonly signIn: SignInUseCase,
    private readonly webhookSender: WebhookSender,
  ) {}

  async execute(input: RegisterSagaInput): Promise<RegisterSagaResult> {
    // ── Guard: verify email verification ──────────────────────────────
    const verificationId = VerificationId.fromPrimitive(input.verificationId);
    const verification = await this.verificationRepo.findById(verificationId);

    if (!verification || !verification.getStatus().isUsed()) {
      throw new EmailNotVerifiedError();
    }
    if (verification.getEmail().toPrimitive() !== input.email.trim().toLowerCase()) {
      throw new EmailNotVerifiedError();
    }

    const emailVerifiedAt = verification.getUsedAt()!;

    // ── Step 1: CreateIdentity ─────────────────────────────────────────
    let identityId: string | undefined;
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
    } catch (err) {
      throw err; // no compensation needed — nothing was created yet
    }

    // ── Sub-step 1a: LinkVerificationToIdentity — fire & forget ────────
    try {
      const identityRef = IdentityRef.fromPrimitive(identityId!);
      verification.linkToIdentity(identityRef);
      await this.verificationRepo.save(verification);
    } catch (err) {
      logger.warn({ err }, '[RegisterSaga] Sub-step 1a (LinkVerification) failed — tolerated');
    }

    // ── Step 2: CreateCredential ───────────────────────────────────────
    let credentialId: string | undefined;
    try {
      const result = await this.createCredential.execute({
        identityRef: identityId!,
        username: input.username,
        password: input.password,
      });
      credentialId = result.credentialId;
    } catch (err) {
      // Compensate Step 1
      await this.identityRepo.hardDelete(IdentityId.fromPrimitive(identityId!)).catch(
        e => logger.error({ err: e }, '[RegisterSaga] Compensation Step 1 failed')
      );
      throw err;
    }

    // ── Step 3: CreateAccount(USER) ────────────────────────────────────
    let accountId: string | undefined;
    try {
      const result = await this.createAccount.execute({
        identityRef: identityId!,
        type: 'USER',
      });
      accountId = result.accountId;
    } catch (err) {
      // Compensate Step 2 then Step 1
      await this.credentialRepo.hardDelete(CredentialId.fromPrimitive(credentialId!)).catch(
        e => logger.error({ err: e }, '[RegisterSaga] Compensation Step 2 failed')
      );
      await this.identityRepo.hardDelete(IdentityId.fromPrimitive(identityId!)).catch(
        e => logger.error({ err: e }, '[RegisterSaga] Compensation Step 1 failed')
      );
      throw err;
    }

    // ── Step 4: SignIn ─────────────────────────────────────────────────
    // No compensation on failure — user exists, can sign in manually
    try {
      const signInResult = await this.signIn.execute({
        username: input.username,
        password: input.password,
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
      });
      // Newly registered users never have 2FA enabled
      if (signInResult.requires2FA) throw new Error('Unexpected 2FA challenge on fresh registration');
      const tokens = signInResult;

      const webhookUrl = process.env['WEBHOOK_BACKEND_URL'];
      if (webhookUrl) {
        void this.webhookSender.send(webhookUrl, {
          event: 'identity.registered',
          identityRef: identityId!,
          username: input.username,
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          nationality: input.nationality,
          country: input.country,
          registeredAt: new Date().toISOString(),
        }).catch(err => logger.warn({ err }, '[RegisterSaga] webhook failed'));
      }

      // suppress unused variable warning
      void accountId;
      return tokens;
    } catch (err) {
      // Don't compensate — identity/credential/account are valid
      // Client should sign in via POST /auth/sign-in
      logger.error({ err }, '[RegisterSaga] Step 4 (SignIn) failed — user registered but tokens not issued');
      throw err;
    }
  }
}
