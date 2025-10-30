# 🤖 GPT/AI 통합 상세 분석

## 📋 원본 Agora Insights의 GPT 활용 방식

### 1. GPT를 "참여자"로 취급
**핵심 개념**: AI를 단순한 도구가 아닌 토론 참여자로 구현

**구현 방식**:
```
참여자 목록:
├── 👤 김철수 (찬성)
├── 👤 이영희 (반대)
├── 🤖 GPT (중재자)  ← AI도 참여자 목록에 표시
└── 👤 박민수 (찬성)
```

**데이터베이스 구조**:
```sql
-- participants 테이블에서 AI도 일반 참여자와 동일하게 저장
INSERT INTO participants (discussion_id, user_name, user_role, is_ai)
VALUES (1, 'GPT', '중재자', true);
```

**Socket.io 이벤트**:
```javascript
// GPT 메시지도 일반 채팅 메시지와 동일한 이벤트 사용
socket.emit('chat-message', {
    author: 'GPT',
    role: '중재자',
    message: '이 논점에 대해 좀 더 구체적인 근거를 제시해주실 수 있을까요?',
    isAI: true  // UI 구분용 플래그
});
```

---

## 🎯 GPT 역할별 활용 시나리오

### 시나리오 1: 중재자 역할
**목적**: 토론 진행 및 균형 유지

**GPT 프롬프트 예시**:
```
당신은 토론의 중재자입니다.
현재 토론 내용을 분석하고 다음을 수행하세요:

1. 한쪽으로 치우친 토론이라면 반대 의견을 유도하는 질문
2. 토론이 정체된 경우 새로운 관점 제시
3. 감정적으로 격해지면 논의를 객관적으로 유도

현재 채팅 내역:
${chatHistory}

중재자로서 한 문장의 개입 메시지를 작성하세요.
```

### 시나리오 2: 역할극 참여자
**목적**: 특정 직업/역할의 관점에서 의견 제시

**GPT 프롬프트 예시**:
```
당신은 "응급의학과 의사"입니다.
착한 사마리아인 법에 대한 토론에서 의료 전문가 관점으로 발언하세요.

현재 토론 흐름:
${chatHistory}

의사로서 현실적이고 전문적인 의견 1-2문장을 제시하세요.
```

### 시나리오 3: 데빌스 어드보킷 (반론 제기자)
**목적**: 토론 심화를 위한 의도적 반론

**GPT 프롬프트 예시**:
```
당신은 데빌스 어드보킷(악마의 변호인) 역할입니다.
현재 우세한 의견에 대해 건설적인 반론을 제기하세요.

주류 의견: ${mainOpinion}

논리적이고 생각할 거리를 제공하는 반론을 작성하세요.
```

---

## 🔄 GPT 개입 타이밍 전략

