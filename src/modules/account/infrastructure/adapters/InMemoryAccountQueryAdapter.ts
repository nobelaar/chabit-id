import { AccountRepository } from '../../domain/ports/AccountRepository.port.js';
import { AccountQueryPort, AccountSnapshot } from '../../../credential/domain/ports/AccountQueryPort.port.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';

export class InMemoryAccountQueryAdapter implements AccountQueryPort {
  constructor(private readonly repo: AccountRepository) {}

  async getAccountsByIdentityRef(ref: IdentityRef): Promise<AccountSnapshot[]> {
    const accounts = await this.repo.findActiveByIdentityRef(ref);
    return accounts.map(a => ({
      id: a.getId().toPrimitive(),
      type: a.getType().toPrimitive(),
      status: a.getStatus().toPrimitive(),
    }));
  }
}
