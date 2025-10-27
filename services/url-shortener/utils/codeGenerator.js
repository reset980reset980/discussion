/**
 * URL 단축 코드 생성 유틸리티
 * 다양한 전략을 사용하여 고유한 단축 코드 생성
 */

class CodeGenerator {
    /**
     * @param {Object} options
     * @param {number} options.length - 코드 길이 (기본: 6)
     * @param {string} options.charset - 사용할 문자셋 (기본: alphanumeric)
     * @param {string} options.strategy - 생성 전략 (random|sequential|custom)
     */
    constructor(options = {}) {
        this.length = options.length || 6;
        this.strategy = options.strategy || 'random';

        // 문자셋 정의
        this.charsets = {
            alphanumeric: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
            lowercase: 'abcdefghijklmnopqrstuvwxyz0123456789',
            uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
            numbers: '0123456789',
            safe: 'abcdefghjkmnpqrstuvwxyz23456789', // 혼동 가능한 문자 제외 (i,l,o,0,1)
            custom: options.charset || ''
        };

        this.charset = this.charsets[options.charset] || this.charsets.alphanumeric;
        this.sequentialCounter = 0;
    }

    /**
     * 단축 코드 생성
     * @returns {string}
     */
    generate() {
        switch (this.strategy) {
            case 'sequential':
                return this.generateSequential();
            case 'timestamp':
                return this.generateTimestamp();
            case 'custom':
                return this.generateCustom();
            default:
                return this.generateRandom();
        }
    }

    /**
     * 랜덤 코드 생성
     * @returns {string}
     */
    generateRandom() {
        let code = '';
        for (let i = 0; i < this.length; i++) {
            const randomIndex = Math.floor(Math.random() * this.charset.length);
            code += this.charset[randomIndex];
        }
        return code;
    }

    /**
     * 순차적 코드 생성 (Base62 인코딩)
     * @returns {string}
     */
    generateSequential() {
        const num = this.sequentialCounter++;
        return this.base62Encode(num);
    }

    /**
     * 타임스탬프 기반 코드 생성
     * @returns {string}
     */
    generateTimestamp() {
        const timestamp = Date.now();
        const encoded = this.base62Encode(timestamp);

        // 길이 제한 적용
        if (encoded.length > this.length) {
            return encoded.slice(-this.length);
        }

        // 부족한 길이는 랜덤 문자로 채움
        const padding = this.length - encoded.length;
        let paddedCode = encoded;
        for (let i = 0; i < padding; i++) {
            const randomIndex = Math.floor(Math.random() * this.charset.length);
            paddedCode += this.charset[randomIndex];
        }

        return paddedCode;
    }

    /**
     * 커스텀 코드 생성 (확장 가능)
     * @returns {string}
     */
    generateCustom() {
        // 기본적으로 랜덤 생성, 서브클래스에서 오버라이드 가능
        return this.generateRandom();
    }

    /**
     * Base62 인코딩
     * @param {number} num
     * @returns {string}
     */
    base62Encode(num) {
        if (num === 0) return this.charset[0];

        let encoded = '';
        const base = this.charset.length;

        while (num > 0) {
            encoded = this.charset[num % base] + encoded;
            num = Math.floor(num / base);
        }

        return encoded;
    }

    /**
     * Base62 디코딩
     * @param {string} str
     * @returns {number}
     */
    base62Decode(str) {
        const base = this.charset.length;
        let num = 0;

        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            const charIndex = this.charset.indexOf(char);

            if (charIndex === -1) {
                throw new Error(`Invalid character '${char}' in code`);
            }

            num = num * base + charIndex;
        }

        return num;
    }

    /**
     * 코드 유효성 검증
     * @param {string} code
     * @returns {boolean}
     */
    isValid(code) {
        if (typeof code !== 'string') return false;
        if (code.length !== this.length) return false;

        for (let char of code) {
            if (!this.charset.includes(char)) {
                return false;
            }
        }

        return true;
    }

    /**
     * 코드 정규화 (대소문자 통일 등)
     * @param {string} code
     * @returns {string}
     */
    normalize(code) {
        // 기본적으로 원본 반환
        // 필요시 소문자 변환 등 적용 가능
        return code;
    }
}

module.exports = CodeGenerator;
