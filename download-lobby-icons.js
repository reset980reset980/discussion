const https = require('https');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, 'public', 'images', 'icons');

const icons = [
    {
        url: 'https://icons.veryicon.com/png/128/miscellaneous/simple-icon-3/edit-write-3.png',
        filename: 'edit-button.png'
    },
    {
        url: 'https://icons.veryicon.com/png/128/miscellaneous/simple-icon-3/bin-40.png',
        filename: 'delete-button.png'
    },
    {
        url: 'https://icons.veryicon.com/png/128/miscellaneous/general-monochrome/secret-chat-1.png',
        filename: 'lock-icon.png'
    }
];

function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        console.log(`다운로드 중: ${url}`);

        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed: ${url} (Status: ${response.statusCode})`));
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
                fs.unlink(filepath, () => {});
                reject(err);
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

async function downloadAll() {
    console.log('로비 버튼 아이콘 다운로드 시작...\n');

    for (const icon of icons) {
        const filepath = path.join(OUTPUT_DIR, icon.filename);
        try {
            await downloadImage(icon.url, filepath);
        } catch (error) {
            console.error(`✗ 실패: ${icon.filename} - ${error.message}`);
        }
    }

    console.log('\n다운로드 완료!');
}

downloadAll().catch(error => {
    console.error('다운로드 오류:', error);
    process.exit(1);
});
