// cloudfunctions/addStorage/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const MAX_RETRIES = 10; // 避免无限循环，最大重试次数

// 1. 生成6位随机数字字符串
function generateRandomNo() {
  // 生成一个 100000 到 999999 之间的整数，并转为字符串
  return (Math.floor(Math.random() * 900000) + 100000).toString();
}

// 2. 循环查找一个唯一的寄存单号
async function getUniqueNo() {
  for (let i = 0; i < MAX_RETRIES; i++) {
    const randomNo = generateRandomNo();
    
    // 查重：在 'storages' 表中查找是否有相同的 no
    const countResult = await db.collection('storages').where({
      no: randomNo
    }).count();

    if (countResult.total === 0) {
      // 唯一，返回
      return randomNo;
    }
    // 如果重复，继续下一轮循环生成新的 no
  }
  
  // 如果重试 MAX_RETRIES 次后仍未找到，则抛出错误
  throw new Error('无法在有限次数内生成唯一寄存单号');
}

/**
 * 存酒记录新增云函数 (已包含生成唯一 no 的逻辑)
 */
exports.main = async (event, context) => {
  const {
    userId,
    name,
    endDate,
    remark,
    fileId,
    quantity = 1
  } = event.data;

  try {
    // 3. 【核心】生成唯一的寄存单号
    const uniqueNo = await getUniqueNo();

    // 4. 存入数据库
    const res = await db.collection('storages').add({
      data: {
        no: uniqueNo, // <<<<<<< 存入生成的唯一单号
        userId: userId,
        name: name,
        endDate: endDate,
        remark: remark,
        fileId: fileId,
        quantity: quantity,
        depositTime: new Date(),
        withdrawTime: null,
        status: '已确认寄存',
        createdAt: db.serverDate(),
      }
    });

    return {
      success: true,
      data: res,
      no: uniqueNo
    };
  } catch (err) {
    console.error('addStorage failed:', err);
    return {
      success: false,
      errMsg: err.message
    };
  }
};