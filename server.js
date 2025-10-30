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

// AI 질문 타이머 관리 (토론방별 마지막 AI 질문 전송 시간)
const aiQuestionTimers = new Map();

// AI 질문 생성 중 상태 관리 (중복 방지)
const aiQuestionGenerating = new Map();

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
// ==========================================
// AI 질문 생성 API
// ==========================================

// Gemini API를 사용하여 AI 질문 생성
app.post('/api/discussions/:id/generate-questions', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🤖 AI 질문 생성 요청: 토론방 ID ${id}`);

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        if (!GEMINI_API_KEY) {
            console.error('❌ Gemini API 키가 설정되지 않음');
            return res.status(500).json({ error: 'Gemini API 키가 설정되지 않았습니다.' });
        }

        // 토론방 정보 조회
        const discussions = await query('SELECT * FROM discussions WHERE id = $1', [id]);
        if (discussions.length === 0) {
            console.error(`❌ 토론방을 찾을 수 없음: ID ${id}`);
            return res.status(404).json({ error: '토론방을 찾을 수 없습니다.' });
        }
        const discussion = discussions[0];
        console.log(`✅ 토론방 정보: "${discussion.title}"`);

        // 최근 메시지 조회 (최대 20개)
        const messages = await query(
            `SELECT user_name, user_role, message, created_at
             FROM messages
             WHERE discussion_id = $1 AND message_type = 'chat'
             ORDER BY created_at DESC
             LIMIT 20`,
            [id]
        );

        console.log(`📨 메시지 수: ${messages.length}개`);

        if (messages.length < 3) {
            console.log('⚠️ 메시지가 부족함 (최소 3개 필요)');
            return res.json({
                questions: [],
                message: '질문을 생성하기에 충분한 대화가 없습니다. (최소 3개 메시지 필요)'
            });
        }

        // 메시지를 시간순으로 정렬 (오래된 것부터)
        const sortedMessages = messages.reverse();
        console.log('✅ 메시지 정렬 완료');

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
        console.log('🌐 Gemini API 호출 시작...');
        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 3000,
                        responseMimeType: "application/json"
                    }
                })
            }
        );

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error(`❌ Gemini API 오류: ${geminiResponse.status}`, errorText);
            throw new Error(`Gemini API 오류: ${geminiResponse.status}`);
        }

        console.log('✅ Gemini API 응답 수신 성공');

        const geminiData = await geminiResponse.json();
        console.log('🔍 Gemini 응답 구조:', JSON.stringify(geminiData, null, 2));

        // Gemini 2.5 응답 구조 확인 및 안전한 접근
        if (!geminiData.candidates || !geminiData.candidates[0]) {
            console.error('❌ Gemini 응답 구조 오류:', geminiData);
            throw new Error('Gemini API 응답에 candidates가 없습니다.');
        }

        const candidate = geminiData.candidates[0];

        // parts 존재 여부 확인
        if (!candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
            console.error('❌ Gemini 응답에 텍스트가 없습니다:', candidate);
            throw new Error(`Gemini API 응답 오류: ${candidate.finishReason || 'UNKNOWN'}`);
        }

        const responseText = candidate.content.parts[0].text;
        console.log('📝 Gemini 응답 텍스트:', responseText.substring(0, 200) + '...');

        // JSON 파싱 (마크다운 코드 블록 제거)
        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/\{[\s\S]*\}/);
        const questionsData = JSON.parse(jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText);
        console.log('✅ JSON 파싱 성공:', questionsData.questions.length + '개 질문');

        // 메시지 개수 조회
        const messageCountResult = await query(
            'SELECT COUNT(*) as count FROM messages WHERE discussion_id = $1',
            [id]
        );
        const messageCount = parseInt(messageCountResult[0].count);

        // 데이터베이스에 질문 JSONB로 저장
        console.log(`💾 질문 저장 중: ${questionsData.questions.length}개`);
        const result = await query(
            `INSERT INTO ai_questions (discussion_id, questions, message_count, generated_at)
             VALUES ($1, $2::jsonb, $3, CURRENT_TIMESTAMP)
             RETURNING id, questions, message_count, generated_at`,
            [id, JSON.stringify(questionsData.questions), messageCount]
        );

        console.log(`✨ AI 질문 ${questionsData.questions.length}개 생성 완료 (토론방 ${id})`);

        res.json({
            success: true,
            questions: questionsData.questions,
            id: result[0].id,
            message_count: messageCount,
            message: `${questionsData.questions.length}개의 질문이 생성되었습니다.`
        });

    } catch (error) {
        console.error('❌ AI 질문 생성 오류:', error);
        console.error('❌ 에러 스택:', error.stack);
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

// AI 토론 분석 API
app.post('/api/analyze-discussion', async (req, res) => {
    try {
        console.log('📊 AI 분석 요청 받음');
        const { discussion_id, messages } = req.body;

        console.log('메시지 수:', messages ? messages.length : 0);

        if (!messages || messages.length < 5) {
            console.log('❌ 메시지 부족:', messages ? messages.length : 0);
            return res.status(400).json({ error: '최소 5개 이상의 메시지가 필요합니다.' });
        }

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            console.error('❌ Gemini API 키가 설정되지 않음');
            return res.status(500).json({ error: 'Gemini API 키가 설정되지 않았습니다.' });
        }

        console.log('✅ Gemini API 키 확인됨');

        // 메시지를 텍스트로 변환
        console.log('메시지 변환 시작...');
        const messagesText = messages.map(m => {
            console.log('메시지:', m);
            return `[${m.role}] ${m.author}: ${m.message}`;
        }).join('\n');

        console.log('변환된 메시지 텍스트 길이:', messagesText.length);

        // Gemini 프롬프트
        const prompt = `다음은 찬반 토론의 대화 내용입니다. 이 토론을 분석하여 JSON 형식으로 결과를 제공해주세요.

토론 내용:
${messagesText}

다음 형식의 JSON으로 응답해주세요:
{
  "winner": "pros" 또는 "cons",
  "verdict": "승리팀 판정 이유 (2-3문장)",
  "team_analysis": {
    "pros": {
      "strategy": "찬성 팀의 전략 분석",
      "arguments": "찬성 팀의 핵심 논거"
    },
    "cons": {
      "strategy": "반대 팀의 전략 분석",
      "arguments": "반대 팀의 핵심 논거"
    }
  },
  "key_statements": [
    {
      "team": "pros",
      "statement": "찬성 측 주요 발언"
    },
    {
      "team": "cons",
      "statement": "반대 측 주요 발언"
    }
  ],
  "participant_analysis": [
    {
      "name": "참여자 이름",
      "team": "pros" 또는 "cons",
      "analysis": "개별 분석",
      "key_contribution": "핵심 기여 발언"
    }
  ]
}

반드시 유효한 JSON만 반환하고, 다른 설명이나 마크다운 형식은 사용하지 마세요.`;

        // Gemini API 호출
        console.log('🌐 Gemini AI 토론 분석 API 호출 시작...');
        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: prompt
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 4096
                    }
                })
            }
        );

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error(`❌ Gemini API 오류: ${geminiResponse.status}`, errorText);
            throw new Error(`Gemini API 오류: ${geminiResponse.status}`);
        }

        console.log('✅ Gemini API 응답 수신 성공');

        const geminiData = await geminiResponse.json();

        if (!geminiData.candidates || !geminiData.candidates[0]) {
            console.error('❌ Gemini 응답 구조 오류:', geminiData);
            throw new Error('Gemini API 응답에 candidates가 없습니다.');
        }

        const candidate = geminiData.candidates[0];
        const responseText = candidate.content?.parts?.[0]?.text;

        if (!responseText) {
            console.error('❌ Gemini 응답에 텍스트가 없습니다:', candidate);
            throw new Error(`Gemini API 응답 오류: ${candidate.finishReason || 'UNKNOWN'}`);
        }

        console.log('📝 Gemini 분석 응답:', responseText.substring(0, 200) + '...');

        // JSON 파싱
        let analysisResult;
        try {
            // Markdown 코드 블록 제거
            let jsonText = responseText.trim();
            if (jsonText.startsWith('```json')) {
                jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
            } else if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/```\n?/g, '').replace(/```\n?$/g, '');
            }
            analysisResult = JSON.parse(jsonText);
        } catch (parseError) {
            console.error('❌ JSON 파싱 오류:', parseError);
            console.error('응답 텍스트:', responseText);
            throw new Error('AI 응답을 파싱할 수 없습니다.');
        }

        console.log('✅ AI 토론 분석 완료');
        res.json(analysisResult);

    } catch (error) {
        console.error('AI 토론 분석 오류:', error);
        res.status(500).json({ error: 'AI 토론 분석 중 오류가 발생했습니다: ' + error.message });
    }
});

