// cloud/getRankList/index.js (支持分页)
const cloud = require('wx-server-sdk')

// 请将 'YOUR_CLOUD_ENVIRONMENT_ID' 替换为您的云环境 ID
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })


const COLLECTION_NAME = 'users' 
const DEFAULT_PAGE_SIZE = 20 // 默认每页查询 20 条数据

exports.main = async (event, context) => {
  const db = cloud.database()

  // 从 event 中获取分页参数，并设置默认值
  // pageIndex 默认为 1
  const pageIndex = event.pageIndex ? parseInt(event.pageIndex) : 1;
  // pageSize 默认为 20
  const pageSize = event.pageSize ? parseInt(event.pageSize) : DEFAULT_PAGE_SIZE;

  // 计算跳过的记录数 (pageIndex 从 1 开始)
  const skipAmount = (pageIndex - 1) * pageSize;

  try {
    // 1. 查询数据库（带分页）：
    const rankListQuery = db.collection(COLLECTION_NAME)
      .orderBy('vipScore', 'desc')
      .skip(skipAmount) // 跳过已加载的记录
      .limit(pageSize)  // 限制本次返回的数量

    const result = await rankListQuery.get()

    // 2. 结构化返回数据：
    //    排名 rank 需要加上跳过的数量，以确保排名的连续性
    const rankList = result.data.map((item, index) => {
      return {
        // rank = 跳过数量 + 当前页索引 + 1
        rank: skipAmount + index + 1,
        _id: item._id,       
        avatarUrl: item.avatarUrl || '',
        // 确保昵称 fallback 也能显示正确排名
        nickName: item.nickName || `用户${skipAmount + index + 1}`, 
        vipScore: item.vipScore || 0,
      }
    })

    // 3. (可选但推荐) 获取总记录数，用于判断是否还有下一页
    const totalCountResult = await db.collection(COLLECTION_NAME).count();
    const total = totalCountResult.total;

    return {
      success: true,
      data: rankList,
      count: rankList.length,
      total: total, // 返回总记录数
      pageIndex: pageIndex,
      pageSize: pageSize
    }
    
  } catch (e) {
    console.error('[Cloud Function] getRankList Error:', e)
    return {
      success: false,
      errMsg: '获取排行榜数据失败',
      errorDetail: e
    }
  }
}