### 1. 시간 기반 개입 (5분 규칙)
```javascript
class AIParticipant {
    constructor(discussionId) {
        this.discussionId = discussionId;
        this.lastIntervention = Date.now();
        this.MINIMUM_INTERVAL = 5 * 60 * 1000;  // 5분
    }

    async checkIntervention() {
        const now = Date.now();
        const timeSinceLastIntervention = now - this.lastIntervention;

        if (timeSinceLastIntervention >= this.MINIMUM_INTERVAL) {
            const shouldIntervene = await this.analyzeNeedForIntervention();

            if (shouldIntervene) {
                await this.generateAndSendMessage();
                this.lastIntervention = now;
            }
        }
    }

    async analyzeNeedForIntervention() {
        const recentMessages = await getRecentMessages(this.discussionId, 10);

        // 개입 필요 조건:
        // 1. 메시지가 너무 적음 (침체)
        // 2. 한쪽 의견만 계속 나옴 (불균형)
        // 3. 같은 논점 반복 (정체)

        if (recentMessages.length < 5) {
            return { shouldIntervene: true, reason: 'stagnant' };
        }

        const prosCount = recentMessages.filter(m => m.role === '찬성').length;
        const consCount = recentMessages.filter(m => m.role === '반대').length;

        if (Math.abs(prosCount - consCount) > 5) {
            return { shouldIntervene: true, reason: 'unbalanced' };
        }

        return { shouldIntervene: false };
    }

    async generateAndSendMessage() {
        const chatHistory = await getChatHistory(this.discussionId);
        const analysisResult = await this.analyzeNeedForIntervention();

        let prompt;
        switch (analysisResult.reason) {
            case 'stagnant':
                prompt = this.generateStagnantPrompt(chatHistory);
                break;
            case 'unbalanced':
                prompt = this.generateUnbalancedPrompt(chatHistory);
                break;
            default:
                prompt = this.generateGeneralPrompt(chatHistory);
        }

        const aiMessage = await callGeminiAPI(prompt);

        // GPT 메시지를 채팅방에 전송
        io.to(`discussion-${this.discussionId}`).emit('chat-message', {
            author: 'GPT',
            role: '중재자',
            message: aiMessage,
            isAI: true,
            timestamp: new Date()
        });

        // 데이터베이스에 저장
        await query(
            'INSERT INTO messages (discussion_id, user_name, user_role, message, message_type) VALUES ($1, $2, $3, $4, $5)',
            [this.discussionId, 'GPT', '중재자', aiMessage, 'ai_intervention']
        );
    }

    generateStagnantPrompt(chatHistory) {
        return `
        토론이 침체되었습니다. 다음 채팅 내역을 보고 토론을 활성화할 수 있는
        새로운 관점이나 질문을 한 문장으로 제시하세요.

        채팅 내역:
        ${chatHistory}

        중재자로서 참여자들이 다시 대화에 참여하고 싶게 만드는 메시지를 작성하세요.
        `;
    }

    generateUnbalancedPrompt(chatHistory) {
        return `
        토론이 한쪽으로 치우쳤습니다. 다음 채팅 내역을 분석하고
        소수 의견을 대변하거나 균형을 맞출 수 있는 관점을 제시하세요.

        채팅 내역:
        ${chatHistory}

        공정한 중재자로서 토론의 균형을 맞추는 메시지를 작성하세요.
        `;
    }
}

// 사용법
const aiParticipants = new Map();

socket.on('discussion-joined', (discussionId, userId) => {
    if (!aiParticipants.has(discussionId)) {
        const aiParticipant = new AIParticipant(discussionId);

        // 5분마다 개입 필요성 체크
        setInterval(() => {
            aiParticipant.checkIntervention();
        }, 60 * 1000);  // 1분마다 체크 (실제 개입은 5분 간격)

        aiParticipants.set(discussionId, aiParticipant);
    }
});
```

---

## 💡 AI 질문 생성 시스템

### Phase 1: 초기 질문 생성 (토론 시작 5분 후)
```javascript
async function generateInitialQuestions(discussionId) {
    const discussion = await getDiscussionDetails(discussionId);
    const chatHistory = await getChatHistory(discussionId);

    const prompt = `
    토론 주제: ${discussion.title}
    토론 설명: ${discussion.description}

    지금까지의 대화:
    ${chatHistory}

    이 토론을 심화시키기 위한 3가지 질문을 생성하세요.
    각 질문은 다음 유형 중 하나여야 합니다:
    1. 전제 도전: 기본 가정에 의문을 제기
    2. 구체화: 추상적 논의를 현실적으로 구체화
    3. 관점 확장: 고려하지 않은 이해관계자나 상황 제시

    JSON 배열 형식으로 반환:
    [
        {
            "type": "전제 도전",
            "question": "..."
        },
        {
            "type": "구체화",
            "question": "..."
        },
        {
            "type": "관점 확장",
            "question": "..."
        }
    ]
    `;

    const response = await callGeminiAPI(prompt);
    const questions = JSON.parse(response);

    // 데이터베이스에 저장
    await query(
        'INSERT INTO ai_questions (discussion_id, questions) VALUES ($1, $2)',
        [discussionId, JSON.stringify(questions)]
    );

    // 채팅방에 특별한 UI 카드로 전송
    io.to(`discussion-${discussionId}`).emit('ai-questions', questions);

    return questions;
}
```

