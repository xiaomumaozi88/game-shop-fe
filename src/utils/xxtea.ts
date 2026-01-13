// 基于第三方 XXTEA JS 库的解密封装（建议安装依赖：npm install xxtea）
// 等价于服务端：xxtea.Decrypt(hex.DecodeString(hexStr), []byte(secretKey))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const xxtea: any = require('xxtea');

const hexToBytes = (hex: string): Uint8Array => {
  const clean = hex.trim();
  if (clean.length % 2 !== 0) throw new Error('invalid hex length');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    const byte = parseInt(clean.substr(i, 2), 16);
    if (Number.isNaN(byte)) throw new Error('invalid hex char');
    bytes[i / 2] = byte;
  }
  return bytes;
};

export const xxteaDecryptHexToString = (hex: string, key: string): string => {
  const encrypted = hexToBytes(hex);
  
  // 部分实现提供 decryptToString，部分只提供 decrypt
  if (typeof xxtea.decryptToString === 'function') {
    const res = xxtea.decryptToString(encrypted, key);
    if (res == null) {
      throw new Error('xxtea decrypt failed');
    }
    return res;
  }

  const decrypted = xxtea.decrypt(encrypted, key);
  if (!decrypted) {
    throw new Error('xxtea decrypt failed');
  }

  // decrypt 可能返回 string 或 Uint8Array
  if (typeof decrypted === 'string') {
    return decrypted;
  }

  return new TextDecoder().decode(decrypted as Uint8Array);
};

