const fs = require('fs');
const path = require('path');

// 读取 zh-CN.ts 文件
const zhCNPath = path.join(__dirname, '../src/i18n/locales/zh-CN.ts');
const zhCNContent = fs.readFileSync(zhCNPath, 'utf-8');

// 使用更精确的方法解析 TypeScript 对象
function parseObject(content) {
  const result = [];
  
  // 移除注释和 export 语句
  let cleanContent = content
    .replace(/\/\/.*$/gm, '') // 移除行注释
    .replace(/export\s+const\s+\w+\s*=\s*/, ''); // 移除 export const zhCN = 
  
  // 使用递归函数解析对象
  function parseValue(str, path = []) {
    const items = [];
    let i = 0;
    let currentKey = '';
    let currentValue = '';
    let inString = false;
    let stringChar = '';
    let braceDepth = 0;
    let bracketDepth = 0;
    
    while (i < str.length) {
      const char = str[i];
      
      if (!inString) {
        if (char === '{') {
          braceDepth++;
          if (braceDepth === 1) {
            // 新对象开始，跳过
            i++;
            continue;
          }
        } else if (char === '}') {
          braceDepth--;
          if (braceDepth === 0) {
            // 对象结束
            if (currentKey && currentValue) {
              items.push({
                key: path.length > 0 ? `${path.join('.')}.${currentKey}` : currentKey,
                value: currentValue
              });
            }
            break;
          }
        } else if (char === ':') {
          // 键值分隔符
          i++;
          // 跳过空白
          while (i < str.length && /\s/.test(str[i])) i++;
          
          // 检查是字符串还是对象
          if (str[i] === '{') {
            // 嵌套对象
            let objEnd = i;
            let depth = 1;
            while (objEnd < str.length && depth > 0) {
              objEnd++;
              if (str[objEnd] === '{') depth++;
              if (str[objEnd] === '}') depth--;
            }
            const nestedObj = str.substring(i, objEnd + 1);
            const nestedPath = [...path, currentKey];
            items.push(...parseValue(nestedObj, nestedPath));
            i = objEnd + 1;
            currentKey = '';
            currentValue = '';
            continue;
          } else if (str[i] === "'" || str[i] === '"') {
            // 字符串值
            stringChar = str[i];
            inString = true;
            i++;
            currentValue = '';
            while (i < str.length) {
              if (str[i] === '\\' && i + 1 < str.length) {
                currentValue += str[i + 1];
                i += 2;
              } else if (str[i] === stringChar) {
                inString = false;
                i++;
                break;
              } else {
                currentValue += str[i];
                i++;
              }
            }
            items.push({
              key: path.length > 0 ? `${path.join('.')}.${currentKey}` : currentKey,
              value: currentValue
            });
            currentKey = '';
            currentValue = '';
            // 跳过逗号和空白
            while (i < str.length && (str[i] === ',' || /\s/.test(str[i]))) i++;
            continue;
          }
        } else if (/[a-zA-Z_$]/.test(char)) {
          // 键名开始
          let keyEnd = i;
          while (keyEnd < str.length && /[a-zA-Z0-9_$]/.test(str[keyEnd])) {
            keyEnd++;
          }
          currentKey = str.substring(i, keyEnd);
          i = keyEnd;
          continue;
        }
      } else {
        // 在字符串中
        if (char === '\\' && i + 1 < str.length) {
          currentValue += str[i + 1];
          i += 2;
        } else if (char === stringChar) {
          inString = false;
        } else {
          currentValue += char;
        }
      }
      
      i++;
    }
    
    return items;
  }
  
  // 提取对象内容（去掉最外层的大括号）
  const objMatch = cleanContent.match(/\{([\s\S]*)\}/);
  if (objMatch) {
    return parseValue(objMatch[1]);
  }
  
  return [];
}

// 更简单的方法：使用正则表达式直接匹配
function extractWithRegex(content) {
  const result = [];
  const lines = content.split('\n');
  
  // 构建路径栈
  const pathStack = [];
  let currentIndent = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // 跳过注释、空行、export
    if (trimmed.startsWith('//') || trimmed === '' || trimmed.startsWith('export')) {
      continue;
    }
    
    // 计算缩进（用于判断层级）
    const indent = line.match(/^(\s*)/)[1].length;
    
    // 检测对象开始 { 或 key: {
    const objStartMatch = trimmed.match(/^(\w+):\s*\{/);
    if (objStartMatch) {
      const key = objStartMatch[1];
      pathStack.push(key);
      continue;
    }
    
    // 检测对象结束 }
    if (trimmed === '},' || trimmed === '}') {
      if (pathStack.length > 0) {
        pathStack.pop();
      }
      continue;
    }
    
    // 检测键值对 key: 'value'
    const kvMatch = trimmed.match(/^(\w+):\s*['"](.*?)['"],?\s*$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const value = kvMatch[2];
      const fullKey = pathStack.length > 0 
        ? `${pathStack.join('.')}.${key}` 
        : key;
      
      result.push({ key: fullKey, value: value });
    }
  }
  
  return result;
}

// 执行提取
const items = extractWithRegex(zhCNContent);

// 添加 PaymentSuccessModal 中缺失的文案
const additionalItems = [
  { key: 'paymentSuccess.title', value: '感谢您的购买' },
  { key: 'paymentSuccess.loading', value: '加载中...' },
  { key: 'paymentSuccess.total', value: '全部:' },
  { key: 'paymentSuccess.purchaseContent', value: '购买内容:' },
  { key: 'paymentSuccess.paymentMethod', value: '付款方式:' },
  { key: 'paymentSuccess.price', value: '价格:' },
  { key: 'paymentSuccess.quantity', value: '购买数量:' },
  { key: 'paymentSuccess.serverAndCharacter', value: '区组/角色:' },
  { key: 'paymentSuccess.orderId', value: '订单号:' },
  { key: 'paymentSuccess.orderDate', value: '订单日期:' },
  { key: 'paymentSuccess.account', value: '账号:' },
  { key: 'paymentSuccess.confirm', value: '确定' },
  { key: 'paymentSuccess.unionPay', value: '银联' },
  { key: 'paymentSuccess.paypal', value: 'PayPal' },
  { key: 'paymentSuccess.getPaymentInfoFailed', value: '获取支付信息失败' },
];

// 合并并去重
const allItems = [...items, ...additionalItems];
const uniqueItems = [];
const seenKeys = new Set();

for (const item of allItems) {
  if (!seenKeys.has(item.key)) {
    seenKeys.add(item.key);
    uniqueItems.push(item);
  }
}

// 按 key 排序
uniqueItems.sort((a, b) => a.key.localeCompare(b.key));

// 生成 CSV
const csvLines = ['key,中文'];
csvLines.push(...uniqueItems.map(item => {
  // 转义 CSV 中的逗号和引号
  const escapedValue = item.value.replace(/"/g, '""');
  return `${item.key},"${escapedValue}"`;
}));

const csvContent = csvLines.join('\n');

// 写入文件
const outputPath = path.join(__dirname, '../i18n-translations.csv');
fs.writeFileSync(outputPath, csvContent, 'utf-8');

console.log(`✅ 已生成 CSV 文件: ${outputPath}`);
console.log(`📊 共提取 ${uniqueItems.length} 条文案`);
console.log('\n前 20 条示例:');
uniqueItems.slice(0, 20).forEach(item => {
  console.log(`  ${item.key} => ${item.value}`);
});
