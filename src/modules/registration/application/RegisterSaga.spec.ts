import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';

import { RegisterSaga } from './RegisterSaga.js';

// Verification
import { EmailVerification } from '../../verification/domain/entities/EmailVerification.entity.js';
import { InMemoryEmailVerificationRepository } from '../../verification/infrastructure/adapters/InMemoryEmailVerificationRepository.js';
import { VerificationId } from '../../verification/domain/value-objects/VerificationId.vo.js';

// Identity
import { InMemoryIdentityRepository } from '../../identity/infrastructure/persistence/InMemoryIdentityRepository.js';
import { CreateIdentityUseCase } from '../../identity/application/use-cases/CreateIdentity.usecase.js';
import { IdentityId } from '../../identity/domain/value-objects/IdentityId.vo.js';

// Credential
import { InMemoryCredentialRepository } from '../../credential/infrastructure/persistence/InMemoryCredentialRepository.js';
import { InMemorySessionRepository } from '../../credential/infrastructure/persistence/InMemorySessionRepository.js';
import { CreateCredentialUseCase } from '../../credential/application/use-cases/CreateCredential.usecase.js';
import { SignInUseCase } from '../../credential/application/use-cases/SignIn.usecase.js';
import { PasswordHasher } from '../../credential/domain/ports/PasswordHasher.port.js';
import { RawPassword } from '../../credential/domain/value-objects/RawPassword.vo.js';
import { PasswordHash } from '../../credential/domain/value-objects/PasswordHash.vo.js';
import { TokenService, AccessTokenPayload } from '../../credential/domain/ports/TokenService.port.js';
import { UpdateToken } from '../../credential/domain/value-objects/UpdateToken.vo.js';
import { SessionId } from '../../credential/domain/value-objects/SessionId.vo.js';
import { StaticUsernameReservedList } from '../../credential/infrastructure/adapters/StaticUsernameReservedList.js';
import { CredentialId } from '../../credential/domain/value-objects/CredentialId.vo.js';

// Account
import { InMemoryAccountRepository } from '../../account/infrastructure/persistence/InMemoryAccountRepository.js';
import { InMemoryAccountEventRepository } from '../../account/infrastructure/persistence/InMemoryAccountEventRepository.js';
import { InMemoryAccountQueryAdapter } from '../../account/infrastructure/adapters/InMemoryAccountQueryAdapter.js';
import { CreateAccountUseCase } from '../../account/application/use-cases/CreateAccount.usecase.js';
import { AccountId } from '../../account/domain/value-objects/AccountId.vo.js';

// Errors
import { EmailNotVerifiedError } from '../../identity/domain/errors/Identity.errors.js';

// ── Stubs ─────────────────────────────────────────────────────────────────────

class StubPasswordHasher implements PasswordHasher {
  async hash(raw: RawPassword): Promise<PasswordHash> {
    return PasswordHash.fromPrimitive(`hashed:${raw.toPrimitive()}`);
  }
  async compare(raw: RawPassword, hash: PasswordHash): Promise<boolean> {
    return hash.toPrimitive() === `hashed:${raw.toPrimitive()}`;
  }
}

