const https = require('https');
const fs = require('fs');
const path = require('path');

// 다운로드 설정
const BASE_URL = 'https://icons.veryicon.com/png/256/avatar/default-avatar/';
const OUTPUT_DIR = path.join(__dirname, 'public', 'images', 'avatars');
const TEMP_DIR = path.join(__dirname, 'temp_avatars');

// 임시 디렉토리 생성
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// 50개 아바타 파일명 생성
function generateAvatarList() {
    const avatars = [];
    for (let i = 1; i <= 50; i++) {
        const num = String(i).padStart(3, '0');
        // boy와 girl 패턴 교대로
        const type = i % 2 === 1 ? 'boy' : 'girl';
        avatars.push(`${num}-${type}.png`);
    }
    return avatars;
}

// 이미지 다운로드 함수
function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        console.log(`다운로드 중: ${url}`);

        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${url} (Status: ${response.statusCode})`));
                return;
            }

            const fileStream = fs.createWriteStream(filepath);
            response.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close();
                console.log(`✓ 완료: ${path.basename(filepath)}`);
                resolve();
            });

            fileStream.on('error', (err) => {
                fs.unlink(filepath, () => {}); // 실패 시 파일 삭제
                reject(err);
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

// 순차적으로 다운로드 (동시 요청 제한)
async function downloadAll() {
    const avatars = generateAvatarList();
    console.log(`총 ${avatars.length}개의 아바타 다운로드 시작...\n`);

    let successCount = 0;
    let failCount = 0;

    for (const avatar of avatars) {
        const url = BASE_URL + avatar;
        const filepath = path.join(TEMP_DIR, avatar);

        try {
            await downloadImage(url, filepath);
            successCount++;
            // 서버 부하 방지를 위한 딜레이
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
            console.error(`✗ 실패: ${avatar} - ${error.message}`);
            failCount++;
        }
    }

    console.log(`\n다운로드 완료!`);
    console.log(`성공: ${successCount}개`);
    console.log(`실패: ${failCount}개`);
    console.log(`저장 위치: ${TEMP_DIR}`);

    return { successCount, failCount };
}

// 실행
downloadAll().catch(error => {
    console.error('다운로드 중 오류 발생:', error);
    process.exit(1);
});
