import { UsernameReservedList } from '../../domain/ports/UsernameReservedList.port.js';
import { Username } from '../../domain/value-objects/Username.vo.js';

const RESERVED = new Set([
  'admin', 'api', 'www', 'mail', 'root', 'null', 'undefined', 'me',
  'settings', 'help', 'support', 'about', 'login', 'logout', 'signup',
  'register', 'auth', 'verification', 'health', 'profile',
]);

export class StaticUsernameReservedList implements UsernameReservedList {
  isReserved(username: Username): boolean {
    return RESERVED.has(username.toPrimitive());
  }
}
