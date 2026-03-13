function decodeJwtPayload(token) {
    const part = token.split('.')[1];
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
}
export async function registerTestUser(app, emailSender, overrides = {}) {
    const email = overrides.email ?? 'testuser@example.com';
    const username = overrides.username ?? 'testuser';
    const password = overrides.password ?? 'password123';
    // 1. Request email verification
    const vRes = await app.request('/verification/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
    const { verificationId } = (await vRes.json());
    // 2. Verify email using the OTP captured by StubEmailSender
    const code = emailSender.getLastCode(email);
    if (!code)
        throw new Error(`No OTP found for ${email}`);
    await app.request('/verification/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
    });
    // 3. Register
    const rRes = await app.request('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            verificationId,
            fullName: 'Test User',
            email,
            phone: '1234567890',
            nationality: 'Argentine',
            country: 'Argentina',
            username,
            password,
        }),
    });
    const { accessToken, updateToken } = (await rRes.json());
    const payload = decodeJwtPayload(accessToken);
    const identityRef = payload['sub'];
    const sessionId = payload['sid'];
    return { accessToken, updateToken, identityRef, sessionId, email, username, password };
}
