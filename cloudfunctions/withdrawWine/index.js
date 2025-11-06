// cloudfunctions/withdrawWine/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 取酒操作云函数
 * @param {string} event._id - 数据库记录的 _id
 * @returns {Object} 数据库操作结果
 */
exports.main = async (event, context) => {
  const {
    _id
  } = event;

  try {
    const res = await db.collection('storages').doc(_id).update({
      data: {
        status: '已取出',
        withdrawTime: new Date(), // 设置取酒时间
      }
    });

    return {
      success: true,
      data: res
    };
  } catch (err) {
    console.error('withdrawWine failed:', err);
    return {
      success: false,
      errMsg: err.message
    };
  }
};