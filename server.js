const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { initializeDatabase, query } = require('./db');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT || 3001;

// 미들웨어 설정
app.use(cors());
app.use(express.json());

// 환경변수 API
app.get('/api/config', (req, res) => {
    res.json({
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || ''
    });
});

// 정적 파일 서빙 시 캐시 비활성화
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));

// 유틸리티 함수
function formatTimeRemaining(expiresAt) {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires - now;

    if (diff <= 0) return '0분';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
        return `${hours}시간 ${minutes}분`;
    }
    return `${minutes}분`;
}

function generateUserId(req) {
    // 간단한 사용자 식별자 생성 (실제로는 세션이나 JWT 토큰 사용)
    return req.ip + '_' + (req.headers['user-agent'] || '').slice(0, 50);
}

// API 라우트

// 모든 토론방 조회
app.get('/api/discussions', async (req, res) => {
    try {
        const { search, sort } = req.query;

        let discussions;
        if (global.discussionsStore) {
            // SQLite 폴백 모드
            discussions = global.discussionsStore.filter(d => d.is_active);

            // 검색 필터 적용
            if (search) {
                const searchLower = search.toLowerCase();
                discussions = discussions.filter(d =>
                    d.title.toLowerCase().includes(searchLower) ||
                    d.type.toLowerCase().includes(searchLower) ||
                    d.author.toLowerCase().includes(searchLower)
                );
            }

            // 정렬 적용
            if (sort === 'participants') {
                discussions.sort((a, b) => b.participants - a.participants);
            } else {
                discussions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            }
        } else {
            // PostgreSQL 모드
            let sql = `
                SELECT
                    id, title, type, author, participants,
                    created_at, expires_at, description
                FROM discussions
                WHERE is_active = true AND expires_at > CURRENT_TIMESTAMP
            `;

            const params = [];
            let paramCount = 0;

            if (search) {
                sql += ` AND (title ILIKE $${++paramCount} OR type ILIKE $${++paramCount} OR author ILIKE $${++paramCount})`;
                const searchParam = `%${search}%`;
                params.push(searchParam, searchParam, searchParam);
            }

            if (sort === 'participants') {
                sql += ` ORDER BY participants DESC, created_at DESC`;
            } else {
                sql += ` ORDER BY created_at DESC`;
            }

            discussions = await query(sql, params);
        }

        // 시간 포맷팅 추가
        const formattedDiscussions = discussions.map(d => ({
            ...d,
            timeRemaining: formatTimeRemaining(d.expires_at)
        }));

        res.json(formattedDiscussions);
    } catch (error) {
        console.error('토론방 조회 오류:', error);
        res.status(500).json({ error: '토론방을 조회할 수 없습니다.' });
    }
});

// 특정 토론방 상세 조회
app.get('/api/discussions/:id', async (req, res) => {
    try {
        const { id } = req.params;

        let discussion, opinions;

        if (global.discussionsStore) {
            // SQLite 폴백 모드
            discussion = global.discussionsStore.find(d => d.id == id && d.is_active);
            opinions = global.opinionsStore.filter(o => o.discussion_id == id);
        } else {
            // PostgreSQL 모드
            const discussionResult = await query(
                'SELECT * FROM discussions WHERE id = $1 AND is_active = true',
                [id]
            );
            discussion = discussionResult[0];

            if (discussion) {
                opinions = await query(
                    'SELECT * FROM opinions WHERE discussion_id = $1 ORDER BY created_at DESC',
                    [id]
                );
            }
        }

        if (!discussion) {
            return res.status(404).json({ error: '토론방을 찾을 수 없습니다.' });
        }

        // 찬성/반대 의견 분리
        const pros = opinions.filter(o => o.opinion_type === 'pros');
        const cons = opinions.filter(o => o.opinion_type === 'cons');

        res.json({
            ...discussion,
            timeRemaining: formatTimeRemaining(discussion.expires_at),
            pros,
            cons
        });
    } catch (error) {
        console.error('토론방 상세 조회 오류:', error);
        res.status(500).json({ error: '토론방 상세 정보를 조회할 수 없습니다.' });
    }
});

