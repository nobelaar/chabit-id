import { AccountRepository } from '../../domain/ports/AccountRepository.port.js';
import { AccountType } from '../../domain/value-objects/AccountType.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { AccountNotFoundError } from '../../domain/errors/Account.errors.js';
import { AccountPrimitives } from '../../domain/entities/Account.entity.js';

export interface GetAccountsByIdentityDto {
  identityRef: string;
  callerRef: string;
}

export class GetAccountsByIdentityUseCase {
  constructor(private readonly repo: AccountRepository) {}

  async execute(dto: GetAccountsByIdentityDto): Promise<AccountPrimitives[]> {
    const identityRef = IdentityRef.fromPrimitive(dto.identityRef);
    const callerRef = IdentityRef.fromPrimitive(dto.callerRef);

    // Authorization: caller must be the owner OR have ADMIN ACTIVE account
    const isSelf = callerRef.toPrimitive() === identityRef.toPrimitive();
    if (!isSelf) {
      const callerAdmin = await this.repo.findByIdentityRefAndType(callerRef, AccountType.admin());
      if (!callerAdmin || !callerAdmin.getStatus().isActive()) throw new AccountNotFoundError();
    }

    const accounts = await this.repo.findByIdentityRef(identityRef);
    return accounts.map(a => a.toPrimitive());
  }
}
