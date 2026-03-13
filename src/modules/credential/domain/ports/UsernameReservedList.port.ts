import { Username } from '../value-objects/Username.vo.js';

export interface UsernameReservedList {
  isReserved(username: Username): boolean;
}