// 새 토론방 생성
app.post('/api/discussions', async (req, res) => {
    try {
        const { title, type, author, description, duration, isPrivate, entryCode, password, team1Name, team2Name } = req.body;

        if (!title || !author) {
            return res.status(400).json({ error: '제목과 작성자는 필수입니다.' });
        }

        // 비밀글인 경우 입장코드 검증
        if (isPrivate && (!entryCode || entryCode.length < 4)) {
            return res.status(400).json({ error: '비밀글의 경우 4자리 이상의 입장코드를 설정해주세요.' });
        }

        const durationHours = duration || 24;
        const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

        let result;

        if (global.discussionsStore) {
            // SQLite 폴백 모드
            result = await query(
                'INSERT INTO discussions',
                [title, type || '자유', author, description || '', expiresAt, isPrivate || false, entryCode || null, password || null]
            );
        } else {
            // PostgreSQL 모드
            result = await query(
                'INSERT INTO discussions (title, type, author, description, expires_at, is_private, entry_code, team1_name, team2_name) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
                [title, type || '자유', author, description || '', expiresAt, isPrivate || false, entryCode || null, team1Name || null, team2Name || null]
            );
        }

        res.status(201).json({
            id: global.discussionsStore ? result[0].id : result[0].id,
            message: isPrivate ? '비밀 토론방이 생성되었습니다.' : '토론방이 생성되었습니다.'
        });
    } catch (error) {
        console.error('토론방 생성 오류:', error);
        res.status(500).json({ error: '토론방을 생성할 수 없습니다.' });
    }
});

// 비밀 토론방 입장코드 검증
app.post('/api/discussions/:id/verify-entry', async (req, res) => {
    try {
        const { id } = req.params;
        const { entryCode } = req.body;

        if (!entryCode) {
            return res.status(400).json({ error: '입장코드를 입력해주세요.' });
        }

        let discussion;

        if (global.discussionsStore) {
            // SQLite 폴백 모드
            discussion = global.discussionsStore.find(d => d.id == id && d.is_active);
        } else {
            // PostgreSQL 모드
            const discussionResult = await query(
                'SELECT * FROM discussions WHERE id = $1 AND is_active = true',
                [id]
            );
            discussion = discussionResult[0];
        }

        if (!discussion) {
            return res.status(404).json({ error: '토론방을 찾을 수 없습니다.' });
        }

        if (!discussion.is_private) {
            return res.json({ success: true, message: '공개 토론방입니다.' });
        }

        if (discussion.entry_code === entryCode) {
            return res.json({ success: true, message: '입장코드가 확인되었습니다.' });
        } else {
            return res.status(403).json({ error: '입장코드가 틀렸습니다.' });
        }

    } catch (error) {
        console.error('입장코드 검증 오류:', error);
        res.status(500).json({ error: '입장코드를 검증할 수 없습니다.' });
    }
});

// 토론방 삭제
app.delete('/api/discussions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ error: '비밀번호가 필요합니다.' });
        }

        let discussion;

        if (global.discussionsStore) {
            // SQLite 폴백 모드
            discussion = global.discussionsStore.find(d => d.id == id);
            if (discussion && discussion.password === password) {
                await query('DELETE FROM discussions WHERE id = ?', [parseInt(id)]);
                res.json({ message: '토론방이 삭제되었습니다.' });
            } else {
                res.status(403).json({ error: '비밀번호가 일치하지 않습니다.' });
            }
        } else {
            // PostgreSQL 모드
            const discussionResult = await query(
                'SELECT author FROM discussions WHERE id = $1',
                [id]
            );
            discussion = discussionResult[0];

            if (!discussion) {
                return res.status(404).json({ error: '토론방을 찾을 수 없습니다.' });
            }

            // 비밀번호로만 인증하도록 변경

            await query('UPDATE discussions SET is_active = false WHERE id = $1', [id]);
            res.json({ message: '토론방이 삭제되었습니다.' });
        }
    } catch (error) {
        console.error('토론방 삭제 오류:', error);
        res.status(500).json({ error: '토론방을 삭제할 수 없습니다.' });
    }
});

