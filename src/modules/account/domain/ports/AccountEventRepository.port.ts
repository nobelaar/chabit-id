import { AccountId } from '../value-objects/AccountId.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';

export type AccountEventType = 'created' | 'approved' | 'rejected' | 're_requested' | 'deactivated' | 'reactivated';

export interface AccountEventRepository {
  save(event: {
    accountId: AccountId;
    type: AccountEventType;
    performedBy?: IdentityRef;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}
