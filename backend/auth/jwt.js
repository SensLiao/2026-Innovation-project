// backend/auth/jwt.js
import jwt from "jsonwebtoken"; // assign and verify JWTs
export const TOKEN_COOKIE_NAME = "access_token";
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const JWT_ISS = "soma-auth"; //JWT issuer
const JWT_AUD = "soma-web"; //JWT audience
const ACCESS_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const ALG = "HS256"; // HMAC SHA256

// 生成 JWT，包含用户 ID 和 email
// 用户登录成功后调用，生成JWT字符串，包含Header(算法信息), Payload（用户信息）, Signature（加密签名）
export function signAccessToken(user) {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        sub: String(user.uid),          // 主体：用户 UID, 唯一标识
        email: user.email,              // 附加信息邮箱
        iat: now,                       // 签发时间
        exp: now + ACCESS_TTL_SECONDS,  // 过期时间
        iss: JWT_ISS,                   // 签发者
        aud: JWT_AUD,                   // 受众
    };
    return jwt.sign(payload, JWT_SECRET, { algorithm: ALG });
}

// 验证 JWT，有效则返回 payload 对象，否则抛出异常
// 每次请求受保护的资源时调用，验证请求中的JWT是否合法
// 验证签名有效，未过期，且符合预期的发行者和受众，未被篡改
// 然后backend会把req.user = { uid: payload.sub, email: payload.email };后续知道谁在访问
export function verifyAccessToken(token) {
    return jwt.verify(token, JWT_SECRET, {
        algorithms: [ALG],
        issuer: JWT_ISS,
        audience: JWT_AUD,
    });
}

// 设置登录 cookie，包含 JWT
// 登录成功后调用，设置 HTTP-only cookie，前端 JS 不能访问，防止 XSS 攻击
// secure 选项在生产环境下应为 true，确保 cookie 仅通过 HTTPS 传输
export function setLoginCookie(res, token, { secure = false } = {}) {
    // 开发环境: sameSite=none 需要 secure，但 localhost 例外
    const isDev = !secure;
    res.cookie(TOKEN_COOKIE_NAME, token, {
        httpOnly: true,      // JS 不能访问 cookie(防止 XSS)
        secure,              // HTTP 环境 production 下要 true,仅在 HTTPS 上传输
        sameSite: isDev ? "lax" : "strict",  // 开发用 lax，生产用 strict
        path: "/",
        maxAge: ACCESS_TTL_SECONDS * 1000,
        domain: isDev ? "localhost" : undefined,  // 开发环境明确设置 domain
    });

    // 可选：给前端 UI 用的可读 cookie（非必须）
    res.cookie("logged_in", "true", {
        httpOnly: false,
        secure,
        sameSite: isDev ? "lax" : "strict",
        path: "/",
        maxAge: ACCESS_TTL_SECONDS * 1000,
        domain: isDev ? "localhost" : undefined,
    });
}

// 清除登录 cookie
// 登出时调用，清除 cookie
export function clearLoginCookie(res, { secure = false } = {}) {
    res.clearCookie(TOKEN_COOKIE_NAME, { path: "/", sameSite: "lax", secure });
    res.clearCookie("logged_in", { path: "/", sameSite: "lax", secure });
}