// 의견 목록 조회
app.get('/api/discussions/:id/opinions', async (req, res) => {
    try {
        const { id } = req.params;

        let opinions;
        if (global.opinionsStore) {
            // SQLite 폴백 모드
            opinions = global.opinionsStore.filter(o => o.discussion_id == id);
        } else {
            // PostgreSQL 모드
            opinions = await query(
                'SELECT * FROM opinions WHERE discussion_id = $1 ORDER BY created_at DESC',
                [id]
            );
        }

        res.json(opinions);
    } catch (error) {
        console.error('의견 조회 오류:', error);
        res.status(500).json({ error: '의견을 조회할 수 없습니다.' });
    }
});

// 의견 추가
app.post('/api/discussions/:id/opinions', async (req, res) => {
    try {
        const { id } = req.params;
        const { author, content, opinion_type } = req.body;

        if (!author || !content || !opinion_type) {
            return res.status(400).json({ error: '모든 필드를 입력해주세요.' });
        }

        if (!['pros', 'cons'].includes(opinion_type)) {
            return res.status(400).json({ error: '의견 유형이 올바르지 않습니다.' });
        }

        let result;

        if (global.discussionsStore) {
            // SQLite 폴백 모드
            result = await query(
                'INSERT INTO opinions',
                [parseInt(id), author, content, opinion_type]
            );
        } else {
            // PostgreSQL 모드
            result = await query(
                'INSERT INTO opinions (discussion_id, author, content, opinion_type) VALUES ($1, $2, $3, $4) RETURNING id',
                [id, author, content, opinion_type]
            );
        }

        res.status(201).json({
            id: global.discussionsStore ? result.insertId : result[0].id,
            message: '의견이 추가되었습니다.'
        });
    } catch (error) {
        console.error('의견 추가 오류:', error);
        res.status(500).json({ error: '의견을 추가할 수 없습니다.' });
    }
});

// 의견 좋아요
app.post('/api/opinions/:id/like', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = generateUserId(req);

        if (global.opinionsStore) {
            // SQLite 폴백 모드 - 간단한 좋아요 증가
            const opinion = global.opinionsStore.find(o => o.id == id);
            if (opinion) {
                opinion.likes_count += 1;
                res.json({ message: '좋아요가 추가되었습니다.', likes: opinion.likes_count });
            } else {
                res.status(404).json({ error: '의견을 찾을 수 없습니다.' });
            }
        } else {
            // PostgreSQL 모드 - 중복 방지
            try {
                await query(
                    'INSERT INTO opinion_likes (opinion_id, user_identifier) VALUES ($1, $2)',
                    [id, userId]
                );

                await query(
                    'UPDATE opinions SET likes_count = likes_count + 1 WHERE id = $1',
                    [id]
                );

                const opinionResult = await query(
                    'SELECT likes_count FROM opinions WHERE id = $1',
                    [id]
                );
                const opinion = opinionResult[0];

                res.json({
                    message: '좋아요가 추가되었습니다.',
                    likes: opinion.likes_count
                });
            } catch (error) {
                if (error.code === '23505') { // PostgreSQL 중복 키 에러
                    res.status(409).json({ error: '이미 좋아요를 누르셨습니다.' });
                } else {
                    throw error;
                }
            }
        }
    } catch (error) {
        console.error('좋아요 추가 오류:', error);
        res.status(500).json({ error: '좋아요를 추가할 수 없습니다.' });
    }
});

// 참여자 추가 (토론방 접속 시)
app.post('/api/discussions/:id/join', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = generateUserId(req);

        if (global.discussionsStore) {
            // SQLite 폴백 모드
            const discussion = global.discussionsStore.find(d => d.id == id);
            if (discussion) {
                discussion.participants += 1;
                res.json({ message: '토론에 참여했습니다.' });
            }
        } else {
            // PostgreSQL 모드
            try {
                await query(
                    'INSERT INTO discussion_participants (discussion_id, user_identifier) VALUES ($1, $2) ON CONFLICT (discussion_id, user_identifier) DO UPDATE SET last_activity = CURRENT_TIMESTAMP',
                    [id, userId]
                );

                // 실시간 참여자 수 업데이트
                const participantResult = await query(
                    'SELECT COUNT(*) as count FROM discussion_participants WHERE discussion_id = $1 AND last_activity > CURRENT_TIMESTAMP - INTERVAL \'5 minutes\'',
                    [id]
                );

                await query(
                    'UPDATE discussions SET participants = $1 WHERE id = $2',
                    [participantResult[0].count, id]
                );

                res.json({ message: '토론에 참여했습니다.' });
            } catch (error) {
                console.error('참여자 추가 오류:', error);
                res.json({ message: '토론에 참여했습니다.' }); // 에러 무시
            }
        }
    } catch (error) {
        console.error('토론 참여 오류:', error);
        res.status(500).json({ error: '토론 참여에 실패했습니다.' });
    }
});