class StubTokenService implements TokenService {
  generateAccessToken(_payload: AccessTokenPayload): string { return 'stub-access-token'; }
  generateUpdateToken(): UpdateToken { return UpdateToken.fromPrimitive(randomUUID()); }
  generateSessionId(): SessionId { return SessionId.fromPrimitive(randomUUID()); }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeUsedVerification(id: number, email: string): EmailVerification {
  return EmailVerification.fromPrimitive({
    id,
    identityId: undefined,
    email,
    otpHash: 'irrelevant',
    otpSalt: 'irrelevant',
    status: 'USED',
    attempts: 1,
    maxAttempts: 5,
    expiresAt: new Date(Date.now() + 600_000),
    sentAt: new Date(),
    usedAt: new Date(),
    blockedAt: undefined,
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

function buildSaga() {
  const verificationRepo = new InMemoryEmailVerificationRepository();
  const identityRepo = new InMemoryIdentityRepository();
  const credentialRepo = new InMemoryCredentialRepository();
  const sessionRepo = new InMemorySessionRepository();
  const accountRepo = new InMemoryAccountRepository();
  const accountEventRepo = new InMemoryAccountEventRepository();

  const passwordHasher = new StubPasswordHasher();
  const tokenService = new StubTokenService();
  const reservedList = new StaticUsernameReservedList();
  const accountQueryAdapter = new InMemoryAccountQueryAdapter(accountRepo);

  const createIdentityUseCase = new CreateIdentityUseCase(identityRepo);
  const createCredentialUseCase = new CreateCredentialUseCase(credentialRepo, passwordHasher, reservedList);
  const createAccountUseCase = new CreateAccountUseCase(accountRepo, accountEventRepo);
  const signInUseCase = new SignInUseCase(credentialRepo, sessionRepo, passwordHasher, tokenService, accountQueryAdapter);

  const saga = new RegisterSaga(
    verificationRepo,
    createIdentityUseCase,
    identityRepo,
    createCredentialUseCase,
    credentialRepo,
    createAccountUseCase,
    accountRepo,
    signInUseCase,
  );

  return { saga, verificationRepo, identityRepo, credentialRepo, accountRepo };
}

const BASE_INPUT = {
  verificationId: 1,
  fullName: 'John Doe',
  email: 'john@example.com',
  phone: '+1234567890',
  nationality: 'American',
  country: 'USA',
  username: 'johndoe',
  password: 'password123',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RegisterSaga', () => {
  describe('Happy path', () => {
    it('returns accessToken and updateToken on full successful registration', async () => {
      const { saga, verificationRepo } = buildSaga();

      const verification = makeUsedVerification(1, 'john@example.com');
      await verificationRepo.save(verification);

      const result = await saga.execute(BASE_INPUT);

      expect(result.accessToken).toBe('stub-access-token');
      expect(typeof result.updateToken).toBe('string');
      expect(result.updateToken.length).toBeGreaterThan(0);
    });
  });

  describe('Guard failures (EmailNotVerifiedError)', () => {
    it('throws EmailNotVerifiedError when verification is not found', async () => {
      const { saga } = buildSaga();

      await expect(saga.execute(BASE_INPUT)).rejects.toThrow(EmailNotVerifiedError);
    });

    it('throws EmailNotVerifiedError when verification status is PENDING', async () => {
      const { saga, verificationRepo } = buildSaga();

      const pendingVerification = EmailVerification.fromPrimitive({
        id: 1,
        identityId: undefined,
        email: 'john@example.com',
        otpHash: 'irrelevant',
        otpSalt: 'irrelevant',
        status: 'PENDING',
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 600_000),
        sentAt: new Date(),
        usedAt: undefined,
        blockedAt: undefined,
      });
      await verificationRepo.save(pendingVerification);

      await expect(saga.execute(BASE_INPUT)).rejects.toThrow(EmailNotVerifiedError);
    });

    it('throws EmailNotVerifiedError when verification email does not match input email', async () => {
      const { saga, verificationRepo } = buildSaga();

      // Save a USED verification but for a different email
      const verification = makeUsedVerification(1, 'other@example.com');
      await verificationRepo.save(verification);

      await expect(saga.execute(BASE_INPUT)).rejects.toThrow(EmailNotVerifiedError);
    });
  });

  describe('Step 2 compensation: CreateCredential fails → identity is hard deleted', () => {
    it('compensates identity when username is already taken', async () => {
      const { saga, verificationRepo, identityRepo, credentialRepo } = buildSaga();

      // Pre-register a credential with the same username (but different identity)
      const existingCredential = await import('../../credential/domain/entities/Credential.entity.js');
      const existingUsername = await import('../../credential/domain/value-objects/Username.vo.js');
      const existingPasswordHash = await import('../../credential/domain/value-objects/PasswordHash.vo.js');
      const existingIdentityRef = await import('../../../shared/domain/value-objects/IdentityRef.vo.js');

      const takenCredential = existingCredential.Credential.create({
        id: CredentialId.generate(),
        identityRef: existingIdentityRef.IdentityRef.fromPrimitive(randomUUID()),
        username: existingUsername.Username.fromPrimitive('johndoe'),
        passwordHash: existingPasswordHash.PasswordHash.fromPrimitive('hashed:somepassword'),
      });
      await credentialRepo.save(takenCredential);

      // Save a USED verification
      const verification = makeUsedVerification(1, 'john@example.com');
      await verificationRepo.save(verification);

      await expect(saga.execute(BASE_INPUT)).rejects.toThrow();

      // Identity should be compensated (hard deleted)
      const identities = await identityRepo.findByEmail(
        (await import('../../../shared/domain/value-objects/Email.vo.js')).Email.fromPrimitive('john@example.com')
      );
      expect(identities).toBeNull();
    });

    it('compensates identity when username is reserved', async () => {
      const { saga, verificationRepo, identityRepo } = buildSaga();

      const verification = makeUsedVerification(1, 'john@example.com');
      await verificationRepo.save(verification);

      // 'register' is a reserved username
      const inputWithReservedUsername = { ...BASE_INPUT, username: 'register' };

      await expect(saga.execute(inputWithReservedUsername)).rejects.toThrow();

      const identities = await identityRepo.findByEmail(
        (await import('../../../shared/domain/value-objects/Email.vo.js')).Email.fromPrimitive('john@example.com')
      );
      expect(identities).toBeNull();
    });
  });

  describe('Step 3 compensation: CreateAccount fails → credential and identity are hard deleted', () => {
    it('compensates credential and identity when account already exists', async () => {
      const { saga, verificationRepo, identityRepo, credentialRepo, accountRepo } = buildSaga();

      // We need to simulate CreateAccount failing. To do this, we pre-create an account
      // with an identity that matches — but the saga uses the newly created identityId,
      // so we need to make findByIdentityRefAndType return an existing account.
      // The easiest approach: create a USER account pre-linked to the future identity.
      // Since identityId is a UUID generated at runtime, we can't predict it.
      // Instead, override the createAccount use case by wrapping with a failing stub.

      // Alternative: test via direct injection of a failing account repo.
      // We can subclass InMemoryAccountRepository to fail on save for account type USER.

      class FailingAccountRepository extends InMemoryAccountRepository {
        override async findByIdentityRefAndType(
          _ref: import('../../../shared/domain/value-objects/IdentityRef.vo.js').IdentityRef,
          _type: import('../../account/domain/value-objects/AccountType.vo.js').AccountType
        ): Promise<import('../../account/domain/entities/Account.entity.js').Account | null> {
          // Simulate an existing account (triggers AccountAlreadyExistsError in use case)
          const { Account } = await import('../../account/domain/entities/Account.entity.js');
          const { AccountId } = await import('../../account/domain/value-objects/AccountId.vo.js');
          const { IdentityRef } = await import('../../../shared/domain/value-objects/IdentityRef.vo.js');
          return Account.createUser(AccountId.generate(), IdentityRef.fromPrimitive(randomUUID()));
        }
      }

      const failingAccountRepo = new FailingAccountRepository();
      const accountEventRepo = new InMemoryAccountEventRepository();
      const failingCreateAccount = new CreateAccountUseCase(failingAccountRepo, accountEventRepo);

      const passwordHasher = new StubPasswordHasher();
      const tokenService = new StubTokenService();
      const reservedList = new StaticUsernameReservedList();
      const sessionRepo = new InMemorySessionRepository();
      const accountQueryAdapter = new InMemoryAccountQueryAdapter(failingAccountRepo);

      const createIdentityUseCase = new CreateIdentityUseCase(identityRepo);
      const createCredentialUseCase = new CreateCredentialUseCase(credentialRepo, passwordHasher, reservedList);
      const signInUseCase = new SignInUseCase(credentialRepo, sessionRepo, passwordHasher, tokenService, accountQueryAdapter);

      const sagaWithFailingAccount = new RegisterSaga(
        verificationRepo,
        createIdentityUseCase,
        identityRepo,
        createCredentialUseCase,
        credentialRepo,
        failingCreateAccount,
        failingAccountRepo,
        signInUseCase,
      );

      const verification = makeUsedVerification(1, 'john@example.com');
      await verificationRepo.save(verification);

      await expect(sagaWithFailingAccount.execute(BASE_INPUT)).rejects.toThrow();

      // Both identity and credential should be compensated
      const Email = (await import('../../../shared/domain/value-objects/Email.vo.js')).Email;
      const identity = await identityRepo.findByEmail(Email.fromPrimitive('john@example.com'));
      expect(identity).toBeNull();

      const Username = (await import('../../credential/domain/value-objects/Username.vo.js')).Username;
      const credential = await credentialRepo.findByUsername(Username.fromPrimitive('johndoe'));
      expect(credential).toBeNull();
    });
  });
});