### Phase 2: 동적 질문 생성 (토론 흐름 기반)
```javascript
class DynamicQuestionGenerator {
    constructor(discussionId) {
        this.discussionId = discussionId;
        this.lastQuestionTime = null;
        this.questionHistory = [];
    }

    async monitorAndGenerate() {
        const chatHistory = await getChatHistory(this.discussionId);

        // 토론 흐름 분석
        const analysis = await this.analyzeDiscussionFlow(chatHistory);

        if (this.shouldGenerateQuestion(analysis)) {
            const question = await this.generateContextualQuestion(chatHistory, analysis);
            this.sendQuestion(question);
        }
    }

    async analyzeDiscussionFlow(chatHistory) {
        const prompt = `
        다음 토론 내용을 분석하여 JSON 형식으로 반환하세요:

        ${chatHistory}

        분석 항목:
        {
            "mainTopics": ["논의된 주요 주제들"],
            "repeatingArguments": ["반복되는 논점들"],
            "missingPerspectives": ["고려되지 않은 관점들"],
            "emotionalTone": "객관적/격양됨/침체됨",
            "needsIntervention": true/false
        }
        `;

        const response = await callGeminiAPI(prompt);
        return JSON.parse(response);
    }

    shouldGenerateQuestion(analysis) {
        // 질문 생성 조건
        const conditions = [
            analysis.repeatingArguments.length > 2,  // 같은 논점 반복
            analysis.missingPerspectives.length > 0,  // 누락된 관점 존재
            analysis.emotionalTone === '격양됨',      // 감정적으로 치우침
            analysis.needsIntervention                // AI가 개입 필요하다고 판단
        ];

        return conditions.some(c => c);
    }

    async generateContextualQuestion(chatHistory, analysis) {
        const prompt = `
        토론 분석 결과:
        ${JSON.stringify(analysis, null, 2)}

        현재 채팅 내역:
        ${chatHistory}

        위 분석을 바탕으로 토론을 건설적인 방향으로 이끌 수 있는
        하나의 질문을 생성하세요.

        질문은 다음 조건을 만족해야 합니다:
        - 참여자들이 새로운 각도에서 생각하게 만듦
        - 감정보다는 논리에 집중하도록 유도
        - 누락된 관점을 고려하도록 유도

        질문만 반환하세요. (설명 불필요)
        `;

        return await callGeminiAPI(prompt);
    }

    sendQuestion(question) {
        this.lastQuestionTime = Date.now();
        this.questionHistory.push(question);

        io.to(`discussion-${this.discussionId}`).emit('ai-question-single', {
            question,
            timestamp: new Date(),
            type: 'contextual'
        });

        // 데이터베이스 저장
        query(
            'INSERT INTO ai_questions (discussion_id, questions, question_type) VALUES ($1, $2, $3)',
            [this.discussionId, JSON.stringify([question]), 'contextual']
        );
    }
}
```

---

## 📊 AI 분석 상세 구현

### 1. 실시간 토론 요약 (스트리밍)
```javascript
async function generateStreamingSummary(discussionId) {
    const chatHistory = await getChatHistory(discussionId);

    const prompt = `
    다음 토론 내용을 실시간으로 요약하세요:

    ${chatHistory}

    요약 형식:
    {
        "currentStatus": "현재 토론이 어떤 상태인지 (진행 중/교착 상태/합의 도출 중)",
        "prosPosition": "찬성 측 주장 요약",
        "consPosition": "반대 측 주장 요약",
        "keyDisagreements": ["주요 의견 차이 1", "주요 의견 차이 2"],
        "commonGround": ["합의된 부분 1", "합의된 부분 2"],
        "nextSteps": "토론을 발전시키기 위한 제안"
    }
    `;

    const summary = await callGeminiAPI(prompt);
    return JSON.parse(summary);
}

// 실시간 업데이트 (메시지 10개마다 요약 갱신)
let messageCount = 0;

socket.on('chat-message', async (data) => {
    messageCount++;

    if (messageCount % 10 === 0) {
        const summary = await generateStreamingSummary(data.discussionId);

        io.to(`discussion-${data.discussionId}`).emit('summary-update', summary);
    }
});
```

