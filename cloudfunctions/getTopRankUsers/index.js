// 云函数入口文件：getTopRankUsers
const cloud = require('wx-server-sdk')

// 初始化 cloud
// 建议在云函数的 config.json 中配置要使用的环境 ID，这里使用默认环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 获取数据库引用
const db = cloud.database()

/**
 * 云函数：获取用户VIP积分排行榜前三名
 * * @param event 包含调用者传入的参数（这里不需要额外参数）
 * @param context 云函数运行上下文
 * @returns {Array} 包含前三名用户的昵称、头像和 _id 的数组
 */
exports.main = async (event, context) => {
  try {
    const result = await db.collection('users')
      // 1. 排序：按 vipScore 字段降序排列（分数越高越靠前）
      .orderBy('vipScore', 'desc')
      // 2. 限制数量：只取前 3 条记录
      .limit(3)
      // 3. 投影：只返回需要的字段
      .field({
        nickName: true,
        avatarUrl: true,
        vipScore: true, // 积分也返回，方便前端展示
        _id: true
      })
      .get()

    // result.data 即为查询到的前 3 名用户数据
    return {
      code: 0,
      data: result.data,
      msg: '获取排行榜成功'
    }

  } catch (e) {
    console.error('获取排行榜失败：', e)
    return {
      code: -1,
      data: [],
      msg: '获取排行榜失败'
    }
  }
}