const https = require('https');
const fs = require('fs');
const path = require('path');

// 다운로드 설정
const BASE_URL = 'https://icons.veryicon.com/png/256/avatar/default-avatar/';
const TEMP_DIR = path.join(__dirname, 'temp_avatars');

// 임시 디렉토리 생성
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// 정확한 50개 아바타 파일명 (실제 사이트에서 확인)
const avatarList = [
    '001-boy', '002-boy', '003-girl', '004-boy', '005-boy', '006-boy', '007-girl', '008-boy',
    '009-girl', '010-boy', '011-girl', '012-boy', '013-boy', '014-girl', '015-boy', '016-girl',
    '017-boy', '018-boy', '019-girl', '020-girl', '021-girl', '022-girl', '023-boy', '024-boy',
    '025-boy', '026-girl', '027-boy', '028-boy', '029-girl', '030-girl', '031-girl', '032-girl',
    '033-boy', '034-boy', '035-girl', '036-girl', '037-girl', '038-boy', '039-girl', '040-boy',
    '041-boy', '042-girl', '043-girl', '044-boy', '045-girl', '046-boy', '047-boy', '048-girl',
    '049-boy', '050-girl'
];

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

// 순차적으로 다운로드
async function downloadAll() {
    console.log(`총 ${avatarList.length}개의 아바타 다운로드 시작...\n`);

    let successCount = 0;
    let failCount = 0;

    for (const avatar of avatarList) {
        const filename = `${avatar}.png`;
        const url = BASE_URL + filename;
        const filepath = path.join(TEMP_DIR, filename);

        // 이미 다운로드된 파일은 스킵
        if (fs.existsSync(filepath)) {
            console.log(`⊙ 스킵: ${filename} (이미 존재)`);
            successCount++;
            continue;
        }

        try {
            await downloadImage(url, filepath);
            successCount++;
            // 서버 부하 방지를 위한 딜레이
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
            console.error(`✗ 실패: ${filename} - ${error.message}`);
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
