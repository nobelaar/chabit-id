import { describe, it, expect, beforeEach } from 'vitest';
import { Identity } from './Identity.entity.js';
import { IdentityId } from '../value-objects/IdentityId.vo.js';
import { FullName } from '../value-objects/FullName.vo.js';
import { Nationality } from '../value-objects/Nationality.vo.js';
import { Country } from '../value-objects/Country.vo.js';
import { BlnkIdentityRef, InvalidBlnkIdentityRefError } from '../value-objects/BlnkIdentityRef.vo.js';
import { Email } from '../../../../shared/domain/value-objects/Email.vo.js';
import { PhoneNumber } from '../../../../shared/domain/value-objects/PhoneNumber.vo.js';
import {
  EmailNotVerifiedError,
  BlnkRefAlreadyAssignedError,
} from '../errors/Identity.errors.js';
import { InvalidIdentityIdError } from '../value-objects/IdentityId.vo.js';
import { InvalidFullNameError } from '../value-objects/FullName.vo.js';
import { InvalidNationalityError } from '../value-objects/Nationality.vo.js';
import { InvalidCountryError } from '../value-objects/Country.vo.js';
import { InMemoryIdentityRepository } from '../../infrastructure/persistence/InMemoryIdentityRepository.js';
import { CreateIdentityUseCase } from '../../application/use-cases/CreateIdentity.usecase.js';
import { GetIdentityUseCase } from '../../application/use-cases/GetIdentity.usecase.js';
import { UpdateProfileUseCase } from '../../application/use-cases/UpdateProfile.usecase.js';
import {
  EmailAlreadyRegisteredError,
  PhoneAlreadyRegisteredError,
  IdentityNotFoundError,
} from '../errors/Identity.errors.js';

const VALID_UUID = '550e8400-e29b-4d4a-a716-446655440000';
const VALID_EMAIL = 'test@example.com';
const VALID_PHONE = '+1234567890';

