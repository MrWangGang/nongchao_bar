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

  // 1. 参数校验：检查调用者是否传入了 type 参数
  if (!comboType) {
    return {
      code: 400, // Bad Request: 请求参数错误
      errMsg: '查询类型 type 不能为空',
      data: []
    }
  }

  try {
    // 2. 执行数据库查询
    // 【请注意】这里我假设你的集合名为 'packages'，如果不是，请修改成你的集合名
    const res = await db.collection('combos')
      .where({
        // 查询条件：文档中 'type' 字段的值等于传入的 comboType
        type: comboType
      })
      .get()

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