### 2. 참여도 심화 분석
```javascript
async function analyzeParticipation(discussionId) {
    const messages = await query(
        'SELECT user_name, user_role, message, created_at FROM messages WHERE discussion_id = $1',
        [discussionId]
    );

    // 정량적 분석
    const quantitative = {
        totalMessages: messages.length,
        byUser: {},
        byRole: {},
        messageLength: {}
    };

    messages.forEach(msg => {
        // 사용자별 발언 수
        quantitative.byUser[msg.user_name] = (quantitative.byUser[msg.user_name] || 0) + 1;

        // 역할별 발언 수
        quantitative.byRole[msg.user_role] = (quantitative.byRole[msg.user_role] || 0) + 1;

        // 사용자별 평균 메시지 길이
        if (!quantitative.messageLength[msg.user_name]) {
            quantitative.messageLength[msg.user_name] = [];
        }
        quantitative.messageLength[msg.user_name].push(msg.message.length);
    });

    // 질적 분석 (AI 활용)
    const qualitative = await analyzeParticipationQuality(messages);

    return {
        quantitative,
        qualitative
    };
}

async function analyzeParticipationQuality(messages) {
    const prompt = `
    다음 토론 메시지들을 분석하여 참여자별 기여도를 평가하세요:

    ${messages.map(m => `[${m.user_name}] ${m.message}`).join('\n')}

    각 참여자에 대해 평가:
    {
        "참여자명": {
            "argumentQuality": "논점의 질 (1-5점)",
            "engagement": "다른 참여자와의 상호작용 정도 (1-5점)",
            "evidenceUse": "근거 제시 정도 (1-5점)",
            "respectfulness": "존중하는 태도 (1-5점)",
            "summary": "참여 특성 한 문장 요약"
        }
    }

    JSON 형식으로 반환하세요.
    `;

    const response = await callGeminiAPI(prompt);
    return JSON.parse(response);
}
```

### 3. 토론 품질 평가
```javascript
async function evaluateDiscussionQuality(discussionId) {
    const messages = await getChatHistory(discussionId);

    const prompt = `
    다음 토론 내용을 종합적으로 평가하세요:

    ${messages}

    평가 항목:
    {
        "overallScore": "전체 점수 (1-10)",
        "criteria": {
            "depth": {
                "score": "논의 깊이 (1-10)",
                "comment": "평가 설명"
            },
            "balance": {
                "score": "균형성 (1-10)",
                "comment": "평가 설명"
            },
            "civility": {
                "score": "시민성 (1-10)",
                "comment": "평가 설명"
            },
            "productivity": {
                "score": "생산성 (1-10)",
                "comment": "평가 설명"
            }
        },
        "strengths": ["강점 1", "강점 2", "강점 3"],
        "improvements": ["개선점 1", "개선점 2", "개선점 3"],
        "highlights": ["가장 인상적인 발언이나 순간들"]
    }

    JSON 형식으로 반환하세요.
    `;

    const evaluation = await callGeminiAPI(prompt);
    return JSON.parse(evaluation);
}
```

---

## 🎨 AI 메시지 UI 차별화

### GPT 메시지 스타일링
```css
/* 일반 사용자 메시지 */
.chat-message.user {
    background: #ffffff;
    border-left: 3px solid #3498db;
}

/* AI 메시지 - 구분되는 스타일 */
.chat-message.ai {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-left: 3px solid #f59e0b;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.chat-message.ai .author {
    font-weight: bold;
}

.chat-message.ai .author::before {
    content: '🤖 ';
}

/* AI 질문 카드 - 더욱 두드러지게 */
.ai-question-card {
    background: #fef3c7;
    border: 2px dashed #f59e0b;
    border-radius: 12px;
    padding: 20px;
    margin: 20px 0;
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);
}

.ai-question-card .question-header {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 18px;
    font-weight: bold;
    color: #92400e;
    margin-bottom: 15px;
}

.ai-question-card .question-item {
    background: white;
    padding: 12px;
    margin: 8px 0;
    border-radius: 8px;
    cursor: pointer;
    transition: transform 0.2s;
}

.ai-question-card .question-item:hover {
    transform: translateX(5px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
```