// 기본 라우트
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 에러 처리
app.use((req, res) => {
    res.status(404).json({ error: '페이지를 찾을 수 없습니다.' });
});

// ==========================================
// AI 질문 생성 API
// ==========================================

// Gemini API를 사용하여 AI 질문 생성
app.post('/api/discussions/:id/generate-questions', async (req, res) => {
    try {
        const { id } = req.params;
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: 'Gemini API 키가 설정되지 않았습니다.' });
        }

        // 토론방 정보 조회
        const discussions = await query('SELECT * FROM discussions WHERE id = $1', [id]);
        if (discussions.length === 0) {
            return res.status(404).json({ error: '토론방을 찾을 수 없습니다.' });
        }
        const discussion = discussions[0];

        // 최근 메시지 조회 (최대 20개)
        const messages = await query(
            `SELECT user_name, user_role, message, created_at
             FROM messages
             WHERE discussion_id = $1 AND message_type = 'chat'
             ORDER BY created_at DESC
             LIMIT 20`,
            [id]
        );

        if (messages.length < 3) {
            return res.json({
                questions: [],
                message: '질문을 생성하기에 충분한 대화가 없습니다. (최소 3개 메시지 필요)'
            });
        }

        // 메시지를 시간순으로 정렬 (오래된 것부터)
        const sortedMessages = messages.reverse();

        // Gemini API 호출을 위한 프롬프트 생성
        const conversationText = sortedMessages
            .map(m => `${m.user_name} (${m.user_role}): ${m.message}`)
            .join('\n');

        const prompt = `다음은 "${discussion.title}"에 대한 토론 내용입니다:

${conversationText}

위 토론 내용을 분석하여, 토론을 더 깊이 있게 만들고 다양한 관점을 이끌어낼 수 있는 **3개의 질문**을 생성해주세요.

요구사항:
1. 질문은 토론 주제와 직접 관련되어야 합니다
2. 참여자들이 아직 다루지 않은 새로운 관점을 제시해야 합니다
3. 찬성과 반대 양측 모두 답변할 수 있어야 합니다
4. 구체적이고 실용적인 질문이어야 합니다
5. 각 질문은 한 문장으로 작성해주세요

JSON 형식으로 응답해주세요:
{
  "questions": [
    {"question": "질문 1", "category": "카테고리1"},
    {"question": "질문 2", "category": "카테고리2"},
    {"question": "질문 3", "category": "카테고리3"}
  ]
}

카테고리는 다음 중 하나를 선택: "실용성", "윤리", "경제", "사회", "기술", "환경", "정책"`;

        // Gemini API 호출
        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1000
                    }
                })
            }
        );

        if (!geminiResponse.ok) {
            throw new Error(`Gemini API 오류: ${geminiResponse.status}`);
        }

        const geminiData = await geminiResponse.json();
        const responseText = geminiData.candidates[0].content.parts[0].text;

        // JSON 파싱 (마크다운 코드 블록 제거)
        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/\{[\s\S]*\}/);
        const questionsData = JSON.parse(jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText);

        // 데이터베이스에 질문 저장
        const savedQuestions = [];
        for (const q of questionsData.questions) {
            const result = await query(
                `INSERT INTO ai_questions (discussion_id, question, category, created_at)
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                 RETURNING id, question, category, created_at`,
                [id, q.question, q.category || '일반']
            );
            savedQuestions.push(result[0]);
        }

        console.log(`✨ AI 질문 ${savedQuestions.length}개 생성됨 (토론방 ${id})`);

        res.json({
            success: true,
            questions: savedQuestions,
            message: `${savedQuestions.length}개의 질문이 생성되었습니다.`
        });

    } catch (error) {
        console.error('AI 질문 생성 오류:', error);
        res.status(500).json({
            error: 'AI 질문 생성에 실패했습니다.',
            details: error.message
        });
    }
});

