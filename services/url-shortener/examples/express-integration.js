/**
 * Express 통합 예시
 * 현재 discussion 프로젝트에 URL 단축 서비스 추가
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: '../../../.env' });

const { createShortener } = require('../index');

async function startServer() {
    const app = express();
    const PORT = process.env.PORT || 3002;

    // 미들웨어
    app.use(cors());
    app.use(express.json());

    // URL 단축 서비스 초기화
    console.log('🚀 URL 단축 서비스 초기화 중...');

    const shortener = await createShortener({
        baseUrl: 'https://discussion.keesdconsulting.uk',
        storage: {
            host: 'localhost',
            port: 5432,
            user: 'postgres',
            password: 'symphony99!',
            database: 'vibedb'
        },
        codeGenerator: {
            length: 6,
            charset: 'safe',
            strategy: 'random'
        },
        enableQR: true,
        enableAnalytics: true,
        autoCleanup: true,  // 자동으로 만료된 URL 정리
        cleanupInterval: 3600000  // 1시간마다
    });

    console.log('✅ URL 단축 서비스 초기화 완료\n');

    // ===== 기본 라우트 =====

    // 홈페이지
    app.get('/', (req, res) => {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>URL Shortener Demo</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        max-width: 800px;
                        margin: 50px auto;
                        padding: 20px;
                        background: #f5f5f5;
                    }
                    .container {
                        background: white;
                        padding: 30px;
                        border-radius: 10px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    h1 { color: #333; }
                    input, button {
                        padding: 10px;
                        margin: 10px 0;
                        font-size: 16px;
                    }
                    input {
                        width: 100%;
                        border: 1px solid #ddd;
                        border-radius: 5px;
                    }
                    button {
                        background: #007bff;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        width: 100%;
                    }
                    button:hover {
                        background: #0056b3;
                    }
                    #result {
                        margin-top: 20px;
                        padding: 15px;
                        background: #e7f3ff;
                        border-radius: 5px;
                        display: none;
                    }
                    #qrCode {
                        text-align: center;
                        margin-top: 15px;
                    }
                    #qrCode img {
                        border: 2px solid #ddd;
                        border-radius: 5px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🔗 URL Shortener Demo</h1>
                    <p>긴 URL을 짧게 만들어보세요!</p>

                    <input type="text" id="urlInput" placeholder="https://example.com/very/long/url">
                    <input type="text" id="aliasInput" placeholder="커스텀 별칭 (선택사항)">
                    <input type="text" id="entryCodeInput" placeholder="입장 코드 (선택사항, 4-10자)">
                    <button onclick="shortenUrl()">단축하기</button>

                    <div id="result">
                        <h3>✅ 단축 완료!</h3>
                        <p><strong>단축 URL:</strong> <a id="shortUrl" href="#" target="_blank"></a></p>
                        <button onclick="copyToClipboard()">📋 복사하기</button>
                        <div id="qrCode"></div>
                    </div>
                </div>

                <script>
                    async function shortenUrl() {
                        const url = document.getElementById('urlInput').value;
                        const alias = document.getElementById('aliasInput').value;
                        const entryCode = document.getElementById('entryCodeInput').value;

                        if (!url) {
                            alert('URL을 입력해주세요!');
                            return;
                        }

                        try {
                            const response = await fetch('/s/shorten', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    url,
                                    customAlias: alias || undefined,
                                    entryCode: entryCode || undefined
                                })
                            });

                            const data = await response.json();

                            if (data.success) {
                                document.getElementById('shortUrl').href = data.data.shortUrl;
                                document.getElementById('shortUrl').textContent = data.data.shortUrl;

                                // QR 코드 표시
                                if (data.data.qrCode) {
                                    document.getElementById('qrCode').innerHTML =
                                        '<h4>QR 코드</h4><img src="' + data.data.qrCode + '" width="200">';
                                }

                                document.getElementById('result').style.display = 'block';
                            } else {
                                alert('오류: ' + data.error);
                            }

                        } catch (error) {
                            alert('오류가 발생했습니다: ' + error.message);
                        }
                    }

                    function copyToClipboard() {
                        const shortUrl = document.getElementById('shortUrl').textContent;
                        navigator.clipboard.writeText(shortUrl).then(() => {
                            alert('클립보드에 복사되었습니다!');
                        });
                    }
                </script>
            </body>
            </html>
        `);
    });

    // ===== URL 단축 서비스 라우트 마운트 =====

    app.use('/s', shortener.routes({
        enableCreate: true,      // POST /s/shorten
        enableRedirect: true,    // GET /s/:code
        enableStats: true,       // GET /s/:code/stats
        enableDelete: false,     // DELETE /s/:code (보안)
        enableUpdate: false,     // PATCH /s/:code (보안)
        enableList: false,       // GET /s/list (보안)
        notFoundRedirect: '/'    // 404 시 리다이렉트
    }));

    // ===== 관리자 API (인증 필요) =====

    // 간단한 토큰 인증 미들웨어 (실제 프로덕션에서는 JWT 등 사용)
    const adminAuth = (req, res, next) => {
        const token = req.headers.authorization;

        if (!token || token !== 'Bearer admin-secret-token') {
            return res.status(401).json({ error: '인증이 필요합니다.' });
        }

        next();
    };

    // 관리자 전용 라우트
    app.use('/admin/urls', adminAuth, shortener.routes({
        enableCreate: false,
        enableRedirect: false,
        enableStats: true,
        enableDelete: true,
        enableUpdate: true,
        enableList: true
    }));

    // ===== 서버 시작 =====

    app.listen(PORT, () => {
        console.log(`\n🚀 서버 실행 중`);
        console.log(`📍 URL: http://localhost:${PORT}`);
        console.log(`🔗 단축 URL 생성: http://localhost:${PORT}`);
        console.log(`📊 API 엔드포인트: http://localhost:${PORT}/s/*`);
        console.log('');
    });

    // 프로세스 종료 시 정리
    process.on('SIGINT', async () => {
        console.log('\n서버 종료 중...');
        await shortener.storage.disconnect();
        process.exit(0);
    });
}

// 실행
startServer().catch(error => {
    console.error('서버 시작 실패:', error);
    process.exit(1);
});