---

## ⚙️ Gemini API 최적화 전략

### 1. 프롬프트 캐싱
```javascript
class PromptCache {
    constructor() {
        this.cache = new Map();
        this.CACHE_TTL = 10 * 60 * 1000;  // 10분
    }

    getCacheKey(prompt) {
        // 프롬프트의 해시 생성 (간단한 방법)
        return prompt.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0).toString();
    }

    get(prompt) {
        const key = this.getCacheKey(prompt);
        const cached = this.cache.get(key);

        if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL)) {
            return cached.response;
        }

        return null;
    }

    set(prompt, response) {
        const key = this.getCacheKey(prompt);
        this.cache.set(key, {
            response,
            timestamp: Date.now()
        });
    }
}

const promptCache = new PromptCache();

async function callGeminiAPI(prompt) {
    // 캐시 확인
    const cached = promptCache.get(prompt);
    if (cached) {
        console.log('캐시에서 응답 반환');
        return cached;
    }

    // 실제 API 호출
    const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }]
        })
    });

    const data = await response.json();
    const result = data.candidates[0].content.parts[0].text;

    // 캐시에 저장
    promptCache.set(prompt, result);

    return result;
}
```

### 2. Rate Limiting
```javascript
class RateLimiter {
    constructor(maxRequestsPerMinute) {
        this.maxRequests = maxRequestsPerMinute;
        this.requests = [];
    }

    async throttle() {
        const now = Date.now();
        const oneMinuteAgo = now - 60 * 1000;

        // 1분 이내 요청 필터링
        this.requests = this.requests.filter(time => time > oneMinuteAgo);

        if (this.requests.length >= this.maxRequests) {
            const oldestRequest = this.requests[0];
            const waitTime = 60 * 1000 - (now - oldestRequest);

            console.log(`Rate limit 도달. ${Math.ceil(waitTime / 1000)}초 대기...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        this.requests.push(Date.now());
    }
}

const rateLimiter = new RateLimiter(10);  // 분당 10개 요청

async function callGeminiAPI(prompt) {
    await rateLimiter.throttle();

    // ... 실제 API 호출 코드
}
```

### 3. 비용 모니터링
```javascript
class CostMonitor {
    constructor() {
        this.totalTokens = 0;
        this.COST_PER_1K_TOKENS = 0.00015;  // Gemini Flash 가격
    }

    trackUsage(inputTokens, outputTokens) {
        this.totalTokens += (inputTokens + outputTokens);

        const estimatedCost = (this.totalTokens / 1000) * this.COST_PER_1K_TOKENS;

        console.log(`총 토큰: ${this.totalTokens.toLocaleString()}`);
        console.log(`예상 비용: $${estimatedCost.toFixed(4)}`);

        // DB에 저장
        query(
            'INSERT INTO api_usage (tokens, estimated_cost, timestamp) VALUES ($1, $2, NOW())',
            [inputTokens + outputTokens, estimatedCost]
        );
    }
}

const costMonitor = new CostMonitor();

async function callGeminiAPI(prompt) {
    // ... API 호출

    // 토큰 사용량 추적
    const inputTokens = estimateTokens(prompt);
    const outputTokens = estimateTokens(result);

    costMonitor.trackUsage(inputTokens, outputTokens);

    return result;
}