// 저장된 AI 질문 조회
app.get('/api/discussions/:id/questions', async (req, res) => {
    try {
        const { id } = req.params;

        const questions = await query(
            `SELECT id, question, category, created_at
             FROM ai_questions
             WHERE discussion_id = $1
             ORDER BY created_at DESC
             LIMIT 10`,
            [id]
        );

        res.json({ questions });
    } catch (error) {
        console.error('AI 질문 조회 오류:', error);
        res.status(500).json({ error: 'AI 질문을 조회할 수 없습니다.' });
    }
});

// 에러 핸들러
app.use((error, req, res, next) => {
    console.error('서버 에러:', error);
    res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
});

// ==========================================
// Socket.io 실시간 통신
// ==========================================

// 아바타 이미지 URL 목록 (로컬 이미지)
const avatarImages = [
    '/images/avatars/avatar1.png',
    '/images/avatars/avatar2.png',
    '/images/avatars/avatar3.png',
    '/images/avatars/avatar4.png',
    '/images/avatars/avatar5.png',
    '/images/avatars/avatar6.png',
    '/images/avatars/avatar7.png',
    '/images/avatars/avatar8.png',
    '/images/avatars/avatar9.png',
    '/images/avatars/avatar10.png',
    '/images/avatars/avatar11.png',
    '/images/avatars/avatar12.png',
    '/images/avatars/avatar13.png',
    '/images/avatars/avatar14.png',
    '/images/avatars/avatar15.png',
    '/images/avatars/avatar16.png',
    '/images/avatars/avatar17.png',
    '/images/avatars/avatar18.png',
    '/images/avatars/avatar19.png',
    '/images/avatars/avatar20.png',
    '/images/avatars/avatar21.png',
    '/images/avatars/avatar22.png',
    '/images/avatars/avatar23.png',
    '/images/avatars/avatar24.png',
    '/images/avatars/avatar25.png',
    '/images/avatars/avatar26.png',
    '/images/avatars/avatar27.png',
    '/images/avatars/avatar28.png',
];

// 아바타 배경색 목록 (원형 배경에 사용)
const avatarColors = [
    '#9333ea', // 보라색
    '#3b82f6', // 파란색
    '#10b981', // 녹색
    '#f59e0b', // 주황색
    '#ef4444', // 빨간색
    '#ec4899', // 핑크색
    '#6366f1', // 인디고
    '#8b5cf6', // 바이올렛
    '#14b8a6', // 청록색
    '#f97316', // 오렌지
    '#84cc16', // 라임
    '#06b6d4', // 시안
    '#a855f7', // 자주색
    '#f43f5e', // 로즈
    '#0ea5e9', // 하늘색
];

function getRandomAvatar() {
    const imageUrl = avatarImages[Math.floor(Math.random() * avatarImages.length)];
    const color = avatarColors[Math.floor(Math.random() * avatarColors.length)];
    return { imageUrl, color };
}

