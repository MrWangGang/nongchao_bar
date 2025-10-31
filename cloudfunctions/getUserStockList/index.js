const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const $ = db.command.aggregate; // 引入聚合操作符

const COLLECTION_NAME = 'cocktail_stock'; // 主集合
const LIKE_COLLECTION = 'stock_like';     // 关联表
const DEFAULT_PAGE_SIZE = 10;

/**
 * 根据 userId 查询特定用户的配方列表 (支持分页、排序，并合并用户点赞状态)
 * @param {string} userId - 用户标识 (即配方创建者，同时也是检查点赞状态的用户)
 * @param {number} page - 页码 (从 1 开始)
 * @param {number} pageSize - 每页数量
 * @param {string} orderBy - 排序字段 ('likeCount', 'createdAt', 'totalAmount')
 * @param {string} order - 排序方向 ('asc' 升序, 'desc' 降序)
 */
exports.main = async (event, context) => {
  const { 
    userId, // 待查询的用户 ID
    page = 1, 
    pageSize = DEFAULT_PAGE_SIZE,
    orderBy = 'totalAmount', 
    order = 'asc' 
  } = event;
  
  if (!userId) {
    return {
      success: false,
      errMsg: '缺少 userId 参数'
    };
  }

  const pageNum = Math.max(1, parseInt(page));
  const size = Math.max(1, parseInt(pageSize));
  const skipCount = (pageNum - 1) * size;
  
  // 查询条件：只筛选该用户创建的配方
  const filter = {
    userId: userId
  };
  
  // 转换排序方向
  const sortDirection = (order || 'desc').toLowerCase(); 

  // --- 动态确定排序字段 ---
  let sortField;
  switch (orderBy) {
    case 'likeCount': sortField = 'likeCount'; break;
    case 'createdAt': sortField = 'createdAt'; break;
    case 'totalAmount':
    default: sortField = 'totalAmount'; break;
  }
  // --- 动态确定排序规则结束 ---

  try {
    // 1. 查询总数 (必须使用 .where(filter) 来过滤)
    const countResult = await db.collection(COLLECTION_NAME).where(filter).count();
    const total = countResult.total;
    const totalPages = Math.ceil(total / size);

    // 2. 构造聚合查询管道
    let pipeline = db.collection(COLLECTION_NAME).aggregate()
      
      // A. 匹配 (Filter) - 只看当前用户的配方
      .match(filter) 
      
      // B. 排序
      .sort({
        [sortField]: sortDirection === 'asc' ? 1 : -1
      })
      
      // C. 分页
      .skip(skipCount)
      .limit(size);

    // D. 关联查询 (Lookup) - 检查该用户是否点赞了这条配方
    pipeline = pipeline.lookup({
        from: LIKE_COLLECTION,
        as: 'userLikeRecord', // 关联结果的数组名
        
        // 【核心修复】：移除 localField 和 foreignField，完全依赖 let/pipeline
        let: { stockId: '$_id' }, // 定义局部变量 $$stockId = cocktail_stock._id
        pipeline: $.pipeline()
            // 匹配条件：stockId 必须匹配，且 userId 必须是请求参数中的 userId
            .match({
                $expr: $.and([
                    $.eq(['$stockId', '$$stockId']),
                    $.eq(['$userId', userId]) // 使用事件中传入的 userId
                ])
            })
            .project({
                _id: 1 // 只返回 _id 证明存在即可
            })
            .done()
    });

    // E. 添加 isFollowed 字段
    pipeline = pipeline.addFields({
        isFollowed: $.cond([
            $.gt([$.size('$userLikeRecord'), 0]), // 如果 userLikeRecord 数组长度 > 0
            true,
            false
        ])
    });
    
    // F. 清理返回数据
    pipeline = pipeline.project({
        userLikeRecord: 0 // 不将完整的关联数组返回给前端
    });

    const listResult = await pipeline.end();

    return {
      success: true,
      data: listResult.list, // 聚合查询的结果在 listResult.list 中
      page: pageNum,
      pageSize: size,
      total: total,
      totalPages: totalPages,
      orderBy: sortField, 
      order: sortDirection, 
      errMsg: '查询成功'
    };

  } catch (e) {
    console.error('查询用户配方列表失败：', e);
    return {
      success: false,
      errMsg: '数据库查询失败：' + e.message,
      data: []
    };
  }
};