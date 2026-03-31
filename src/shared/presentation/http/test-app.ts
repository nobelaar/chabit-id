/**
 * Test application factory — builds the full Hono app using InMemory repositories.
 * No database, no network. Each call creates a fresh isolated instance.
 */
import { Hono } from 'hono';
import { errorHandler } from './error-handler.js';
import { createCorsMiddleware } from './cors.middleware.js';
import { TransactionRunner } from '../../../modules/verification/application/ports/TransactionRunner.port.js';
// Verification
import { createVerificationRoutes } from '../../../modules/verification/presentation/http/verification.routes.js';
import { RequestEmailVerificationUseCase } from '../../../modules/verification/application/use-cases/RequestEmailVerification.usecase.js';
import { VerifyEmailUseCase } from '../../../modules/verification/application/use-cases/VerifyEmail.usecase.js';
import { InMemoryEmailVerificationRepository } from '../../../modules/verification/infrastructure/adapters/InMemoryEmailVerificationRepository.js';
import { InMemoryEmailEventRepository } from '../../../modules/verification/infrastructure/adapters/InMemoryEmailEventRepository.js';
import { HmacOtpHasher } from '../../../modules/verification/infrastructure/adapters/HmacOtpHasher.js';
import { CryptoOtpGenerator } from '../../../modules/verification/infrastructure/adapters/CryptoOtpGenerator.js';
import { StubEmailSender } from '../../../modules/verification/infrastructure/adapters/StubEmailSender.js';
// Credential
import { createCredentialRoutes } from '../../../modules/credential/presentation/http/credential.routes.js';
import { BcryptPasswordHasher } from '../../../modules/credential/infrastructure/adapters/BcryptPasswordHasher.js';
import { JwtTokenService } from '../../../modules/credential/infrastructure/adapters/JwtTokenService.js';
import { StaticUsernameReservedList } from '../../../modules/credential/infrastructure/adapters/StaticUsernameReservedList.js';
import { InMemoryCredentialRepository } from '../../../modules/credential/infrastructure/persistence/InMemoryCredentialRepository.js';
import { InMemorySessionRepository } from '../../../modules/credential/infrastructure/persistence/InMemorySessionRepository.js';
import { CreateCredentialUseCase } from '../../../modules/credential/application/use-cases/CreateCredential.usecase.js';
import { SignInUseCase } from '../../../modules/credential/application/use-cases/SignIn.usecase.js';
import { RefreshTokenUseCase } from '../../../modules/credential/application/use-cases/RefreshToken.usecase.js';
import { RevokeTokenUseCase } from '../../../modules/credential/application/use-cases/RevokeToken.usecase.js';
import { RevokeAllTokensUseCase } from '../../../modules/credential/application/use-cases/RevokeAllTokens.usecase.js';
import { ChangePasswordUseCase } from '../../../modules/credential/application/use-cases/ChangePassword.usecase.js';
import { ChangeUsernameUseCase } from '../../../modules/credential/application/use-cases/ChangeUsername.usecase.js';
import { ResetPasswordUseCase } from '../../../modules/credential/application/use-cases/ResetPassword.usecase.js';
// Identity
import { InMemoryIdentityRepository } from '../../../modules/identity/infrastructure/persistence/InMemoryIdentityRepository.js';
import { CreateIdentityUseCase } from '../../../modules/identity/application/use-cases/CreateIdentity.usecase.js';
// Account
import { createAccountRoutes } from '../../../modules/account/presentation/http/account.routes.js';
import { InMemoryAccountRepository } from '../../../modules/account/infrastructure/persistence/InMemoryAccountRepository.js';
import { InMemoryAccountEventRepository } from '../../../modules/account/infrastructure/persistence/InMemoryAccountEventRepository.js';
import { InMemoryAccountQueryAdapter } from '../../../modules/account/infrastructure/adapters/InMemoryAccountQueryAdapter.js';
import { CreateAccountUseCase } from '../../../modules/account/application/use-cases/CreateAccount.usecase.js';
import { RequestOrganizerUseCase } from '../../../modules/account/application/use-cases/RequestOrganizer.usecase.js';
import { ApproveOrganizerUseCase } from '../../../modules/account/application/use-cases/ApproveOrganizer.usecase.js';
import { RejectOrganizerUseCase } from '../../../modules/account/application/use-cases/RejectOrganizer.usecase.js';
import { ReRequestOrganizerUseCase } from '../../../modules/account/application/use-cases/ReRequestOrganizer.usecase.js';
import { GetAccountsByIdentityUseCase } from '../../../modules/account/application/use-cases/GetAccountsByIdentity.usecase.js';
import { RequestStaffUseCase } from '../../../modules/account/application/use-cases/RequestStaff.usecase.js';
import { ReRequestStaffUseCase } from '../../../modules/account/application/use-cases/ReRequestStaff.usecase.js';
// Identity
import { GetIdentityUseCase } from '../../../modules/identity/application/use-cases/GetIdentity.usecase.js';
import { createIdentityRoutes } from '../../../modules/identity/presentation/http/identity.routes.js';
// Webhook stub
import type { WebhookSender } from '../../infrastructure/http/WebhookSender.port.js';
// Registration
import { RegisterSaga } from '../../../modules/registration/application/RegisterSaga.js';
import { createRegistrationRoutes } from '../../../modules/registration/presentation/http/registration.routes.js';
// Check
import { createCheckRoutes } from '../../../modules/check/presentation/http/check.routes.js';

