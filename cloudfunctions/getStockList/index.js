const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const $ = db.command.aggregate;

const COLLECTION_NAME = 'cocktail_stock';
const LIKE_COLLECTION = 'stock_like';     
const DEFAULT_PAGE_SIZE = 10;

/**
 * 查询所有配方列表 (支持分页、排序，并合并用户点赞状态)
 */
exports.main = async (event, context) => {
  const { 
    page = 1, 
    pageSize = DEFAULT_PAGE_SIZE,
    orderBy = 'totalAmount', 
    order = 'asc',
    currentUserId // 接收当前用户ID
  } = event;

  // 确保分页参数有效
  const pageNum = Math.max(1, parseInt(page));
  const size = Math.max(1, parseInt(pageSize));
  const skipCount = (pageNum - 1) * size;
  
  const sortDirection = (order || 'desc').toLowerCase(); 

  // --- 动态确定排序规则 ---
  let sortField;
  switch (orderBy) {
    case 'likeCount': sortField = 'likeCount'; break;
    case 'createdAt': sortField = 'createdAt'; break;
    case 'totalAmount':
    default: sortField = 'totalAmount'; break;
  }
  // --- 动态确定排序规则结束 ---

  try {
    // 1. 查询总数
    const countResult = await db.collection(COLLECTION_NAME).count();
    const total = countResult.total;
    const totalPages = Math.ceil(total / size);

    // 2. 构造聚合查询管道
    let pipeline = db.collection(COLLECTION_NAME).aggregate()
      
      // 排序
      .sort({
        [sortField]: sortDirection === 'asc' ? 1 : -1
      })
      
      // 分页
      .skip(skipCount)
      .limit(size);

    // 3. 关联查询 (Lookup) - 检查当前用户是否点赞
    if (currentUserId) {
        pipeline = pipeline.lookup({
            from: LIKE_COLLECTION,
            // 【核心修复】：移除 localField 和 foreignField
            as: 'userLikeRecord',
            
            // 使用 let 定义 stockId 局部变量
            let: { stockId: '$_id' }, 
            pipeline: $.pipeline()
                .match({
                    $expr: $.and([
                        // 关联条件：stockId 匹配
                        $.eq(['$stockId', '$$stockId']),
                        // 过滤条件：userId 匹配
                        $.eq(['$userId', currentUserId])
                    ])
                })
                .project({
                    _id: 1 
                })
                .done()
        });

        // 4. 添加 isFollowed 字段 (根据关联结果判断)
        pipeline = pipeline.addFields({
            isFollowed: $.cond([
                $.gt([$.size('$userLikeRecord'), 0]), // 如果 userLikeRecord 数组长度 > 0
                true,
                false
            ])
        });
    } else {
        // 如果没有 userId，默认 isFollowed 为 false
        pipeline = pipeline.addFields({
            isFollowed: false
        });
    }
    
    // 5. 移除临时的 userLikeRecord 字段 (可选，但推荐清理)
    pipeline = pipeline.project({
        userLikeRecord: 0 // 不将完整的关联数组返回给前端
    });

    const listResult = await pipeline.end();

    return {
      success: true,
      data: listResult.list, 
      page: pageNum,
      pageSize: size,
      total: total,
      totalPages: totalPages,
      orderBy: sortField,
      order: sortDirection,
      errMsg: '查询成功'
    };

  } catch (e) {
    console.error('查询所有配方列表失败：', e);
    return {
      success: false,
      errMsg: '数据库查询失败：' + e.message,
      data: []
    };
  }
};