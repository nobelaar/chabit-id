// OpenAPI 3.0.3 specification for chabit-identity
const errorSchema = {
    type: 'object',
    properties: {
        error: { type: 'string', example: 'ERROR_CODE' },
        message: { type: 'string', example: 'Human-readable error description' },
        retryAfter: { type: 'string', format: 'date-time', description: 'ISO 8601 retry-after timestamp (rate limit / block errors only)' },
        attemptsRemaining: { type: 'integer', description: 'Remaining attempts (invalid OTP only)' },
    },
    required: ['error', 'message'],
};
const errorResponse = (description, example) => ({
    description,
    content: { 'application/json': { schema: errorSchema, example } },
});
export const openApiSpec = {
    openapi: '3.0.3',
    info: {
        title: 'chabit-identity',
        version: '0.1.0',
        description: 'Identity, authentication and account management service',
    },
    servers: [{ url: 'http://localhost:3001', description: 'Local development' }],
    components: {
        schemas: {
            Error: errorSchema,
            TokenPair: {
                type: 'object',
                properties: {
                    accessToken: { type: 'string', description: 'JWT access token (HS256, 15 min TTL)' },
                    updateToken: { type: 'string', format: 'uuid', description: 'Sliding-window refresh token (30 days)' },
                },
                required: ['accessToken', 'updateToken'],
            },
        },
    },
    paths: {
        // ── Health ─────────────────────────────────────────────────────────
        '/health': {
            get: {
                tags: ['Health'],
                summary: 'Health check',
                description: 'Returns the service liveness status.',
                responses: {
                    '200': {
                        description: 'Service is healthy',
                        content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' } } } } },
                    },
                },
            },
        },
        // ── Verification ───────────────────────────────────────────────────
        '/verification/email': {
            post: {
                tags: ['Verification'],
                summary: 'Request email OTP',
                description: 'Sends a 6-digit OTP to the given email address. Rate-limited to 3 requests per minute per IP.',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { type: 'object', properties: { email: { type: 'string', format: 'email' } }, required: ['email'] },
                            example: { email: 'user@example.com' },
                        },
                    },
                },
                responses: {
                    '201': {
                        description: 'OTP sent',
                        content: { 'application/json': { schema: { type: 'object', properties: { verificationId: { type: 'integer' } }, required: ['verificationId'] }, example: { verificationId: 42 } } },
                    },
                    '400': errorResponse('Validation error', { error: 'VALIDATION_ERROR', message: 'Invalid request body' }),
                    '429': errorResponse('Rate limited or blocked', { error: 'VERIFICATION_COOLDOWN', message: 'Please wait before requesting a new code' }),
                    '503': errorResponse('Email delivery failed', { error: 'EMAIL_DELIVERY_FAILED', message: 'Could not send email at this time' }),
                },
            },
        },
        '/verification/email/verify': {
            post: {
                tags: ['Verification'],
                summary: 'Verify email OTP',
                description: 'Verifies the OTP code for the given email. Rate-limited to 10 requests per minute per IP.',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    email: { type: 'string', format: 'email' },
                                    code: { type: 'string', minLength: 6, maxLength: 6, description: '6-digit OTP' },
                                },
                                required: ['email', 'code'],
                            },
                            example: { email: 'user@example.com', code: '123456' },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: 'OTP verified',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: { verificationId: { type: 'integer' }, usedAt: { type: 'string', format: 'date-time' } },
                                    required: ['verificationId', 'usedAt'],
                                },
                            },
                        },
                    },
                    '400': errorResponse('Validation error', { error: 'VALIDATION_ERROR', message: 'Invalid request body' }),
                    '404': errorResponse('Verification not found', { error: 'VERIFICATION_NOT_FOUND', message: 'No active verification found for this email' }),
                    '422': errorResponse('Invalid OTP or expired', { error: 'INVALID_OTP', message: 'Incorrect code. 4 attempts remaining' }),
                    '429': errorResponse('Too many failed attempts', { error: 'VERIFICATION_BLOCKED', message: 'Too many failed attempts. Try again later' }),
                },
            },
        },
        // ── Registration ───────────────────────────────────────────────────
        '/register': {
            post: {
                tags: ['Registration'],
                summary: 'Register a new user',
                description: 'Completes user registration. Requires a USED email verification. Returns tokens immediately (RegisterSaga: Identity + Credential + Account + SignIn).',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    verificationId: { type: 'integer', description: 'ID returned by POST /verification/email (must be USED)' },
                                    fullName: { type: 'string', maxLength: 150 },
                                    email: { type: 'string', format: 'email' },
                                    phone: { type: 'string', minLength: 7, maxLength: 15 },
                                    nationality: { type: 'string', maxLength: 100 },
                                    country: { type: 'string', maxLength: 100 },
                                    username: { type: 'string', minLength: 3, maxLength: 30 },
                                    password: { type: 'string', minLength: 8, maxLength: 128 },
                                },
                                required: ['verificationId', 'fullName', 'email', 'phone', 'nationality', 'country', 'username', 'password'],
                            },
                            example: {
                                verificationId: 42,
                                fullName: 'Jane Doe',
                                email: 'jane@example.com',
                                phone: '5491112345678',
                                nationality: 'Argentine',
                                country: 'Argentina',
                                username: 'janedoe',
                                password: 'supersecret123',
                            },
                        },
                    },
                },
                responses: {
                    '201': {
                        description: 'Registration successful',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/TokenPair' } } },
                    },
                    '400': errorResponse('Validation or verification error', { error: 'VALIDATION_ERROR', message: 'Invalid request body' }),
                    '409': errorResponse('Email or username already taken', { error: 'EMAIL_ALREADY_REGISTERED', message: 'Email is already registered' }),
                    '422': errorResponse('Email not verified', { error: 'EMAIL_NOT_VERIFIED', message: 'Verification must be in USED state' }),
                },
            },
        },
        // ── Auth ───────────────────────────────────────────────────────────
        '/auth/sign-in': {
            post: {
                tags: ['Auth'],
                summary: 'Sign in',
                description: 'Authenticates a user with username + password. Returns a JWT access token and an updateToken for session refresh.',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    username: { type: 'string' },
                                    password: { type: 'string' },
                                },
                                required: ['username', 'password'],
                            },
                            example: { username: 'janedoe', password: 'supersecret123' },
                        },
                    },
                },
                responses: {
                    '200': { description: 'Sign-in successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/TokenPair' } } } },
                    '400': errorResponse('Validation error', { error: 'VALIDATION_ERROR', message: 'Invalid request body' }),
                    '401': errorResponse('Invalid credentials', { error: 'INVALID_CREDENTIALS', message: 'Username or password is incorrect' }),
                },
            },
        },
        '/auth/refresh': {
            post: {
                tags: ['Auth'],
                summary: 'Refresh access token',
                description: 'Exchanges an updateToken (refresh token) for a new token pair. The old updateToken is invalidated (rotation).',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { type: 'object', properties: { updateToken: { type: 'string', format: 'uuid' } }, required: ['updateToken'] },
                            example: { updateToken: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
                        },
                    },
                },
                responses: {
                    '200': { description: 'Token refreshed', content: { 'application/json': { schema: { $ref: '#/components/schemas/TokenPair' } } } },
                    '400': errorResponse('Validation error', { error: 'VALIDATION_ERROR', message: 'Invalid request body' }),
                    '401': errorResponse('Session not found or expired', { error: 'SESSION_NOT_FOUND', message: 'Session not found' }),
                },
            },
        },
        '/auth/sign-out': {
            post: {
                tags: ['Auth'],
                summary: 'Sign out (current session)',
                description: 'Revokes the current session. Requires the `x-session-id` header (the `sid` claim from the access JWT).',
                parameters: [
                    { in: 'header', name: 'x-session-id', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Session ID from the JWT sid claim' },
                ],
                responses: {
                    '200': { description: 'Signed out', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } }, example: { message: 'Signed out successfully' } } } },
                    '400': errorResponse('Missing header', { error: 'MISSING_SESSION', message: 'x-session-id header required' }),
                    '401': errorResponse('Session not found', { error: 'SESSION_NOT_FOUND', message: 'Session not found' }),
                },
            },
        },
        '/auth/sign-out/all': {
            post: {
                tags: ['Auth'],
                summary: 'Sign out (all sessions)',
                description: 'Revokes all active sessions for the authenticated user. Requires the `x-identity-ref` header.',
                parameters: [
                    { in: 'header', name: 'x-identity-ref', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Identity UUID from the JWT sub claim' },
                ],
                responses: {
                    '200': { description: 'All sessions revoked', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } }, example: { message: 'All sessions revoked' } } } },
                    '400': errorResponse('Missing header', { error: 'MISSING_HEADERS', message: 'x-identity-ref header is required' }),
                },
            },
        },
        '/auth/forgot-password': {
            post: {
                tags: ['Auth'],
                summary: 'Request password reset',
                description: 'Sends a password-reset OTP to the given email. Always returns 200 to prevent email enumeration. Rate-limited to 3 requests per minute per IP.',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { type: 'object', properties: { email: { type: 'string', format: 'email' } }, required: ['email'] },
                            example: { email: 'jane@example.com' },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: 'Request processed (always 200 — email enumeration safe)',
                        content: {
                            'application/json': {
                                schema: { type: 'object', properties: { verificationId: { type: 'integer', description: '-1 if email not found or error, real ID otherwise' } }, required: ['verificationId'] },
                                example: { verificationId: 43 },
                            },
                        },
                    },
                    '400': errorResponse('Validation error', { error: 'VALIDATION_ERROR', message: 'Invalid request body' }),
                    '429': errorResponse('Rate limited', { error: 'RATE_LIMITED', message: 'Too many requests. Try again later.' }),
                },
            },
        },
        '/auth/reset-password': {
            post: {
                tags: ['Auth'],
                summary: 'Reset password',
                description: 'Resets the password using an OTP from forgot-password flow. Invalidates all existing sessions. Rate-limited to 10 requests per minute per IP.',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    verificationId: { type: 'integer', description: 'verificationId returned by POST /auth/forgot-password' },
                                    code: { type: 'string', minLength: 6, maxLength: 6, description: '6-digit OTP' },
                                    email: { type: 'string', format: 'email', description: 'Must match the email used in forgot-password' },
                                    newPassword: { type: 'string', minLength: 8, maxLength: 128 },
                                },
                                required: ['verificationId', 'code', 'email', 'newPassword'],
                            },
                            example: { verificationId: 43, code: '654321', email: 'jane@example.com', newPassword: 'newSecret456' },
                        },
                    },
                },
                responses: {
                    '200': { description: 'Password reset', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } }, example: { message: 'Password reset successfully' } } } },
                    '400': errorResponse('Validation error', { error: 'VALIDATION_ERROR', message: 'Invalid request body' }),
                    '401': errorResponse('Invalid OTP', { error: 'INVALID_OTP', message: 'Incorrect code' }),
                    '404': errorResponse('Verification not found', { error: 'VERIFICATION_NOT_FOUND', message: 'Verification not found' }),
                    '422': errorResponse('Verification expired or used', { error: 'VERIFICATION_EXPIRED', message: 'Verification has expired' }),
                    '429': errorResponse('Rate limited', { error: 'RATE_LIMITED', message: 'Too many requests. Try again later.' }),
                },
            },
        },
        '/auth/change-password': {
            patch: {
                tags: ['Auth'],
                summary: 'Change password',
                description: 'Changes the authenticated user\'s password. Revokes all sessions except the current one. Requires `x-identity-ref` and `x-session-id` headers.',
                parameters: [
                    { in: 'header', name: 'x-identity-ref', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Identity UUID' },
                    { in: 'header', name: 'x-session-id', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Current session ID' },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    currentPassword: { type: 'string' },
                                    newPassword: { type: 'string', minLength: 8, maxLength: 128 },
                                },
                                required: ['currentPassword', 'newPassword'],
                            },
                            example: { currentPassword: 'oldPass123', newPassword: 'newPass456' },
                        },
                    },
                },
                responses: {
                    '200': { description: 'Password changed', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } }, example: { message: 'Password changed successfully' } } } },
                    '400': errorResponse('Missing headers or validation error', { error: 'MISSING_HEADERS', message: 'x-identity-ref and x-session-id headers are required' }),
                    '401': errorResponse('Invalid current password', { error: 'INVALID_CREDENTIALS', message: 'Current password is incorrect' }),
                    '404': errorResponse('Credential not found', { error: 'CREDENTIAL_NOT_FOUND', message: 'No credential found for this identity' }),
                },
            },
        },
        '/auth/change-username': {
            patch: {
                tags: ['Auth'],
                summary: 'Change username',
                description: 'Changes the authenticated user\'s username. Subject to 30-day cooldown. Requires `x-identity-ref` header.',
                parameters: [
                    { in: 'header', name: 'x-identity-ref', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Identity UUID' },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: { newUsername: { type: 'string', minLength: 3, maxLength: 30 } },
                                required: ['newUsername'],
                            },
                            example: { newUsername: 'jane_doe_new' },
                        },
                    },
                },
                responses: {
                    '200': { description: 'Username changed', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } }, example: { message: 'Username changed successfully' } } } },
                    '400': errorResponse('Missing headers or validation error', { error: 'MISSING_HEADERS', message: 'x-identity-ref header is required' }),
                    '404': errorResponse('Credential not found', { error: 'CREDENTIAL_NOT_FOUND', message: 'No credential found for this identity' }),
                    '409': errorResponse('Username taken or reserved', { error: 'USERNAME_TAKEN', message: 'This username is already taken' }),
                    '422': errorResponse('Cooldown active', { error: 'USERNAME_CHANGE_TOO_SOON', message: 'You can only change your username once every 30 days' }),
                },
            },
        },
        // ── Accounts ───────────────────────────────────────────────────────
        '/accounts/organizer-request': {
            post: {
                tags: ['Accounts'],
                summary: 'Request organizer role',
                description: 'Creates a PENDING organizer account for the caller. Requires `x-identity-id` header.',
                parameters: [
                    { in: 'header', name: 'x-identity-id', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Caller identity UUID' },
                ],
                responses: {
                    '201': {
                        description: 'Organizer request submitted',
                        content: { 'application/json': { schema: { type: 'object', properties: { accountId: { type: 'string', format: 'uuid' } }, required: ['accountId'] } } },
                    },
                    '409': errorResponse('Account already exists', { error: 'ACCOUNT_ALREADY_EXISTS', message: 'An organizer account already exists for this identity' }),
                },
            },
        },
        '/accounts/{accountId}/approve': {
            post: {
                tags: ['Accounts'],
                summary: 'Approve organizer request',
                description: 'Approves a PENDING organizer account. Admin-only. Requires `x-identity-id` header (caller must be ADMIN).',
                parameters: [
                    { in: 'path', name: 'accountId', required: true, schema: { type: 'string', format: 'uuid' } },
                    { in: 'header', name: 'x-identity-id', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Admin identity UUID' },
                ],
                responses: {
                    '200': { description: 'Approved', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } }, example: { message: 'Approved' } } } },
                    '403': errorResponse('Insufficient permissions', { error: 'INSUFFICIENT_PERMISSIONS', message: 'Only admins can approve organizer requests' }),
                    '404': errorResponse('Account not found', { error: 'ACCOUNT_NOT_FOUND', message: 'Account not found' }),
                    '422': errorResponse('Invalid status transition', { error: 'INVALID_STATUS_TRANSITION', message: 'Account is not in PENDING status' }),
                },
            },
        },
        '/accounts/{accountId}/reject': {
            post: {
                tags: ['Accounts'],
                summary: 'Reject organizer request',
                description: 'Rejects a PENDING organizer account. Admin-only. Requires `x-identity-id` header (caller must be ADMIN).',
                parameters: [
                    { in: 'path', name: 'accountId', required: true, schema: { type: 'string', format: 'uuid' } },
                    { in: 'header', name: 'x-identity-id', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Admin identity UUID' },
                ],
                responses: {
                    '200': { description: 'Rejected', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } }, example: { message: 'Rejected' } } } },
                    '403': errorResponse('Insufficient permissions', { error: 'INSUFFICIENT_PERMISSIONS', message: 'Only admins can reject organizer requests' }),
                    '404': errorResponse('Account not found', { error: 'ACCOUNT_NOT_FOUND', message: 'Account not found' }),
                    '422': errorResponse('Invalid status transition', { error: 'INVALID_STATUS_TRANSITION', message: 'Account is not in PENDING status' }),
                },
            },
        },
        '/accounts/organizer-re-request': {
            post: {
                tags: ['Accounts'],
                summary: 'Re-request organizer role',
                description: 'Re-submits an organizer request after a rejection. Requires `x-identity-id` header.',
                parameters: [
                    { in: 'header', name: 'x-identity-id', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Caller identity UUID' },
                ],
                responses: {
                    '200': { description: 'Re-request submitted', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } }, example: { message: 'Re-requested' } } } },
                    '404': errorResponse('Account not found', { error: 'ACCOUNT_NOT_FOUND', message: 'No organizer account found for this identity' }),
                    '422': errorResponse('Invalid status transition', { error: 'INVALID_STATUS_TRANSITION', message: 'Account is not in REJECTED status' }),
                },
            },
        },
        '/accounts': {
            get: {
                tags: ['Accounts'],
                summary: 'Get accounts by identity',
                description: 'Returns all accounts for the given identity. Self-access or admin-only. Requires `x-identity-id` header.',
                parameters: [
                    { in: 'header', name: 'x-identity-id', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Caller identity UUID' },
                    { in: 'query', name: 'identityId', required: false, schema: { type: 'string', format: 'uuid' }, description: 'Target identity (defaults to caller)' },
                ],
                responses: {
                    '200': {
                        description: 'List of accounts',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        accounts: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    id: { type: 'string', format: 'uuid' },
                                                    type: { type: 'string', enum: ['USER', 'ORGANIZER', 'ADMIN'] },
                                                    status: { type: 'string', enum: ['ACTIVE', 'PENDING', 'REJECTED', 'DEACTIVATED'] },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    '403': errorResponse('Insufficient permissions', { error: 'INSUFFICIENT_PERMISSIONS', message: 'Cannot view accounts of another user' }),
                },
            },
        },
    },
};