function estimateTokens(text) {
    // 간단한 추정: 4글자 ≈ 1토큰
    return Math.ceil(text.length / 4);
}
```

---

## 🔐 AI 안전 장치

### 1. 부적절한 콘텐츠 필터링
```javascript
async function moderateContent(message) {
    const prompt = `
    다음 메시지가 토론에 적절한지 판단하세요:

    "${message}"

    평가 기준:
    - 욕설, 비하, 혐오 표현
    - 폭력적 내용
    - 개인정보 노출
    - 스팸성 내용

    JSON 형식으로 반환:
    {
        "appropriate": true/false,
        "reason": "부적절한 경우 이유",
        "suggestion": "수정 제안"
    }
    `;

    const result = await callGeminiAPI(prompt);
    return JSON.parse(result);
}

// 메시지 전송 전 검증
socket.on('chat-message', async (data) => {
    const moderation = await moderateContent(data.message);

    if (!moderation.appropriate) {
        socket.emit('message-rejected', {
            reason: moderation.reason,
            suggestion: moderation.suggestion
        });
        return;
    }

    // 메시지 전송
    io.to(`discussion-${data.discussionId}`).emit('chat-message', data);
});
```

### 2. AI 과도한 개입 방지
```javascript
class AIInterventionManager {
    constructor() {
        this.interventionLog = new Map();  // discussionId -> timestamps[]
        this.MAX_INTERVENTIONS_PER_HOUR = 5;
    }

    canIntervene(discussionId) {
        const now = Date.now();
        const oneHourAgo = now - 60 * 60 * 1000;

        if (!this.interventionLog.has(discussionId)) {
            this.interventionLog.set(discussionId, []);
        }

        const interventions = this.interventionLog.get(discussionId);

        // 1시간 이내 개입 필터링
        const recentInterventions = interventions.filter(time => time > oneHourAgo);
        this.interventionLog.set(discussionId, recentInterventions);

        if (recentInterventions.length >= this.MAX_INTERVENTIONS_PER_HOUR) {
            console.log(`토론 ${discussionId}: AI 개입 한도 도달 (시간당 ${this.MAX_INTERVENTIONS_PER_HOUR}회)`);
            return false;
        }

        return true;
    }

    recordIntervention(discussionId) {
        const interventions = this.interventionLog.get(discussionId) || [];
        interventions.push(Date.now());
        this.interventionLog.set(discussionId, interventions);
    }
}

const interventionManager = new AIInterventionManager();

async function aiIntervene(discussionId) {
    if (!interventionManager.canIntervene(discussionId)) {
        console.log('AI 개입 생략: 한도 초과');
        return;
    }

    // AI 메시지 생성 및 전송
    await generateAndSendAIMessage(discussionId);

    // 개입 기록
    interventionManager.recordIntervention(discussionId);
}
```

---

## 📈 성능 최적화

### 1. 병렬 처리
```javascript
async function generateComprehensiveAnalysis(discussionId) {
    // 여러 분석을 동시에 실행
    const [
        summary,
        participation,
        quality,
        timeline,
        keywords
    ] = await Promise.all([
        generateSummary(discussionId),
        analyzeParticipation(discussionId),
        evaluateDiscussionQuality(discussionId),
        generateTimeline(discussionId),
        extractKeywords(discussionId)
    ]);

    return {
        summary,
        participation,
        quality,
        timeline,
        keywords,
        generatedAt: new Date()
    };
}
```

### 2. 점진적 로딩 (Lazy Loading)
```javascript
// 초기 로드: 요약만
async function loadInitialAnalysis(discussionId) {
    const summary = await generateSummary(discussionId);

    io.to(`discussion-${discussionId}`).emit('analysis-ready', {
        type: 'summary',
        data: summary
    });
}

// 사용자가 "AI 분석" 탭 클릭 시 추가 분석 로드
socket.on('request-full-analysis', async (discussionId) => {
    const [participation, quality] = await Promise.all([
        analyzeParticipation(discussionId),
        evaluateDiscussionQuality(discussionId)
    ]);

    socket.emit('analysis-ready', {
        type: 'detailed',
        data: { participation, quality }
    });
});
```

---

**작성일**: 2025-10-27
**버전**: 1.0
**Gemini API**: v1/gemini-2.0-flash
