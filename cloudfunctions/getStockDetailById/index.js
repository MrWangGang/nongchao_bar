// 云函数入口文件
const cloud = require('wx-server-sdk');

// 初始化 cloud
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// 数据库引用
const db = cloud.database();
// 假设您的配方数据存储在 'stockOrders' 集合中
const stockCollection = db.collection('cocktail_stock');

/**
 * 辅助函数：格式化商品选项描述 (与前端保持一致)
 */
function formatOptions(item) {
  if (item.selectedSpecs && Array.isArray(item.selectedSpecs)) {
    var optionsText = item.selectedSpecs.map(function(spec) {
      return spec.value;
    });
    return optionsText.filter(Boolean).join('，');
  }
  return '';
}

/**
 * 辅助函数：格式化时间，只保留日期部分 (YYYY-MM-DD)
 */
function formatCreatedDate(createdAt) {
  if (!createdAt) return '';
  try {
    // 兼容可能传入的数字类型时间戳
    const date = new Date(createdAt); 
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    console.error("日期格式化错误:", e);
    return '';
  }
}

// 云函数主函数
exports.main = async (event, context) => {
  const { stockId } = event; // 只接收配方ID
  
  if (!stockId) {
    return {
      success: false,
      errMsg: '缺少配方ID'
    };
  }

  try {
    // 1. 根据 _id 精确获取配方详情
    const stockRes = await stockCollection.doc(stockId).get();
    const item = stockRes.data;

    if (!item) {
      return {
        success: false,
        errMsg: '未找到对应配方'
      };
    }
    
    // 2. 格式化数据以匹配前端期望的结构
    
    // 主名称修正
    const displayName = item.recipeName || '未命名配方';
    
    // 标签修正：标签取前 5 个商品的 sampleName
    const tags = item.products ? item.products.slice(0, 5)
                               .map(p => p.sampleName || p.name)
                               .filter(Boolean) : [];
                               
    // 格式化创建日期
    const createdDate = formatCreatedDate(item.createdAt);
    
    // 3. 构建最终返回的数据格式
    const formattedDetail = {
      // **ID 匹配**
      id: item._id, // 将数据库的 _id 映射为前端的 id
      
      name: displayName, 
      price: (item.totalPrice || 0).toFixed(2), 
      likes: item.likeCount || 0, // 仍然保留点赞数量
      isFollowed: false, // **硬编码为 false，不进行查询**
      totalAmount:item.totalAmount,
      image: item.imageFileIds && item.imageFileIds.length > 0 ? item.imageFileIds[0] : '/images/default.png', 
      tags: tags, 
      createdDate: createdDate, 
      
      // --- 详情页需要的额外字段 ---
      products: item.products ? item.products.map(p => ({
          ...p,
          formattedSpec: formatOptions(p) 
      })) : [],
      remark: item.remark || '暂无制作流程说明',
    };

    return {
      success: true,
      data: formattedDetail,
    };

  } catch (error) {
    // 捕捉文档不存在等错误
    if (error.errCode === 'DOCUMENT_NOT_EXIST') {
        return {
             success: false,
             errMsg: '未找到对应配方'
        };
    }
    console.error('获取配方详情失败', error);
    return {
      success: false,
      errMsg: '服务器错误：获取详情失败',
      error: error
    };
  }
};