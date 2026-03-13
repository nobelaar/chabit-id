const RESERVED = new Set([
    'admin', 'api', 'www', 'mail', 'root', 'null', 'undefined', 'me',
    'settings', 'help', 'support', 'about', 'login', 'logout', 'signup',
    'register', 'auth', 'verification', 'health', 'profile',
]);
export class StaticUsernameReservedList {
    isReserved(username) {
        return RESERVED.has(username.toPrimitive());
    }
}
