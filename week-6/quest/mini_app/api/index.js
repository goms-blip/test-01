// Vercel serverless entrypoint — server.js의 Express app을 그대로 핸들러로 사용.
// 로컬에서는 `node server.js`로 listen, Vercel에서는 이 파일이 함수가 됨.
module.exports = require('../server.js');
