// 云函数: getMenuData/index.js (或覆盖 getProducts/index.js)

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV 
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const productsCollection = db.collection('cocktails');

  try {
    // --- 获取全部数据的逻辑 ---

    // 1. 先获取记录的总数
    const countResult = await productsCollection.count();
    const total = countResult.total;

    if (total === 0) {
      return { success: true, data: [] };
    }

    // 2. 计算需要分多少次取 (因为每次最多取100条)
    const MAX_LIMIT = 100;
    const batchTimes = Math.ceil(total / MAX_LIMIT);

    // 3. 创建一个数组，存放每一次查询的 Promise
    const tasks = [];
    for (let i = 0; i < batchTimes; i++) {
      const promise = productsCollection
        .skip(i * MAX_LIMIT)
        .limit(MAX_LIMIT)
        .get();
      tasks.push(promise);
    }

    // 4. 等待所有查询任务完成
    const results = await Promise.all(tasks);

    // 5. 将所有批次获取到的 data 数组合并成一个大数组
    const allProducts = results.reduce((acc, cur) => {
      return acc.concat(cur.data);
    }, []);

    // 返回成功结果，数据是一个包含所有商品对象的扁平数组
    return {
      success: true,
      data: allProducts,
      message: '所有商品获取成功'
    };

  } catch (e) {
    console.error('getMenuData function error:', e);
    return {
      success: false,
      message: e.message || '获取商品失败',
    };
  }
}