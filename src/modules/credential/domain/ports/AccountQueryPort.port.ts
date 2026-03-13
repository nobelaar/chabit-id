import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import type { AccountSnapshot } from './TokenService.port.js';
export type { AccountSnapshot } from './TokenService.port.js';

export interface AccountQueryPort {
  getAccountsByIdentityRef(ref: IdentityRef): Promise<AccountSnapshot[]>;
}
