// cloudfunctions/getStorageList/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 获取存酒列表云函数 (支持分页)
 * @param {string} event.userId - 用户ID
 * @param {string} event.status - 过滤状态
 * @param {number} event.pageIndex - 当前页码 (从 0 或 1 开始，取决于你的习惯，这里用 0)
 * @param {number} event.pageSize - 每页数据量
 * @returns {Object} 存酒列表数据, 包括总数
 */
exports.main = async (event, context) => {
  const {
    userId,
    status,
    pageIndex = 0, // 默认为第 0 页
    pageSize = 10, // 默认每页 10 条
  } = event;

  // 计算跳过的记录数
  const skipCount = pageIndex * pageSize;

  try {
    const condition = {
      userId: userId,
      status: status
    };

    // 1. 获取总数 (用于判断是否还有更多数据)
    const countResult = await db.collection('storages').where(condition).count();
    const total = countResult.total;

    // 2. 分页查询数据
    const listResult = await db.collection('storages')
      .where(condition)
      .skip(skipCount) // 跳过指定数量
      .limit(pageSize) // 限制返回数量
      .orderBy('depositTime', 'desc') // 按存酒时间倒序
      .get();

    return {
      success: true,
      list: listResult.data,
      total: total,
      pageIndex: pageIndex,
      pageSize: pageSize
    };

  } catch (err) {
    console.error('getStorageList failed:', err);
    return {
      success: false,
      errMsg: err.message
    };
  }
};