const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 定义集合名称
const STOCK_COLLECTION = 'cocktail_stock';
const LIKE_COLLECTION = 'stock_like';

/**
 * 点赞/取消点赞配方
 * * @param {string} stockId - cocktail_stock 文档的 _id
 * @param {string} userId - 用户标识 (从前端获取的 userId)
 * @param {boolean} isLiking - 目标状态: true 为点赞 (加 1), false 为取消点赞 (减 1)
 */
exports.main = async (event, context) => {
  const { stockId, userId, isLiking } = event;

  if (!stockId || !userId || typeof isLiking !== 'boolean') {
    return {
      success: false,
      errMsg: '参数不完整或格式错误'
    };
  }

  // 1. 定义查询条件
  const query = {
    userId: userId,
    stockId: stockId
  };

  // 2. 尝试在 stock_like 集合中查找现有记录
  try {
    const existingLike = await db.collection(LIKE_COLLECTION).where(query).get();
    const isCurrentlyLiked = existingLike.data.length > 0;
    
    let dbOperation, likeCountUpdate;

    if (isLiking && !isCurrentlyLiked) {
      // 目标：点赞 (加 1)
      dbOperation = db.collection(LIKE_COLLECTION).add({
        data: {
          ...query,
          createdAt: db.serverDate(),
        }
      });
      likeCountUpdate = _.inc(1);
    } 
    else if (!isLiking && isCurrentlyLiked) {
      // 目标：取消点赞 (减 1)
      dbOperation = db.collection(LIKE_COLLECTION).where(query).remove();
      likeCountUpdate = _.inc(-1);
    } 
    else {
      // 状态已匹配，无需操作 (例如：已点赞且目标是点赞)
      return {
        success: true,
        action: 'noop',
        errMsg: '状态未改变'
      };
    }

    // 3. 执行事务性操作：更新计数和关联表
    await dbOperation;
    
    // 4. 原子性更新 cocktail_stock 中的 likeCount
    await db.collection(STOCK_COLLECTION).doc(stockId).update({
      data: {
        likeCount: likeCountUpdate,
      }
    });

    return {
      success: true,
      action: isLiking ? 'like' : 'unlike',
      errMsg: '操作成功'
    };

  } catch (e) {
    console.error('点赞/取消点赞操作失败:', e);
    return {
      success: false,
      errMsg: '数据库操作失败：' + e.message
    };
  }
};