import { AccountId } from '../../domain/value-objects/AccountId.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { AccountEventRepository, AccountEventType } from '../../domain/ports/AccountEventRepository.port.js';

export class InMemoryAccountEventRepository implements AccountEventRepository {
  async save(_event: { accountId: AccountId; type: AccountEventType; performedBy?: IdentityRef; metadata?: Record<string, unknown> }): Promise<void> {
    // no-op in tests
  }
}
