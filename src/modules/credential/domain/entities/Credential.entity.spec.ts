import { describe, it, expect, beforeEach } from 'vitest';
import { Credential } from './Credential.entity.js';
import { Session } from './Session.entity.js';
import { CredentialId } from '../value-objects/CredentialId.vo.js';
import { SessionId } from '../value-objects/SessionId.vo.js';
import { UpdateToken } from '../value-objects/UpdateToken.vo.js';
import { Username } from '../value-objects/Username.vo.js';
import { PasswordHash } from '../value-objects/PasswordHash.vo.js';
import { RawPassword } from '../value-objects/RawPassword.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { InMemoryCredentialRepository } from '../../infrastructure/persistence/InMemoryCredentialRepository.js';
import { InMemorySessionRepository } from '../../infrastructure/persistence/InMemorySessionRepository.js';
import { PasswordHasher } from '../ports/PasswordHasher.port.js';
import { TokenService, AccessTokenPayload } from '../ports/TokenService.port.js';
import { UsernameReservedList } from '../ports/UsernameReservedList.port.js';
import { AccountQueryPort } from '../ports/AccountQueryPort.port.js';
import { IdentityQueryPort } from '../ports/IdentityQueryPort.port.js';
import { Email } from '../../../../shared/domain/value-objects/Email.vo.js';
import { CreateCredentialUseCase } from '../../application/use-cases/CreateCredential.usecase.js';
import { SignInUseCase } from '../../application/use-cases/SignIn.usecase.js';
import { RefreshTokenUseCase } from '../../application/use-cases/RefreshToken.usecase.js';
import { RevokeTokenUseCase } from '../../application/use-cases/RevokeToken.usecase.js';
import { ChangeUsernameUseCase } from '../../application/use-cases/ChangeUsername.usecase.js';
import {
  UsernameReservedError,
  UsernameAlreadyTakenError,
  InvalidCredentialsError,
  SessionNotFoundError,
  SessionExpiredError,
  CannotChangeUsernameYetError,
} from '../errors/Credential.errors.js';
import { randomUUID } from 'node:crypto';

// ── Stubs ──────────────────────────────────────────────────────────────────

class StubPasswordHasher implements PasswordHasher {
  async hash(raw: RawPassword): Promise<PasswordHash> {
    return PasswordHash.fromPrimitive(`hash:${raw.toPrimitive()}`);
  }
  async compare(raw: RawPassword, hash: PasswordHash): Promise<boolean> {
    return hash.toPrimitive() === `hash:${raw.toPrimitive()}`;
  }
}

class StubTokenService implements TokenService {
  generateAccessToken(_payload: AccessTokenPayload): string {
    return 'stub-access-token';
  }
  generateUpdateToken(): UpdateToken {
    return UpdateToken.fromPrimitive(randomUUID());
  }
  generateSessionId(): SessionId {
    return SessionId.fromPrimitive(randomUUID());
  }
}

class StubReservedList implements UsernameReservedList {
  isReserved(username: Username): boolean {
    return username.toPrimitive() === 'admin';
  }
}

const stubAccountQuery: AccountQueryPort = {
  getAccountsByIdentityRef: async () => [],
};

const IDENTITY_REF = randomUUID();
const TEST_EMAIL = 'johndoe@example.com';

const stubIdentityQuery: IdentityQueryPort = {
  findIdentityRefByEmail: async (email: Email) => {
    if (email.toPrimitive() === TEST_EMAIL) return IdentityRef.fromPrimitive(IDENTITY_REF);
    return null;
  },
};

// ── Session entity tests ───────────────────────────────────────────────────

