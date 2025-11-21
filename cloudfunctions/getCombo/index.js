// 云函数入口文件
const cloud = require('wx-server-sdk')

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV // 使用动态环境变量
})

// 获取数据库引用
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  // event 对象包含了小程序端调用时传过来的所有参数
  const comboType = event.type 

  // 🚀 关键修改：检查 comboType 是否存在
  if (!comboType) {
    console.error('参数错误: 缺少必要的 type 字段')
    return {
      code: 400, // Bad Request: 客户端请求参数错误
      errMsg: '参数错误：必须提供套餐类型 (type) 才能进行查询'
    }
  }

  try {
    // 1. 构建查询对象，并应用 where 条件
    const query = db.collection('combos')
      .where({
        type: comboType // 强制要求 type 字段的值等于传入的 comboType
      })

    // 2. 执行数据库查询
    const res = await query.get()

    // 3. 返回成功的结果
    return {
      code: 0, // 成功状态码
      errMsg: '查询成功',
      data: res.data // res.data 是一个包含查询结果文档的数组
    }

  } catch (e) {
    // 4. 处理异常情况
    console.error('数据库查询异常', e)
    return {
      code: 500, // Internal Server Error: 服务器内部错误
      errMsg: '数据库查询失败',
      error: e
    }
  }
}