class StubWebhookSender implements WebhookSender {
  async send(_url: string, _payload: Record<string, unknown>): Promise<void> {}
}

// No-op transaction runner for InMemory repos (they don't need real DB transactions)
class NoopTransactionRunner implements TransactionRunner {
  async run<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    return fn(null);
  }
}

export interface TestApp {
  app: Hono;
  emailSender: StubEmailSender;
}

export function createTestApp(): TestApp {
  const app = new Hono();

  // ── Health ────────────────────────────────────────────────────────
  app.get('/health', (c) => c.json({ status: 'ok' }));

  // ── CORS ──────────────────────────────────────────────────────────
  app.use('*', createCorsMiddleware());

  // ── Infrastructure (InMemory) ─────────────────────────────────────
  const verificationRepo = new InMemoryEmailVerificationRepository();
  const eventRepo = new InMemoryEmailEventRepository();
  const hasher = new HmacOtpHasher();
  const generator = new CryptoOtpGenerator();
  const emailSender = new StubEmailSender();
  const txRunner = new NoopTransactionRunner();

  const credentialRepo = new InMemoryCredentialRepository();
  const sessionRepo = new InMemorySessionRepository();
  const passwordHasher = new BcryptPasswordHasher();
  const tokenService = new JwtTokenService('test-secret');
  const reservedList = new StaticUsernameReservedList();

  const identityRepo = new InMemoryIdentityRepository();

  const accountRepo = new InMemoryAccountRepository();
  const accountEventRepo = new InMemoryAccountEventRepository();
  const accountQueryAdapter = new InMemoryAccountQueryAdapter(accountRepo);

  // ── Verification use cases ─────────────────────────────────────────
  const requestVerification = new RequestEmailVerificationUseCase(
    verificationRepo,
    eventRepo,
    hasher,
    generator,
    emailSender,
  );
  const verifyEmail = new VerifyEmailUseCase(verificationRepo, eventRepo, hasher, txRunner);

  // ── Credential use cases ───────────────────────────────────────────
  const createCredentialUseCase = new CreateCredentialUseCase(credentialRepo, passwordHasher, reservedList);
  const signIn = new SignInUseCase(credentialRepo, sessionRepo, passwordHasher, tokenService, accountQueryAdapter);
  const refreshToken = new RefreshTokenUseCase(credentialRepo, sessionRepo, tokenService, accountQueryAdapter);
  const revokeToken = new RevokeTokenUseCase(sessionRepo);
  const revokeAllTokens = new RevokeAllTokensUseCase(credentialRepo, sessionRepo);
  const changePassword = new ChangePasswordUseCase(credentialRepo, sessionRepo, passwordHasher);
  const changeUsername = new ChangeUsernameUseCase(credentialRepo, reservedList);
  const resetPassword = new ResetPasswordUseCase(verificationRepo, hasher, identityRepo, credentialRepo, sessionRepo, passwordHasher);

  // ── Identity use cases ─────────────────────────────────────────────
  const createIdentityUseCase = new CreateIdentityUseCase(identityRepo);

  // ── Account use cases ──────────────────────────────────────────────
  const createAccountUseCase = new CreateAccountUseCase(accountRepo, accountEventRepo);
  const requestOrganizer = new RequestOrganizerUseCase(accountRepo, accountEventRepo);
  const approveOrganizer = new ApproveOrganizerUseCase(accountRepo, accountEventRepo);
  const rejectOrganizer = new RejectOrganizerUseCase(accountRepo, accountEventRepo);
  const reRequestOrganizer = new ReRequestOrganizerUseCase(accountRepo, accountEventRepo);
  const getAccountsByIdentity = new GetAccountsByIdentityUseCase(accountRepo);
  const requestStaff = new RequestStaffUseCase(accountRepo, accountEventRepo);
  const reRequestStaff = new ReRequestStaffUseCase(accountRepo, accountEventRepo);
  const getIdentity = new GetIdentityUseCase(identityRepo);
  const webhookSender = new StubWebhookSender();

  // ── Routes ────────────────────────────────────────────────────────
  app.route('/verification', createVerificationRoutes(requestVerification, verifyEmail));

  app.route(
    '/auth',
    createCredentialRoutes(
      signIn,
      refreshToken,
      revokeToken,
      changePassword,
      revokeAllTokens,
      changeUsername,
      resetPassword,
      requestVerification,
    ),
  );

  app.route(
    '/accounts',
    createAccountRoutes(requestOrganizer, approveOrganizer, rejectOrganizer, reRequestOrganizer, getAccountsByIdentity, requestStaff, reRequestStaff),
  );

  app.route('/identities', createIdentityRoutes(getIdentity));

  app.route('/check', createCheckRoutes(identityRepo, credentialRepo));

  const registerSaga = new RegisterSaga(
    verificationRepo,
    createIdentityUseCase,
    identityRepo,
    createCredentialUseCase,
    credentialRepo,
    createAccountUseCase,
    accountRepo,
    signIn,
    webhookSender,
  );
  app.route('/register', createRegistrationRoutes(registerSaga));

  // ── Error handler (last) ──────────────────────────────────────────
  app.onError(errorHandler);

  return { app, emailSender };
}
