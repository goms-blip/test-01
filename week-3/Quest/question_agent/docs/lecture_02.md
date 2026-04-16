# 2강: 보안과 인증 기초

## 학습 목표
- 웹 애플리케이션 보안의 기본 원칙 이해
- JWT(JSON Web Token) 인증 구현
- CORS 설정과 보안 헤더 적용

## 주요 개념

### 인증(Authentication) vs 인가(Authorization)
- **인증**: "너 누구야?" - 사용자 신원 확인 (로그인)
- **인가**: "너 이거 할 수 있어?" - 권한 확인 (접근 제어)

### JWT (JSON Web Token)
JWT는 세 부분으로 구성된 토큰 기반 인증 방식이다:
1. **Header**: 알고리즘, 토큰 타입
2. **Payload**: 사용자 정보 (claims)
3. **Signature**: 위변조 방지 서명

```javascript
const jwt = require('jsonwebtoken');

// 토큰 생성
const token = jwt.sign(
  { userId: 1, role: 'admin' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

// 토큰 검증 미들웨어
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: '인증 실패' });
  }
}
```

### CORS (Cross-Origin Resource Sharing)
브라우저의 동일 출처 정책(Same-Origin Policy)을 우회하기 위한 메커니즘.

```javascript
const cors = require('cors');
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
```

### 보안 헤더
```javascript
const helmet = require('helmet');
app.use(helmet()); // 다양한 보안 헤더 자동 설정
```

## OWASP Top 10 주요 항목
1. Injection (SQL, NoSQL, Command)
2. Broken Authentication
3. Sensitive Data Exposure
4. XSS (Cross-Site Scripting)
5. CSRF (Cross-Site Request Forgery)

## 핵심 정리
1. 인증과 인가를 구분하여 구현
2. JWT로 무상태(stateless) 인증 구현
3. CORS 설정으로 허용 도메인 제한
4. helmet 등 보안 미들웨어 적용