describe('Session entity', () => {
  it('create() sets correct credentialId, updateToken, and expiresAt ~30 days from now', () => {
    const credentialId = CredentialId.generate();
    const sessionId = SessionId.generate();
    const updateToken = UpdateToken.generate();
    const before = Date.now();
    const session = Session.create({ id: sessionId, credentialId, updateToken });
    const after = Date.now();

    expect(session.getCredentialId().toPrimitive()).toBe(credentialId.toPrimitive());
    expect(session.getUpdateToken().toPrimitive()).toBe(updateToken.toPrimitive());

    const ttl30Days = 30 * 24 * 60 * 60 * 1000;
    const expiresAt = session.getExpiresAt().getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + ttl30Days - 100);
    expect(expiresAt).toBeLessThanOrEqual(after + ttl30Days + 100);
  });

  it('isExpired() returns false for a freshly created session', () => {
    const session = Session.create({
      id: SessionId.generate(),
      credentialId: CredentialId.generate(),
      updateToken: UpdateToken.generate(),
    });
    expect(session.isExpired()).toBe(false);
  });

  it('isExpired() returns true for a session with past expiresAt', () => {
    const session = Session.fromPrimitive({
      id: randomUUID(),
      credentialId: randomUUID(),
      updateToken: randomUUID(),
      expiresAt: new Date(Date.now() - 1000),
      userAgent: undefined,
      ipAddress: undefined,
      createdAt: new Date(),
      lastUsedAt: new Date(),
    });
    expect(session.isExpired()).toBe(true);
  });

  it('rotate() replaces updateToken and extends expiresAt', () => {
    const session = Session.create({
      id: SessionId.generate(),
      credentialId: CredentialId.generate(),
      updateToken: UpdateToken.generate(),
    });
    const oldToken = session.getUpdateToken().toPrimitive();
    const oldExpiry = session.getExpiresAt().getTime();
    const newToken = UpdateToken.generate();
    session.rotate(newToken);

    expect(session.getUpdateToken().toPrimitive()).not.toBe(oldToken);
    expect(session.getUpdateToken().toPrimitive()).toBe(newToken.toPrimitive());
    expect(session.getExpiresAt().getTime()).toBeGreaterThanOrEqual(oldExpiry);
  });
});

// ── Credential entity tests ────────────────────────────────────────────────

describe('Credential entity', () => {
  it('create() sets username, passwordHash, usernameChangedAt = undefined', () => {
    const credential = Credential.create({
      id: CredentialId.generate(),
      identityRef: IdentityRef.fromPrimitive(IDENTITY_REF),
      username: Username.fromPrimitive('testuser'),
      passwordHash: PasswordHash.fromPrimitive('hash:secret'),
    });

    expect(credential.getUsername().toPrimitive()).toBe('testuser');
    expect(credential.getPasswordHash().toPrimitive()).toBe('hash:secret');
    expect(credential.getUsernameChangedAt()).toBeUndefined();
  });

  it('updatePassword() replaces passwordHash', () => {
    const credential = Credential.create({
      id: CredentialId.generate(),
      identityRef: IdentityRef.fromPrimitive(IDENTITY_REF),
      username: Username.fromPrimitive('testuser'),
      passwordHash: PasswordHash.fromPrimitive('hash:oldpass'),
    });
    credential.updatePassword(PasswordHash.fromPrimitive('hash:newpass'));
    expect(credential.getPasswordHash().toPrimitive()).toBe('hash:newpass');
  });

  it('changeUsername() replaces username and sets usernameChangedAt', () => {
    const credential = Credential.create({
      id: CredentialId.generate(),
      identityRef: IdentityRef.fromPrimitive(IDENTITY_REF),
      username: Username.fromPrimitive('testuser'),
      passwordHash: PasswordHash.fromPrimitive('hash:pass'),
    });
    expect(credential.getUsernameChangedAt()).toBeUndefined();
    credential.changeUsername(Username.fromPrimitive('newuser'));
    expect(credential.getUsername().toPrimitive()).toBe('newuser');
    expect(credential.getUsernameChangedAt()).toBeInstanceOf(Date);
  });
});

// ── CreateCredential use case tests ───────────────────────────────────────

describe('CreateCredentialUseCase', () => {
  let repo: InMemoryCredentialRepository;
  let hasher: StubPasswordHasher;
  let reservedList: StubReservedList;
  let useCase: CreateCredentialUseCase;

  beforeEach(() => {
    repo = new InMemoryCredentialRepository();
    hasher = new StubPasswordHasher();
    reservedList = new StubReservedList();
    useCase = new CreateCredentialUseCase(repo, hasher, reservedList);
  });

  it('creates a credential and returns credentialId', async () => {
    const result = await useCase.execute({
      identityRef: IDENTITY_REF,
      username: 'johndoe',
      password: 'password123',
    });
    expect(result.credentialId).toBeTruthy();
    const saved = await repo.findByUsername(Username.fromPrimitive('johndoe'));
    expect(saved).not.toBeNull();
  });

  it('throws UsernameReservedError for reserved username', async () => {
    await expect(
      useCase.execute({ identityRef: IDENTITY_REF, username: 'admin', password: 'password123' }),
    ).rejects.toThrow(UsernameReservedError);
  });

  it('throws UsernameAlreadyTakenError for duplicate username', async () => {
    await useCase.execute({ identityRef: IDENTITY_REF, username: 'johndoe', password: 'password123' });
    const ref2 = randomUUID();
    await expect(
      useCase.execute({ identityRef: ref2, username: 'johndoe', password: 'password456' }),
    ).rejects.toThrow(UsernameAlreadyTakenError);
  });
});

