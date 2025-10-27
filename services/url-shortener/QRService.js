/**
 * QR 코드 생성 서비스
 */

const QRCode = require('qrcode');

class QRService {
    /**
     * @param {Object} options
     * @param {number} options.size - QR 코드 크기 (기본: 300)
     * @param {number} options.margin - QR 코드 여백 (기본: 4)
     * @param {string} options.errorCorrectionLevel - 오류 정정 레벨 (L, M, Q, H)
     * @param {string} options.color.dark - 어두운 색상 (기본: #000000)
     * @param {string} options.color.light - 밝은 색상 (기본: #FFFFFF)
     */
    constructor(options = {}) {
        this.options = {
            width: options.size || 300,
            margin: options.margin || 4,
            errorCorrectionLevel: options.errorCorrectionLevel || 'M',
            color: {
                dark: options.color?.dark || '#000000',
                light: options.color?.light || '#FFFFFF'
            }
        };
    }

    /**
     * URL을 QR 코드로 변환 (Data URL)
     * @param {string} url
     * @param {Object} customOptions - 개별 옵션 오버라이드
     * @returns {Promise<string>} Base64 Data URL
     */
    async generateDataURL(url, customOptions = {}) {
        try {
            const options = { ...this.options, ...customOptions };
            const dataUrl = await QRCode.toDataURL(url, options);
            return dataUrl;
        } catch (error) {
            console.error('QR Code generation error:', error);
            throw new Error('QR 코드 생성에 실패했습니다.');
        }
    }

    /**
     * URL을 QR 코드로 변환 (Buffer)
     * @param {string} url
     * @param {Object} customOptions
     * @returns {Promise<Buffer>}
     */
    async generateBuffer(url, customOptions = {}) {
        try {
            const options = { ...this.options, ...customOptions };
            const buffer = await QRCode.toBuffer(url, options);
            return buffer;
        } catch (error) {
            console.error('QR Code buffer generation error:', error);
            throw new Error('QR 코드 Buffer 생성에 실패했습니다.');
        }
    }

    /**
     * 배치 생성 (여러 URL을 한번에)
     * @param {Array<string>} urls
     * @returns {Promise<Array<string>>} Data URL 배열
     */
    async generateBatch(urls) {
        const promises = urls.map(url => this.generateDataURL(url));
        return Promise.all(promises);
    }

    /**
     * 로고 삽입 QR 코드 생성 (고급 기능)
     * @param {string} url
     * @param {string} logoPath - 로고 이미지 경로 또는 Data URL
     * @returns {Promise<string>}
     */
    async generateWithLogo(url, logoPath) {
        // 기본 QR 코드 생성
        const qrDataUrl = await this.generateDataURL(url, {
            errorCorrectionLevel: 'H' // 로고 삽입을 위해 높은 오류 정정 레벨 사용
        });

        // 실제 구현은 Canvas를 사용한 이미지 합성 필요
        // 여기서는 기본 QR 코드만 반환 (확장 가능)
        return qrDataUrl;
    }

    /**
     * QR 코드 유효성 검증
     * @param {string} dataUrl - Data URL 형식의 QR 코드
     * @returns {boolean}
     */
    isValidQRCode(dataUrl) {
        if (!dataUrl || typeof dataUrl !== 'string') {
            return false;
        }

        // Data URL 형식 확인
        const dataUrlPattern = /^data:image\/(png|jpeg|jpg|gif);base64,/;
        return dataUrlPattern.test(dataUrl);
    }

    /**
     * QR 코드 크기 계산
     * @param {string} dataUrl
     * @returns {number} 바이트 단위 크기
     */
    getSize(dataUrl) {
        if (!this.isValidQRCode(dataUrl)) {
            return 0;
        }

        // Base64 문자열 길이를 바이트로 변환
        const base64String = dataUrl.split(',')[1];
        const padding = (base64String.match(/=/g) || []).length;
        const sizeInBytes = (base64String.length * 3 / 4) - padding;

        return Math.round(sizeInBytes);
    }

    /**
     * QR 코드 사용자 정의 스타일
     * @param {Object} style
     * @param {string} style.shape - dot, square (기본: square)
     * @param {Object} style.colors - 그라데이션 색상
     * @returns {Object} QR 옵션
     */
    createCustomStyle(style = {}) {
        const customOptions = {
            ...this.options
        };

        if (style.shape === 'dot') {
            customOptions.type = 'image/png';
            customOptions.rendererOpts = {
                quality: 1
            };
        }

        if (style.colors) {
            customOptions.color = {
                dark: style.colors.dark || this.options.color.dark,
                light: style.colors.light || this.options.color.light
            };
        }

        return customOptions;
    }
}

module.exports = QRService;