function makeValidProps() {
  return {
    id: IdentityId.fromPrimitive(VALID_UUID),
    fullName: FullName.fromPrimitive('John Doe'),
    email: Email.fromPrimitive(VALID_EMAIL),
    phone: PhoneNumber.fromPrimitive(VALID_PHONE),
    nationality: Nationality.fromPrimitive('American'),
    country: Country.fromPrimitive('United States'),
    emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

// ── Identity.entity ──────────────────────────────────────────────────────────

describe('Identity entity', () => {
  describe('create()', () => {
    it('builds entity with correct fields', () => {
      const props = makeValidProps();
      const identity = Identity.create(props);
      const p = identity.toPrimitive();

      expect(p.id).toBe(VALID_UUID);
      expect(p.fullName).toBe('John Doe');
      expect(p.email).toBe(VALID_EMAIL);
      expect(p.phone).toBe(VALID_PHONE);
      expect(p.nationality).toBe('American');
      expect(p.country).toBe('United States');
      expect(p.blnkIdentityRef).toBeUndefined();
      expect(p.emailVerifiedAt).toEqual(new Date('2026-01-01T00:00:00Z'));
      expect(p.createdAt).toBeInstanceOf(Date);
      expect(p.updatedAt).toBeInstanceOf(Date);
    });

    it('throws EmailNotVerifiedError if emailVerifiedAt is null cast as Date', () => {
      const props = { ...makeValidProps(), emailVerifiedAt: null as unknown as Date };
      expect(() => Identity.create(props)).toThrow(EmailNotVerifiedError);
    });
  });

  describe('assignBlnkRef()', () => {
    it('assigns ref when blnkIdentityRef is undefined', () => {
      const identity = Identity.create(makeValidProps());
      const ref = BlnkIdentityRef.fromPrimitive('blnk-ref-001');
      identity.assignBlnkRef(ref);
      expect(identity.toPrimitive().blnkIdentityRef).toBe('blnk-ref-001');
    });

    it('throws BlnkRefAlreadyAssignedError when already set', () => {
      const identity = Identity.create(makeValidProps());
      const ref = BlnkIdentityRef.fromPrimitive('blnk-ref-001');
      identity.assignBlnkRef(ref);
      expect(() => identity.assignBlnkRef(BlnkIdentityRef.fromPrimitive('blnk-ref-002'))).toThrow(
        BlnkRefAlreadyAssignedError,
      );
    });
  });

  describe('updateProfile()', () => {
    it('updates mutable fields and leaves email unchanged', () => {
      const identity = Identity.create(makeValidProps());
      const originalEmail = identity.toPrimitive().email;

      identity.updateProfile({
        fullName: FullName.fromPrimitive('Jane Smith'),
        phone: PhoneNumber.fromPrimitive('+9876543210'),
        nationality: Nationality.fromPrimitive('British'),
        country: Country.fromPrimitive('United Kingdom'),
      });

      const p = identity.toPrimitive();
      expect(p.fullName).toBe('Jane Smith');
      expect(p.phone).toBe('+9876543210');
      expect(p.nationality).toBe('British');
      expect(p.country).toBe('United Kingdom');
      expect(p.email).toBe(originalEmail);
    });
  });

  describe('fromPrimitive()', () => {
    it('round-trips through toPrimitive()', () => {
      const original = Identity.create(makeValidProps());
      original.assignBlnkRef(BlnkIdentityRef.fromPrimitive('blnk-ref-roundtrip'));
      const primitives = original.toPrimitive();

      const restored = Identity.fromPrimitive(primitives);
      expect(restored.toPrimitive()).toEqual(primitives);
    });

    it('restores entity without blnkIdentityRef', () => {
      const original = Identity.create(makeValidProps());
      const primitives = original.toPrimitive();

      const restored = Identity.fromPrimitive(primitives);
      expect(restored.toPrimitive().blnkIdentityRef).toBeUndefined();
    });
  });
});

// ── IdentityId VO ─────────────────────────────────────────────────────────────

describe('IdentityId VO', () => {
  it('accepts a valid UUID', () => {
    const id = IdentityId.fromPrimitive(VALID_UUID);
    expect(id.toPrimitive()).toBe(VALID_UUID);
  });

  it('rejects an invalid UUID', () => {
    expect(() => IdentityId.fromPrimitive('not-a-uuid')).toThrow(InvalidIdentityIdError);
  });

  it('generate() produces a valid UUID v4', () => {
    const id = IdentityId.generate();
    expect(id.toPrimitive()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('equals() returns true for same value', () => {
    const a = IdentityId.fromPrimitive(VALID_UUID);
    const b = IdentityId.fromPrimitive(VALID_UUID);
    expect(a.equals(b)).toBe(true);
  });
});

// ── FullName VO ───────────────────────────────────────────────────────────────

describe('FullName VO', () => {
  it('accepts a valid name', () => {
    expect(FullName.fromPrimitive('John Doe').toPrimitive()).toBe('John Doe');
  });

  it('trims whitespace', () => {
    expect(FullName.fromPrimitive('  Jane  ').toPrimitive()).toBe('Jane');
  });

  it('rejects empty string', () => {
    expect(() => FullName.fromPrimitive('  ')).toThrow(InvalidFullNameError);
  });

  it('rejects name longer than 150 characters', () => {
    const long = 'A'.repeat(151);
    expect(() => FullName.fromPrimitive(long)).toThrow(InvalidFullNameError);
  });

  it('rejects name with invalid characters', () => {
    expect(() => FullName.fromPrimitive('John123')).toThrow(InvalidFullNameError);
  });

  it('accepts name with hyphens and apostrophes', () => {
    expect(FullName.fromPrimitive("Mary-Jane O'Brien").toPrimitive()).toBe("Mary-Jane O'Brien");
  });
});

// ── Nationality VO ────────────────────────────────────────────────────────────

describe('Nationality VO', () => {
  it('accepts a valid nationality', () => {
    expect(Nationality.fromPrimitive('American').toPrimitive()).toBe('American');
  });

  it('trims whitespace', () => {
    expect(Nationality.fromPrimitive('  British  ').toPrimitive()).toBe('British');
  });

  it('rejects empty string', () => {
    expect(() => Nationality.fromPrimitive('')).toThrow(InvalidNationalityError);
  });

  it('rejects nationality longer than 100 characters', () => {
    const long = 'A'.repeat(101);
    expect(() => Nationality.fromPrimitive(long)).toThrow(InvalidNationalityError);
  });

  it('rejects nationality with invalid characters', () => {
    expect(() => Nationality.fromPrimitive('American123')).toThrow(InvalidNationalityError);
  });
});

// ── Country VO ────────────────────────────────────────────────────────────────

describe('Country VO', () => {
  it('accepts a valid country', () => {
    expect(Country.fromPrimitive('United States').toPrimitive()).toBe('United States');
  });

  it('trims whitespace', () => {
    expect(Country.fromPrimitive('  France  ').toPrimitive()).toBe('France');
  });

  it('rejects empty string', () => {
    expect(() => Country.fromPrimitive('')).toThrow(InvalidCountryError);
  });

  it('rejects country longer than 100 characters', () => {
    const long = 'A'.repeat(101);
    expect(() => Country.fromPrimitive(long)).toThrow(InvalidCountryError);
  });

  it('rejects country with invalid characters', () => {
    expect(() => Country.fromPrimitive('France123')).toThrow(InvalidCountryError);
  });
});

// ── CreateIdentityUseCase ─────────────────────────────────────────────────────

describe('CreateIdentityUseCase', () => {
  let repo: InMemoryIdentityRepository;
  let useCase: CreateIdentityUseCase;

  beforeEach(() => {
    repo = new InMemoryIdentityRepository();
    useCase = new CreateIdentityUseCase(repo);
  });

  const dto = {
    fullName: 'John Doe',
    email: VALID_EMAIL,
    phone: VALID_PHONE,
    nationality: 'American',
    country: 'United States',
    emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
  };

  it('creates identity and returns identityId', async () => {
    const result = await useCase.execute(dto);
    expect(result.identityId).toBeTruthy();
    expect(result.identityId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('throws EmailAlreadyRegisteredError on duplicate email', async () => {
    await useCase.execute(dto);
    await expect(
      useCase.execute({ ...dto, phone: '+9999999999' }),
    ).rejects.toThrow(EmailAlreadyRegisteredError);
  });

  it('throws PhoneAlreadyRegisteredError on duplicate phone', async () => {
    await useCase.execute(dto);
    await expect(
      useCase.execute({ ...dto, email: 'other@example.com' }),
    ).rejects.toThrow(PhoneAlreadyRegisteredError);
  });
});

// ── GetIdentityUseCase ────────────────────────────────────────────────────────

describe('GetIdentityUseCase', () => {
  let repo: InMemoryIdentityRepository;
  let getUseCase: GetIdentityUseCase;
  let createUseCase: CreateIdentityUseCase;

  beforeEach(() => {
    repo = new InMemoryIdentityRepository();
    getUseCase = new GetIdentityUseCase(repo);
    createUseCase = new CreateIdentityUseCase(repo);
  });

  it('returns identity primitives for existing identity', async () => {
    const { identityId } = await createUseCase.execute({
      fullName: 'Jane Doe',
      email: VALID_EMAIL,
      phone: VALID_PHONE,
      nationality: 'Canadian',
      country: 'Canada',
      emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    });

    const result = await getUseCase.execute({ identityId });
    expect(result.id).toBe(identityId);
    expect(result.email).toBe(VALID_EMAIL);
    expect(result.fullName).toBe('Jane Doe');
  });

  it('throws IdentityNotFoundError for missing ID', async () => {
    await expect(
      getUseCase.execute({ identityId: VALID_UUID }),
    ).rejects.toThrow(IdentityNotFoundError);
  });
});

// ── UpdateProfileUseCase ──────────────────────────────────────────────────────

describe('UpdateProfileUseCase', () => {
  let repo: InMemoryIdentityRepository;
  let updateUseCase: UpdateProfileUseCase;
  let createUseCase: CreateIdentityUseCase;

  beforeEach(() => {
    repo = new InMemoryIdentityRepository();
    updateUseCase = new UpdateProfileUseCase(repo);
    createUseCase = new CreateIdentityUseCase(repo);
  });

  it('updates mutable fields', async () => {
    const { identityId } = await createUseCase.execute({
      fullName: 'John Doe',
      email: VALID_EMAIL,
      phone: VALID_PHONE,
      nationality: 'American',
      country: 'United States',
      emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    });

    await updateUseCase.execute({
      identityId,
      fullName: 'John Updated',
      nationality: 'Canadian',
    });

    const identity = await repo.findById(IdentityId.fromPrimitive(identityId));
    expect(identity?.toPrimitive().fullName).toBe('John Updated');
    expect(identity?.toPrimitive().nationality).toBe('Canadian');
    expect(identity?.toPrimitive().email).toBe(VALID_EMAIL);
  });

  it('throws PhoneAlreadyRegisteredError when phone belongs to another identity', async () => {
    const { identityId } = await createUseCase.execute({
      fullName: 'User One',
      email: 'one@example.com',
      phone: '+1111111111',
      nationality: 'American',
      country: 'United States',
      emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    });

    await createUseCase.execute({
      fullName: 'User Two',
      email: 'two@example.com',
      phone: '+2222222222',
      nationality: 'British',
      country: 'United Kingdom',
      emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    });

    await expect(
      updateUseCase.execute({ identityId, phone: '+2222222222' }),
    ).rejects.toThrow(PhoneAlreadyRegisteredError);
  });

  it('allows updating phone to own current phone', async () => {
    const { identityId } = await createUseCase.execute({
      fullName: 'John Doe',
      email: VALID_EMAIL,
      phone: VALID_PHONE,
      nationality: 'American',
      country: 'United States',
      emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    });

    await expect(
      updateUseCase.execute({ identityId, phone: VALID_PHONE }),
    ).resolves.toBeUndefined();
  });
});

// ── BlnkIdentityRef VO ────────────────────────────────────────────────────────

describe('BlnkIdentityRef VO', () => {
  it('accepts a non-empty string', () => {
    const ref = BlnkIdentityRef.fromPrimitive('blnk-123');
    expect(ref.toPrimitive()).toBe('blnk-123');
  });

  it('preserves leading/trailing whitespace (opaque reference)', () => {
    const ref = BlnkIdentityRef.fromPrimitive('  blnk-abc  ');
    expect(ref.toPrimitive()).toBe('  blnk-abc  ');
  });

  it('throws InvalidBlnkIdentityRefError for empty string', () => {
    expect(() => BlnkIdentityRef.fromPrimitive('')).toThrow(InvalidBlnkIdentityRefError);
  });

  it('throws InvalidBlnkIdentityRefError for whitespace-only string', () => {
    expect(() => BlnkIdentityRef.fromPrimitive('   ')).toThrow(InvalidBlnkIdentityRefError);
  });
});