// ── SignIn use case tests ──────────────────────────────────────────────────

describe('SignInUseCase', () => {
  let credentialRepo: InMemoryCredentialRepository;
  let sessionRepo: InMemorySessionRepository;
  let hasher: StubPasswordHasher;
  let tokenService: StubTokenService;
  let createCredential: CreateCredentialUseCase;
  let signIn: SignInUseCase;

  beforeEach(async () => {
    credentialRepo = new InMemoryCredentialRepository();
    sessionRepo = new InMemorySessionRepository();
    hasher = new StubPasswordHasher();
    tokenService = new StubTokenService();
    createCredential = new CreateCredentialUseCase(credentialRepo, hasher, new StubReservedList());
    signIn = new SignInUseCase(credentialRepo, sessionRepo, hasher, tokenService, stubAccountQuery, stubIdentityQuery);

    await createCredential.execute({ identityRef: IDENTITY_REF, username: 'johndoe', password: 'password123' });
  });

  it('returns accessToken and updateToken on success', async () => {
    const result = await signIn.execute({ email: TEST_EMAIL, password: 'password123' });
    expect(result.accessToken).toBe('stub-access-token');
    expect(result.updateToken).toBeTruthy();
  });

  it('throws InvalidCredentialsError for unknown username', async () => {
    await expect(
      signIn.execute({ email: 'unknown@example.com', password: 'password123' }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('throws InvalidCredentialsError for wrong password', async () => {
    await expect(
      signIn.execute({ email: TEST_EMAIL, password: 'wrongpassword' }),
    ).rejects.toThrow(InvalidCredentialsError);
  });
});

// ── RefreshToken use case tests ────────────────────────────────────────────

describe('RefreshTokenUseCase', () => {
  let credentialRepo: InMemoryCredentialRepository;
  let sessionRepo: InMemorySessionRepository;
  let hasher: StubPasswordHasher;
  let tokenService: StubTokenService;
  let signIn: SignInUseCase;
  let refreshToken: RefreshTokenUseCase;

  beforeEach(async () => {
    credentialRepo = new InMemoryCredentialRepository();
    sessionRepo = new InMemorySessionRepository();
    hasher = new StubPasswordHasher();
    tokenService = new StubTokenService();
    const createCredential = new CreateCredentialUseCase(credentialRepo, hasher, new StubReservedList());
    signIn = new SignInUseCase(credentialRepo, sessionRepo, hasher, tokenService, stubAccountQuery, stubIdentityQuery);
    refreshToken = new RefreshTokenUseCase(credentialRepo, sessionRepo, tokenService, stubAccountQuery);

    await createCredential.execute({ identityRef: IDENTITY_REF, username: 'johndoe', password: 'password123' });
  });

  it('rotates token on success and returns new tokens', async () => {
    const { updateToken } = await signIn.execute({ email: TEST_EMAIL, password: 'password123' });
    const result = await refreshToken.execute({ updateToken });
    expect(result.accessToken).toBe('stub-access-token');
    expect(result.updateToken).toBeTruthy();
    expect(result.updateToken).not.toBe(updateToken);
  });

  it('throws SessionNotFoundError for invalid token', async () => {
    await expect(
      refreshToken.execute({ updateToken: randomUUID() }),
    ).rejects.toThrow(SessionNotFoundError);
  });

  it('throws SessionExpiredError for expired session', async () => {
    const { updateToken } = await signIn.execute({ email: TEST_EMAIL, password: 'password123' });

    // Manually expire the session in the store by finding it and replacing with expired version
    const token = UpdateToken.fromPrimitive(updateToken);
    const session = await sessionRepo.findByUpdateToken(token);
    expect(session).not.toBeNull();

    // Save a replacement session that is expired
    const expiredSession = Session.fromPrimitive({
      ...session!.toPrimitive(),
      expiresAt: new Date(Date.now() - 1000),
    });
    await sessionRepo.save(expiredSession);

    await expect(
      refreshToken.execute({ updateToken }),
    ).rejects.toThrow(SessionExpiredError);
  });
});

// ── RevokeToken use case tests ────────────────────────────────────────────

describe('RevokeTokenUseCase', () => {
  let credentialRepo: InMemoryCredentialRepository;
  let sessionRepo: InMemorySessionRepository;
  let hasher: StubPasswordHasher;
  let tokenService: StubTokenService;
  let signIn: SignInUseCase;
  let revokeToken: RevokeTokenUseCase;

  beforeEach(async () => {
    credentialRepo = new InMemoryCredentialRepository();
    sessionRepo = new InMemorySessionRepository();
    hasher = new StubPasswordHasher();
    tokenService = new StubTokenService();
    const createCredential = new CreateCredentialUseCase(credentialRepo, hasher, new StubReservedList());
    signIn = new SignInUseCase(credentialRepo, sessionRepo, hasher, tokenService, stubAccountQuery, stubIdentityQuery);
    revokeToken = new RevokeTokenUseCase(sessionRepo);

    await createCredential.execute({ identityRef: IDENTITY_REF, username: 'johndoe', password: 'password123' });
  });

  it('deletes the session so it is no longer findable', async () => {
    const { updateToken } = await signIn.execute({ email: TEST_EMAIL, password: 'password123' });

    const token = UpdateToken.fromPrimitive(updateToken);
    const session = await sessionRepo.findByUpdateToken(token);
    expect(session).not.toBeNull();

    await revokeToken.execute({ sessionId: session!.getId().toPrimitive() });

    const afterRevoke = await sessionRepo.findByUpdateToken(token);
    expect(afterRevoke).toBeNull();
  });
});

// ── ChangeUsername use case tests ─────────────────────────────────────────

describe('ChangeUsernameUseCase', () => {
  let repo: InMemoryCredentialRepository;
  let reservedList: StubReservedList;
  let hasher: StubPasswordHasher;
  let createCredential: CreateCredentialUseCase;
  let changeUsername: ChangeUsernameUseCase;

  beforeEach(async () => {
    repo = new InMemoryCredentialRepository();
    reservedList = new StubReservedList();
    hasher = new StubPasswordHasher();
    createCredential = new CreateCredentialUseCase(repo, hasher, reservedList);
    changeUsername = new ChangeUsernameUseCase(repo, reservedList);

    await createCredential.execute({ identityRef: IDENTITY_REF, username: 'johndoe', password: 'password123' });
  });

  it('changes the username successfully', async () => {
    await changeUsername.execute({ identityRef: IDENTITY_REF, newUsername: 'janedoe' });
    const credential = await repo.findByIdentityRef(IdentityRef.fromPrimitive(IDENTITY_REF));
    expect(credential!.getUsername().toPrimitive()).toBe('janedoe');
  });

  it('throws CannotChangeUsernameYetError within 30-day cooldown', async () => {
    await changeUsername.execute({ identityRef: IDENTITY_REF, newUsername: 'janedoe' });
    // Attempt to change again immediately (within cooldown)
    await expect(
      changeUsername.execute({ identityRef: IDENTITY_REF, newUsername: 'othername' }),
    ).rejects.toThrow(CannotChangeUsernameYetError);
  });

  it('throws UsernameReservedError for reserved username', async () => {
    await expect(
      changeUsername.execute({ identityRef: IDENTITY_REF, newUsername: 'admin' }),
    ).rejects.toThrow(UsernameReservedError);
  });

  it('throws UsernameAlreadyTakenError for taken username', async () => {
    const ref2 = randomUUID();
    await createCredential.execute({ identityRef: ref2, username: 'takenuser', password: 'password123' });
    await expect(
      changeUsername.execute({ identityRef: IDENTITY_REF, newUsername: 'takenuser' }),
    ).rejects.toThrow(UsernameAlreadyTakenError);
  });
});
