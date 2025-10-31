const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, 'temp_avatars');
const TARGET_DIR = path.join(__dirname, 'public', 'images', 'avatars');

// 정확한 50개 아바타 파일명 순서
const avatarList = [
    '001-boy', '002-boy', '003-girl', '004-boy', '005-boy', '006-boy', '007-girl', '008-boy',
    '009-girl', '010-boy', '011-girl', '012-boy', '013-boy', '014-girl', '015-boy', '016-girl',
    '017-boy', '018-boy', '019-girl', '020-girl', '021-girl', '022-girl', '023-boy', '024-boy',
    '025-boy', '026-girl', '027-boy', '028-boy', '029-girl', '030-girl', '031-girl', '032-girl',
    '033-boy', '034-boy', '035-girl', '036-girl', '037-girl', '038-boy', '039-girl', '040-boy',
    '041-boy', '042-girl', '043-girl', '044-boy', '045-girl', '046-boy', '047-boy', '048-girl',
    '049-boy', '050-girl'
];

console.log('아바타 이미지 복사 및 이름 변경 시작...\n');

let successCount = 0;
let failCount = 0;

avatarList.forEach((originalName, index) => {
    const num = index + 1;
    const sourcePath = path.join(SOURCE_DIR, `${originalName}.png`);
    const targetPath = path.join(TARGET_DIR, `avatar${num}.png`);

    try {
        // 파일 복사
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`✓ ${originalName}.png → avatar${num}.png`);
        successCount++;
    } catch (error) {
        console.error(`✗ 실패: ${originalName}.png - ${error.message}`);
        failCount++;
    }
});

console.log(`\n작업 완료!`);
console.log(`성공: ${successCount}개`);
console.log(`실패: ${failCount}개`);
console.log(`저장 위치: ${TARGET_DIR}`);