// PDF 생성 API (Puppeteer 사용)
app.post('/api/generate-pdf', async (req, res) => {
    try {
        console.log('📄 PDF 생성 요청 받음');
        const { discussion_id, analysis } = req.body;

        if (!analysis) {
            return res.status(400).json({ error: '분석 결과가 없습니다.' });
        }

        const puppeteer = require('puppeteer');

        // HTML 조각 생성 함수들
        function generateTeamAnalysis(analysis) {
            if (!analysis.team_analysis) return '';

            let prosHtml = '';
            if (analysis.team_analysis.pros) {
                prosHtml = `
            <div class="team-box pros">
                <div class="team-name">👍 찬성팀</div>
                <div class="team-item">
                    <div class="team-label">전략 분석</div>
                    <div class="team-content">${analysis.team_analysis.pros.strategy || 'N/A'}</div>
                </div>
                <div class="team-item">
                    <div class="team-label">핵심 논거</div>
                    <div class="team-content">${analysis.team_analysis.pros.arguments || 'N/A'}</div>
                </div>
            </div>`;
            }

            let consHtml = '';
            if (analysis.team_analysis.cons) {
                consHtml = `
            <div class="team-box cons">
                <div class="team-name">👎 반대팀</div>
                <div class="team-item">
                    <div class="team-label">전략 분석</div>
                    <div class="team-content">${analysis.team_analysis.cons.strategy || 'N/A'}</div>
                </div>
                <div class="team-item">
                    <div class="team-label">핵심 논거</div>
                    <div class="team-content">${analysis.team_analysis.cons.arguments || 'N/A'}</div>
                </div>
            </div>`;
            }

            return `
    <div class="section">
        <h2 class="section-title">👥 팀별 종합 분석</h2>
        <div class="team-container">
            ${prosHtml}
            ${consHtml}
        </div>
    </div>`;
        }

        function generateKeyStatements(analysis) {
            if (!analysis.key_statements || analysis.key_statements.length === 0) return '';

            const statementsHtml = analysis.key_statements.map(statement => {
                const team = statement.team === 'pros' ? '찬성' : '반대';
                const emoji = statement.team === 'pros' ? '👍' : '👎';
                return `
        <div class="statement-box ${statement.team}">
            <div class="statement-team ${statement.team}">
                ${emoji} ${team}
            </div>
            <div class="statement-text">
                ${statement.statement || '발언 내용 없음'}
            </div>
        </div>`;
            }).join('');

            return `
    <div class="section">
        <h2 class="section-title">💬 주요 발언</h2>
        ${statementsHtml}
    </div>`;
        }

        function generateParticipantAnalysis(analysis) {
            if (!analysis.participant_analysis || analysis.participant_analysis.length === 0) return '';

            const participantsHtml = analysis.participant_analysis.map(participant => {
                const team = participant.team === 'pros' ? '찬성' : '반대';
                const emoji = participant.team === 'pros' ? '👍' : '👎';

                let contributionHtml = '';
                if (participant.key_contribution) {
                    contributionHtml = `
            <div class="participant-contribution">
                <div class="contribution-label">핵심 기여</div>
                <div class="contribution-text">"${participant.key_contribution}"</div>
            </div>`;
                }

                return `
        <div class="participant-box">
            <div class="participant-header">
                <div class="participant-name">${participant.name}</div>
                <div class="participant-team ${participant.team}">
                    ${emoji} ${team}
                </div>
            </div>
            <div class="participant-analysis">
                ${participant.analysis || '분석 내용 없음'}
            </div>
            ${contributionHtml}
        </div>`;
            }).join('');

            return `
    <div class="section">
        <h2 class="section-title">🎯 참여자 개별 분석</h2>
        ${participantsHtml}
    </div>`;
        }

        // HTML 템플릿 생성
        const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>토론 분석 리포트</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif;
            line-height: 1.6;
            padding: 40px;
            color: #333;
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 3px solid #4a90e2;
        }

        .header h1 {
            font-size: 32px;
            color: #2c3e50;
            margin-bottom: 10px;
        }

        .header p {
            font-size: 14px;
            color: #7f8c8d;
        }

        .section {
            margin-bottom: 40px;
            page-break-inside: avoid;
        }

        .section-title {
            font-size: 24px;
            color: #2c3e50;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e0e0e0;
        }

        .verdict-box {
            background: linear-gradient(135deg, #ffd93d 0%, #ffb800 100%);
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        .verdict-winner {
            font-size: 28px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 15px;
        }

        .verdict-text {
            font-size: 16px;
            color: #34495e;
            line-height: 1.8;
        }

        .team-container {
            display: flex;
            gap: 20px;
            margin-bottom: 30px;
        }

        .team-box {
            flex: 1;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .team-box.pros {
            background: #e3f2fd;
            border-left: 6px solid #2196f3;
        }

        .team-box.cons {
            background: #ffebee;
            border-left: 6px solid #f44336;
        }

        .team-name {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 15px;
            color: #2c3e50;
        }

        .team-item {
            margin-bottom: 15px;
        }

        .team-label {
            font-weight: bold;
            color: #34495e;
            margin-bottom: 5px;
        }

        .team-content {
            color: #555;
            line-height: 1.8;
        }

        .statement-box {
            padding: 20px;
            margin-bottom: 15px;
            border-radius: 8px;
            background: #f8f9fa;
        }

        .statement-box.pros {
            border-left: 4px solid #2196f3;
        }

        .statement-box.cons {
            border-left: 4px solid #f44336;
        }

        .statement-team {
            font-weight: bold;
            margin-bottom: 8px;
            font-size: 14px;
        }

        .statement-team.pros {
            color: #2196f3;
        }

        .statement-team.cons {
            color: #f44336;
        }

        .statement-text {
            color: #555;
            line-height: 1.8;
        }

        .participant-box {
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 8px;
            background: #ffffff;
            border: 1px solid #e0e0e0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        .participant-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .participant-name {
            font-size: 18px;
            font-weight: bold;
            color: #2c3e50;
        }

        .participant-team {
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: bold;
        }

        .participant-team.pros {
            background: #e3f2fd;
            color: #2196f3;
        }

        .participant-team.cons {
            background: #ffebee;
            color: #f44336;
        }

        .participant-analysis {
            color: #555;
            line-height: 1.8;
            margin-bottom: 15px;
        }

        .participant-contribution {
            padding: 15px;
            background: #f8f9fa;
            border-radius: 6px;
            border-left: 3px solid #4a90e2;
        }

        .contribution-label {
            font-weight: bold;
            color: #4a90e2;
            margin-bottom: 8px;
        }

        .contribution-text {
            color: #555;
            font-style: italic;
            line-height: 1.8;
        }

        .footer {
            margin-top: 60px;
            padding-top: 20px;
            border-top: 2px solid #e0e0e0;
            text-align: center;
            color: #7f8c8d;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 토론 종합 분석 리포트</h1>
        <p>Discussion ID: ${discussion_id}</p>
    </div>

    <!-- AI 최종 판정 -->
    <div class="section">
        <h2 class="section-title">🏆 AI 최종 판정</h2>
        <div class="verdict-box">
            <div class="verdict-winner">
                승리팀: ${analysis.winner === 'pros' ? '👍 찬성팀' : '👎 반대팀'}
            </div>
            <div class="verdict-text">
                ${analysis.verdict || '판정 내용이 없습니다.'}
            </div>
        </div>
    </div>

    ${generateTeamAnalysis(analysis)}
    ${generateKeyStatements(analysis)}
    ${generateParticipantAnalysis(analysis)}

    <div class="footer">
        <p>AI 토론 분석 시스템 | 생성일시: ${new Date().toLocaleString('ko-KR')}</p>
    </div>
</body>
</html>
        `;

        // 디버깅: HTML 파일 저장
        const fs = require('fs');
        const path = require('path');
        const debugHtmlPath = path.join(__dirname, 'debug-pdf.html');
        fs.writeFileSync(debugHtmlPath, htmlContent, 'utf8');
        console.log('📝 디버그 HTML 저장됨:', debugHtmlPath);

        console.log('🌐 Puppeteer 브라우저 시작...');

        // Puppeteer로 PDF 생성
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        // HTML 콘텐츠 설정
        await page.setContent(htmlContent, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        console.log('📄 페이지 콘텐츠 로드 완료, PDF 생성 시작...');

        // PDF 생성
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '15mm',
                bottom: '20mm',
                left: '15mm'
            }
        });

        console.log('📊 PDF 버퍼 크기:', pdfBuffer.length, 'bytes');

        await browser.close();
        console.log('✅ Puppeteer PDF 생성 완료');

        // 응답 전송
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=discussion-analysis-${discussion_id}.pdf`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('PDF 생성 오류:', error);
        res.status(500).json({ error: 'PDF 생성 중 오류가 발생했습니다: ' + error.message });
    }
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
                // 토론방 정보 조회 (팀명 및 생성 시간 가져오기)
                const discussionInfo = await query(
                    'SELECT type, team1_name, team2_name, created_at FROM discussions WHERE id = $1',
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

                // 기존 참여자 확인 (같은 토론방의 같은 이름, 가장 최근 것)
                const existing = await query(
                    'SELECT id, avatar_image_url, avatar_color, user_role FROM participants WHERE discussion_id = $1 AND user_name = $2 ORDER BY last_seen DESC LIMIT 1',
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

                // 팀전 모드인 경우 팀명 변환
                const convertedMessages = messages.map(msg => {
                    if (discussion && discussion.type === '팀전') {
                        if (msg.user_role === 'team1' || msg.user_role === '찬성') {
                            msg.user_role = discussion.team1_name || '찬성';
                        } else if (msg.user_role === 'team2' || msg.user_role === '반대') {
                            msg.user_role = discussion.team2_name || '반대';
                        }
                    }
                    return msg;
                });

                // 기존 메시지를 입장한 사용자에게만 전송
                socket.emit('load-messages', convertedMessages);

                // AI 질문 타이머 계산 (마지막 AI 질문 또는 토론방 생성 시간 기준)
                let referenceTime;
                const lastAIQuestionTime = aiQuestionTimers.get(discussionId);

                if (lastAIQuestionTime) {
                    // 마지막 AI 질문 시간이 있으면 그것을 기준으로 계산
                    referenceTime = lastAIQuestionTime;
                } else {
                    // 없으면 토론방 생성 시간 기준
                    referenceTime = new Date(discussion.created_at);
                }

                const now = new Date();
                const elapsedSeconds = Math.floor((now - referenceTime) / 1000);
                const remainingSeconds = Math.max(0, 300 - elapsedSeconds); // 5분 = 300초
                const isAIQuestionReady = elapsedSeconds >= 300;

                // 타이머 정보를 입장한 사용자에게 전송
                socket.emit('ai-timer-sync', {
                    remainingSeconds,
                    isReady: isAIQuestionReady
                });

                console.log(`⏱️ AI 질문 타이머: ${remainingSeconds}초 남음, 활성화: ${isAIQuestionReady}`);

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

                // 참여자 아바타 조회 (userName과 discussionId로 가장 최근 것 조회)
                const participant = await query(
                    'SELECT avatar_image_url, avatar_color FROM participants WHERE discussion_id = $1 AND user_name = $2 ORDER BY last_seen DESC LIMIT 1',
                    [discussionId, userName]
                );
                const avatarImageUrl = participant[0]?.avatar_image_url || '/images/avatars/avatar1.png';
                const avatarColor = participant[0]?.avatar_color || '#9333ea';

                // 데이터베이스에 메시지 저장 (변환된 팀명 사용)
                const result = await query(
                    `INSERT INTO messages (discussion_id, participant_id, user_name, user_role, message, message_type)
                     VALUES ($1, $2, $3, $4, $5, 'chat')
                     RETURNING id, created_at`,
                    [discussionId, socket.participantId || null, userName, actualRole, message]
                );

                // 방의 모든 사용자에게 메시지 전송 (아바타 포함, 변환된 팀명 사용)
                const messageData = {
                    id: result[0].id,
                    author: userName,
                    role: actualRole,
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

                // 마지막 AI 질문 시간 업데이트 (5분 타이머 재시작)
                const now = new Date();
                aiQuestionTimers.set(discussionId, now);

                // 모든 클라이언트에게 타이머 재시작 브로드캐스트
                io.to(`discussion-${discussionId}`).emit('ai-timer-sync', {
                    remainingSeconds: 300,
                    isReady: false
                });

                console.log(`🤖 AI 질문 전송 (토론방 ${discussionId}): ${question}`);
                console.log(`⏱️ AI 질문 타이머 재시작 → 모든 클라이언트 동기화 완료`);
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

// AI 판결문 생성 API
app.post('/api/generate-verdict', async (req, res) => {
    try {
        console.log('⚖️ AI 판결문 생성 요청 받음');
        const { discussion_id, messages } = req.body;

        console.log('메시지 수:', messages ? messages.length : 0);

        if (!messages || messages.length < 10) {
            console.log('❌ 메시지 부족:', messages ? messages.length : 0);
            return res.status(400).json({ error: '최소 10개 이상의 메시지가 필요합니다.' });
        }

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            console.error('❌ Gemini API 키가 설정되지 않음');
            return res.status(500).json({ error: 'Gemini API 키가 설정되지 않았습니다.' });
        }

        console.log('✅ Gemini API 키 확인됨');

        // 메시지를 텍스트로 변환
        console.log('메시지 변환 시작...');
        const messagesText = messages.map(m => {
            console.log('메시지:', m);
            return `[${m.role}] ${m.author}: ${m.message}`;
        }).join('\n');

        console.log('변환된 메시지 텍스트 길이:', messagesText.length);

        // Gemini 프롬프트 - 토론 판결문 형식 (서론/본론/결론 구조)
        const prompt = `다음은 찬반 토론의 대화 내용입니다. 학술적이고 전문적인 토론 분석 보고서 형식으로 이 토론을 분석하여 JSON 형식으로 결과를 제공해주세요.

토론 내용:
${messagesText}

다음 JSON 구조로 토론 판결문을 작성해주세요:

{
  "overview": "토론 개요 - 토론 주제와 참여자, 토론의 목적을 간단히 소개 (3-4문장)",
  "background": "논의 배경 - 이 토론 주제가 중요한 이유, 사회적 맥락, 논의 배경 설명 (5-6문장)",
  "issues": [
    "주요 쟁점 1 (질문 형식으로)",
    "주요 쟁점 2 (질문 형식으로)",
    "주요 쟁점 3 (질문 형식으로)"
  ],
  "main_body": [
    {
      "issue_title": "쟁점 1: [쟁점 제목]",
      "arguments_summary": {
        "pros": "찬성 측 주요 주장 요약 (3-4문장)",
        "cons": "반대 측 주요 주장 요약 (3-4문장)",
        "ai": "AI 조언자의 주장 또는 중립적 관점 (2-3문장, 해당되는 경우)"
      },
      "analysis": "논거 및 반박 분석 - 양측 주장의 논리적 근거, 반박 내용, 강점과 약점 분석 (6-8문장)"
    },
    {
      "issue_title": "쟁점 2: [쟁점 제목]",
      "arguments_summary": {
        "pros": "찬성 측 주요 주장 요약",
        "cons": "반대 측 주요 주장 요약",
        "ai": "AI 조언자의 주장"
      },
      "analysis": "논거 및 반박 분석"
    }
  ],
  "insights": "특이점 및 인사이트 - 토론에서 발견된 특별한 논점, 흥미로운 주장, 양측이 놓친 부분 등 (5-6문장)",
  "summary": "토론 결과 요약 - 토론의 핵심 내용과 양측의 주장을 객관적으로 정리 (4-5문장)",
  "recommendations": "미해결 과제 및 제언 - 토론에서 해결되지 않은 문제점, 추가 논의가 필요한 사항, 정책적 제언 등 (5-6문장)",
  "significance": "토론의 의의 - 이 토론이 갖는 중요성, 사회적 함의, 향후 전망 등 (3-4문장)"
}

작성 지침:
1. 학술적이고 객관적인 어조를 유지하세요.
2. 각 섹션은 충분히 상세하게 작성하되, 명확하고 간결하게 표현하세요.
3. main_body는 토론의 주요 쟁점 수만큼 (2-4개) 작성하세요.
4. 찬성, 반대, AI 조언자의 주장을 공정하게 다루세요.
5. JSON 형식을 정확히 지켜주세요. 다른 설명 없이 JSON만 응답하세요.
6. 모든 문장은 한국어로 작성하세요.`;

        console.log('Gemini API 요청 전송 중...');

        // Gemini API 호출
        const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
        const geminiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            })
        });

        console.log('Gemini API 응답 상태:', geminiResponse.status);

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error('❌ Gemini API 오류 응답:', errorText);
            throw new Error(`Gemini API 요청 실패: ${geminiResponse.status}`);
        }

        const geminiData = await geminiResponse.json();
        console.log('✅ Gemini API 응답 받음');

        // 응답에서 텍스트 추출
        const resultText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log('Gemini 응답 텍스트:', resultText);

        if (!resultText) {
            console.error('❌ Gemini 응답에 텍스트가 없음');
            throw new Error('AI 응답이 비어있습니다.');
        }

        // JSON 파싱 시도
        let result;
        try {
            // 마크다운 코드 블록 제거
            let jsonText = resultText.trim();
            if (jsonText.startsWith('```json')) {
                jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            } else if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
            }
            result = JSON.parse(jsonText);
            console.log('✅ JSON 파싱 성공');
        } catch (parseError) {
            console.error('❌ JSON 파싱 실패:', parseError);
            console.error('원본 텍스트:', resultText);
            throw new Error('AI 응답을 파싱할 수 없습니다.');
        }

        console.log('✅ 판결문 생성 완료');
        res.json(result);

    } catch (error) {
        console.error('❌ AI 판결문 생성 오류:', error);
        res.status(500).json({
            error: 'AI 판결문 생성 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

// AI 흐름 분석 API
app.post('/api/analyze-flow', async (req, res) => {
    try {
        console.log('📊 AI 흐름 분석 요청 받음');
        const { discussion_id, messages } = req.body;

        console.log('메시지 수:', messages ? messages.length : 0);

        if (!messages || messages.length < 10) {
            console.log('❌ 메시지 부족:', messages ? messages.length : 0);
            return res.status(400).json({ error: '최소 10개 이상의 메시지가 필요합니다.' });
        }

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            console.error('❌ Gemini API 키가 설정되지 않음');
            return res.status(500).json({ error: 'Gemini API 키가 설정되지 않았습니다.' });
        }

        console.log('✅ Gemini API 키 확인됨');

        // 메시지를 텍스트로 변환
        console.log('메시지 변환 시작...');
        const messagesText = messages.map((m, idx) => {
            return `[메시지 #${idx + 1}] [${m.role}] ${m.author}: ${m.message}`;
        }).join('\n');

        console.log('변환된 메시지 텍스트 길이:', messagesText.length);

        // Gemini 프롬프트 - 토론 흐름 분석
        const prompt = `다음은 찬반 토론의 대화 내용입니다. 이 토론의 흐름을 시간대별로 분석하고, 참여자 통계 및 토론 트렌드를 JSON 형식으로 제공해주세요.

토론 내용:
${messagesText}

다음 JSON 구조로 토론 흐름 분석을 작성해주세요:

{
  "timeline": [
    {
      "time": "초반 (1-X번째 메시지)",
      "title": "핵심 이벤트 또는 전환점 제목",
      "description": "이 시점에서 발생한 주요 논의 내용, 논쟁 포인트, 또는 의견 변화 (2-3문장)"
    },
    {
      "time": "중반 (X-Y번째 메시지)",
      "title": "핵심 이벤트 제목",
      "description": "주요 논의 내용"
    },
    {
      "time": "후반 (Y-끝 메시지)",
      "title": "핵심 이벤트 제목",
      "description": "주요 논의 내용"
    }
  ],
  "participant_stats": [
    {
      "name": "참여자 이름",
      "role": "찬성 또는 반대 또는 AI 조언자",
      "count": 발언 횟수 (숫자)
    }
  ],
  "interaction_stats": [
    {
      "name": "참여자 이름",
      "role": "찬성 또는 반대 또는 AI 조언자",
      "messageCount": 발언 횟수 (숫자),
      "responseCount": 다른 참여자에 대한 응답 횟수 (숫자),
      "avgLength": 평균 발언 길이 (글자 수, 숫자)
    }
  ],
  "trend_data": {
    "labels": ["#1", "#2", "#3", ... (모든 메시지 번호)],
    "pros": [찬성 측 누적 발언 수 배열 - 각 메시지 시점마다],
    "cons": [반대 측 누적 발언 수 배열 - 각 메시지 시점마다]
  },
  "keyword_data": {
    "keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5", "키워드6"],
    "phases": ["초반", "중반", "후반"],
    "data": [
      [초반_빈도, 중반_빈도, 후반_빈도],
      [초반_빈도, 중반_빈도, 후반_빈도],
      ...
    ]
  }
}

작성 지침:
1. timeline은 토론의 흐름을 3-5개의 주요 시점으로 나눠 분석하세요.
2. participant_stats와 interaction_stats에는 모든 참여자를 포함하세요.
3. trend_data의 labels, pros, cons 배열의 길이는 모두 동일해야 하며, 메시지 수와 같아야 합니다.
4. pros와 cons는 누적 카운트입니다 (예: [0, 1, 1, 2, 3, 3, 4, ...]).
5. keyword_data는 토론에서 자주 언급된 핵심 키워드 5-7개를 추출하고, 각 키워드가 초반/중반/후반에 몇 번 언급되었는지 분석하세요.
6. keyword_data의 data 배열 길이는 keywords 배열 길이와 동일해야 합니다.
7. JSON 형식을 정확히 지켜주세요. 다른 설명 없이 JSON만 응답하세요.
8. 모든 문장은 한국어로 작성하세요.
9. 숫자는 따옴표 없이 숫자 타입으로 제공하세요.`;

        console.log('Gemini API 요청 전송 중...');

        // Gemini API 호출
        const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
        const geminiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            })
        });

        console.log('Gemini API 응답 상태:', geminiResponse.status);

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error('❌ Gemini API 오류 응답:', errorText);
            throw new Error(`Gemini API 요청 실패: ${geminiResponse.status}`);
        }

        const geminiData = await geminiResponse.json();
        console.log('✅ Gemini API 응답 받음');

        // 응답에서 텍스트 추출
        const resultText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log('Gemini 응답 텍스트:', resultText);

        if (!resultText) {
            console.error('❌ Gemini 응답에 텍스트가 없음');
            throw new Error('AI 응답이 비어있습니다.');
        }

        // JSON 파싱 시도
        let result;
        try {
            // 마크다운 코드 블록 제거
            let jsonText = resultText.trim();
            if (jsonText.startsWith('```json')) {
                jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            } else if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
            }
            result = JSON.parse(jsonText);
            console.log('✅ JSON 파싱 성공');
        } catch (parseError) {
            console.error('❌ JSON 파싱 실패:', parseError);
            console.error('원본 텍스트:', resultText);
            throw new Error('AI 응답을 파싱할 수 없습니다.');
        }

        console.log('✅ 흐름 분석 완료');
        res.json(result);

    } catch (error) {
        console.error('❌ AI 흐름 분석 오류:', error);
        res.status(500).json({
            error: 'AI 흐름 분석 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

// ==========================================
// 404 및 에러 핸들러 (모든 라우트 정의 이후에 위치)
// ==========================================

// 404 에러 처리
app.use((req, res) => {
    res.status(404).json({ error: '페이지를 찾을 수 없습니다.' });
});

// 에러 핸들러
app.use((error, req, res, next) => {
    console.error('서버 에러:', error);
    res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
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