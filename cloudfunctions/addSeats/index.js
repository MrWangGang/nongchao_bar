// 引入云开发 SDK
const cloud = require('wx-server-sdk')
cloud.init({
  // env: cloud.DYNAMIC_CURRENT_ENV // 建议使用动态环境
})

// 获取数据库引用
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
    // 检查 event.data 是否存在且是数组
    const mockSeatsData = event.data;

    if (!mockSeatsData || !Array.isArray(mockSeatsData) || mockSeatsData.length === 0) {
        return {
            code: -1,
            message: '请通过 event.data 传入座位数据数组。'
        };
    }

    const results = [];
    
    // 批量插入数据
    for (let item of mockSeatsData) {
        try {
            // 注意：如果数据量大，需要分批次插入 (每次最多500条)
            const res = await db.collection('seats').add({
                data: item
            });
            results.push({ success: true, id: res._id });
        } catch (e) {
            results.push({ success: false, error: e.errMsg });
        }
    }
    
    return {
        code: 0,
        message: `成功插入 ${results.filter(r => r.success).length} 条数据`,
        results: results
    };
}