io.on('connection', (socket) => {
    console.log(`✅ 클라이언트 연결: ${socket.id}`);

    // 토론방 입장
    socket.on('join-room', async (data) => {
        try {
            const { discussionId, userName, userRole } = data;

            // Socket.io 룸에 입장
            socket.join(`discussion-${discussionId}`);

            // 데이터베이스에 참여자 추가 또는 업데이트
            if (!global.discussionsStore) {
                // 토론방 정보 조회 (팀명 가져오기)
                const discussionInfo = await query(
                    'SELECT type, team1_name, team2_name FROM discussions WHERE id = $1',
                    [discussionId]
                );

                const discussion = discussionInfo[0];
                let actualRole = userRole || '참여자';

                // 팀전 모드인 경우 팀명으로 변환
                if (discussion && discussion.type === '팀전') {
                    if (userRole === 'team1' || userRole === '찬성') {
                        actualRole = discussion.team1_name || '찬성';
                    } else if (userRole === 'team2' || userRole === '반대') {
                        actualRole = discussion.team2_name || '반대';
                    }
                }

                // 기존 참여자 확인 (같은 토론방의 같은 이름)
                const existing = await query(
                    'SELECT id, emoji_avatar, user_role FROM participants WHERE discussion_id = $1 AND user_name = $2',
                    [discussionId, userName]
                );

                let participantId;
                if (existing.length > 0) {
                    // 기존 참여자가 있으면 socket_id와 is_online 업데이트
                    await query(
                        'UPDATE participants SET socket_id = $1, is_online = true, user_role = $2, last_seen = CURRENT_TIMESTAMP WHERE id = $3',
                        [socket.id, actualRole, existing[0].id]
                    );
                    participantId = existing[0].id;
                } else {
                    // 새로운 참여자 추가 (랜덤 아바타 할당)
                    const randomAvatar = getRandomAvatar();
                    const result = await query(
                        `INSERT INTO participants (discussion_id, user_name, user_role, socket_id, is_online, avatar_image_url, avatar_color)
                         VALUES ($1, $2, $3, $4, true, $5, $6)
                         RETURNING id`,
                        [discussionId, userName, actualRole, socket.id, randomAvatar.imageUrl, randomAvatar.color]
                    );
                    participantId = result[0].id;
                }

                socket.participantId = participantId;
                socket.discussionId = discussionId;

                // 참여자 목록 조회 (아바타 포함)
                const participants = await query(
                    'SELECT id, user_name, user_role, is_online, avatar_image_url, avatar_color FROM participants WHERE discussion_id = $1 AND is_online = true',
                    [discussionId]
                );

                // 방의 모든 사용자에게 참여자 목록 업데이트 전송
                io.to(`discussion-${discussionId}`).emit('participants-update', participants);

                // 기존 메시지 로드 (아바타 포함)
                const messages = await query(
                    `SELECT m.*, p.avatar_image_url, p.avatar_color
                     FROM messages m
                     LEFT JOIN participants p ON m.participant_id = p.id
                     WHERE m.discussion_id = $1
                     ORDER BY m.created_at ASC`,
                    [discussionId]
                );

                // 기존 메시지를 입장한 사용자에게만 전송
                socket.emit('load-messages', messages);

                // 시스템 메시지 전송 (모든 사용자에게)
                const systemMessage = {
                    id: Date.now(),
                    author: 'System',
                    role: 'system',
                    message: `${userName}님이 입장했습니다.`,
                    timestamp: new Date(),
                    is_ai: false,
                    message_type: 'system'
                };

                io.to(`discussion-${discussionId}`).emit('new-message', systemMessage);
            }

            console.log(`👤 ${userName} joined discussion ${discussionId}`);
        } catch (error) {
            console.error('토론방 입장 오류:', error);
            socket.emit('error', { message: '토론방 입장에 실패했습니다.' });
        }
    });

    // 메시지 전송
    socket.on('send-message', async (data) => {
        try {
            const { discussionId, message, userName, userRole } = data;

            if (!global.discussionsStore) {
                // 참여자 아바타 조회
                const participant = await query(
                    'SELECT avatar_image_url, avatar_color FROM participants WHERE id = $1',
                    [socket.participantId]
                );
                const avatarImageUrl = participant[0]?.avatar_image_url || '/images/avatars/avatar1.png';
                const avatarColor = participant[0]?.avatar_color || '#9333ea';

                // 데이터베이스에 메시지 저장
                const result = await query(
                    `INSERT INTO messages (discussion_id, participant_id, user_name, user_role, message, message_type)
                     VALUES ($1, $2, $3, $4, $5, 'chat')
                     RETURNING id, created_at`,
                    [discussionId, socket.participantId || null, userName, userRole, message]
                );

                // 방의 모든 사용자에게 메시지 전송 (아바타 포함)
                const messageData = {
                    id: result[0].id,
                    author: userName,
                    role: userRole,
                    message: message,
                    timestamp: result[0].created_at,
                    is_ai: false,
                    message_type: 'chat',
                    avatar_image_url: avatarImageUrl,
                    avatar_color: avatarColor
                };

                io.to(`discussion-${discussionId}`).emit('new-message', messageData);
            }
        } catch (error) {
            console.error('메시지 전송 오류:', error);
            socket.emit('error', { message: '메시지 전송에 실패했습니다.' });
        }
    });

    // Heartbeat - 클라이언트 활성 상태 확인
    socket.on('heartbeat', async () => {
        try {
            if (socket.participantId) {
                // 마지막 활동 시간 업데이트
                await query(
                    'UPDATE participants SET last_seen = CURRENT_TIMESTAMP WHERE id = $1',
                    [socket.participantId]
                );
            }
        } catch (error) {
            console.error('Heartbeat 처리 오류:', error);
        }
    });

    // AI 질문 전송 - 채팅창에 메시지로 표시
    socket.on('send-ai-question', async (data) => {
        try {
            const { discussionId, question, category, questionNumber } = data;

            if (!global.discussionsStore) {
                // 데이터베이스에 AI 질문 메시지 저장
                const result = await query(
                    `INSERT INTO messages (discussion_id, user_name, user_role, message, message_type, is_ai)
                     VALUES ($1, $2, $3, $4, 'ai-question', true)
                     RETURNING id, created_at`,
                    [discussionId, 'AI', 'AI 어시스턴트', `[${category}] ${question}`]
                );

                // 방의 모든 사용자에게 AI 질문 메시지 전송
                const messageData = {
                    id: result[0].id,
                    author: 'AI',
                    role: 'AI 어시스턴트',
                    message: `🤖 Q${questionNumber}. [${category}] ${question}`,
                    timestamp: result[0].created_at,
                    is_ai: true,
                    message_type: 'ai-question'
                };

                io.to(`discussion-${discussionId}`).emit('new-message', messageData);

                console.log(`🤖 AI 질문 전송 (토론방 ${discussionId}): ${question}`);
            }
        } catch (error) {
            console.error('AI 질문 전송 오류:', error);
            socket.emit('error', { message: 'AI 질문 전송에 실패했습니다.' });
        }
    });

    // 연결 해제
    socket.on('disconnect', async () => {
        try {
            console.log(`❌ 클라이언트 연결 해제: ${socket.id}`);

            if (!global.discussionsStore && socket.participantId && socket.discussionId) {
                // 참여자 오프라인 처리
                await query(
                    'UPDATE participants SET is_online = false, last_seen = CURRENT_TIMESTAMP WHERE id = $1',
                    [socket.participantId]
                );

                // 참여자 목록 조회
                const participants = await query(
                    'SELECT id, user_name, user_role, is_online FROM participants WHERE discussion_id = $1 AND is_online = true',
                    [socket.discussionId]
                );

                // 방의 모든 사용자에게 참여자 목록 업데이트 전송
                io.to(`discussion-${socket.discussionId}`).emit('participants-update', participants);
            }
        } catch (error) {
            console.error('연결 해제 처리 오류:', error);
        }
    });
});

// 서버 시작
async function startServer() {
    try {
        await initializeDatabase();

        server.listen(PORT, '0.0.0.0', () => {
            console.log(`\n🚀 Agora Insights 스타일 토론 게시판 서버 실행 (Socket.io 통합)`);
            console.log(`📍 URL: http://localhost:${PORT}`);
            console.log(`🕒 시작 시간: ${new Date().toLocaleString('ko-KR')}`);
            console.log(`📊 데이터베이스: ${global.discussionsStore ? 'SQLite (메모리)' : 'PostgreSQL'}`);
            console.log(`💬 실시간 채팅: 활성화`);
        });
    } catch (error) {
        console.error('서버 시작 실패:', error);
        process.exit(1);
    }
}

// 정리 함수
process.on('SIGTERM', async () => {
    console.log('서버 종료 중...');
    const { closeConnection } = require('./db');
    await closeConnection();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('서버 종료 중...');
    const { closeConnection } = require('./db');
    await closeConnection();
    process.exit(0);
});

startServer();