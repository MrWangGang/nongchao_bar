const app = getApp()

// 辅助函数：格式化日期（用于下单时间显示）
function formatDate(date, fmt) {
    const o = {
        'M+': date.getMonth() + 1, 'd+': date.getDate(), 'h+': date.getHours(),
        'm+': date.getMinutes(), 's+': date.getSeconds(),
    };
    if (/(y+)/.test(fmt)) {
        fmt = fmt.replace(RegExp.$1, (date.getFullYear() + '').substr(4 - RegExp.$1.length));
    }
    for (let k in o) {
        if (new RegExp('(' + k + ')').test(fmt)) {
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length === 1) ? (o[k]) : (('00' + o[k]).substr(('' + o[k]).length)));
        }
    }
    return fmt;
}

Page({
    timer: null, // 用于存储计时器ID
  
    data: {
        orderId: '',
        orderDetail: null,
        loading: true,
        showAllProducts: false,
        personCount: 2, // 假设就餐人数
        tableNumber: 23, // 假设桌台号码
        countdownDisplay: '', // 倒计时显示文本
        
        // 订单状态映射 (修正为中文状态字符串作为键)
        orderStatusMap: {
            '待支付': { title: '待支付', tip: '超时后订单会自动取消，请你尽快支付', showTimer: true },
            '已支付': { title: '已支付', tip: '感谢您的支持，订单已完成支付', showTimer: false },
            '订单取消': { title: '订单已取消', tip: '订单已取消，有疑问请联系客服', showTimer: false }
        }
    },

    /**
     * 复制订单编号
     */
    copyOrderNo() {
        if (!this.data.orderDetail || !this.data.orderDetail.no) {
            wx.showToast({ title: '订单编号缺失', icon: 'none' });
            return;
        }
        wx.setClipboardData({
            data: this.data.orderDetail.no,
            success: () => {
                wx.showToast({ title: '已复制', icon: 'success' });
            }
        });
    },

    onLoad: function (options) {
        // 这里的全局数据不再用于获取 userId，但保留用于其他功能
        const orderId = options.orderId;
        if (orderId) {
            this.setData({ orderId });
            this.fetchOrderDetail(orderId);
        } else {
            wx.showToast({ title: '缺少订单ID', icon: 'none' });
            this.setData({ loading: false });
        }
    },
    
    onUnload: function () {
        // 页面卸载时清除计时器
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    },
  
    // 核心：处理倒计时逻辑 (保持不变)
    updateTimer: function (cancelTime) {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        const targetTime = new Date(cancelTime).getTime(); // 订单取消时间戳
  
        const tick = () => {
            const now = new Date().getTime();
            const distance = targetTime - now;
  
            if (distance <= 0) {
                clearInterval(this.timer);
                this.timer = null;
                this.setData({
                    countdownDisplay: '00:00',
                });
                return;
            }
  
            // 计算分和秒
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
  
            const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            this.setData({ countdownDisplay: display });
        };
  
        // 立即执行一次，并设置每秒执行
        tick();
        this.timer = setInterval(tick, 1000);
    },
  
    fetchOrderDetail: function (orderId) {
        wx.cloud.callFunction({
            name: 'getMealOrderDetail',
            data: {
                dbId: orderId // 传入 _id
            },
            success: (res) => {
                const result = res.result;
                if (result.success && result.data) {
                    let detail = result.data;
                    detail.orderNo = detail.no; 
                    
                    const seatNumber = detail.seatInfo ? detail.seatInfo.name : '未知';

                    // 格式化下单时间
                    const createTimeDate = new Date(detail.createTime);
                    detail.formattedCreateTime = formatDate(createTimeDate, 'yyyy/MM/dd hh:mm:ss');
  
                    let targetCancelTime = null;
                    // 状态判断改为中文字符串 '待支付'
                    const IS_PENDING_PAYMENT = detail.orderStatus === '待支付'; 
                    const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
  
                    // 仅当订单状态为“待支付”且有创建时间时，计算倒计时
                    if (IS_PENDING_PAYMENT && detail.createTime) {
                        const createTimestamp = createTimeDate.getTime();
                        // 计算 createTime + 15 分钟后的目标时间戳
                        const targetTimestamp = createTimestamp + FIFTEEN_MINUTES_MS;
                        const now = new Date().getTime();
                        
                        if (targetTimestamp > now) {
                            // 倒计时时间在将来，使用它来启动计时器
                            targetCancelTime = new Date(targetTimestamp).toISOString(); 
                        }
                    }
  
                    this.setData({
                        orderDetail: detail,
                        loading: false,
                        tableNumber: seatNumber,
                        // 如果订单已超时，则立即显示 00:00
                        countdownDisplay: (IS_PENDING_PAYMENT && detail.createTime && !targetCancelTime) ? '00:00' : this.data.countdownDisplay
                    }, () => {
                        // 如果计算出了一个有效的未来取消时间，则启动计时器
                        if (targetCancelTime) {
                            this.updateTimer(targetCancelTime);
                        }
                    });
                } else {
                    wx.showModal({ title: '查询失败', content: result.errMsg || '未找到订单详情', showCancel: false });
                    this.setData({ loading: false });
                }
            },
            fail: (err) => {
                console.error('调用云函数失败', err);
                wx.showToast({ title: '网络错误', icon: 'none' });
                this.setData({ loading: false });
            }
        });
    },
  
    toggleProducts: function () {
        this.setData({
            showAllProducts: true 
        });
    },

    makePhoneCall: function () {
        if (app.globalData.shopInfo && app.globalData.shopInfo.phone) {
            wx.makePhoneCall({ phoneNumber: app.globalData.shopInfo.phone });
        }
    },

    openLocation: function () {
        if (app.globalData.shopInfo) {
            const { latitude, longitude, name, address } = app.globalData.shopInfo;
            wx.openLocation({ latitude, longitude, name, address, scale: 18 });
        }
    },
    
    /**
     * 取消订单 (调用统一的云函数 orderActions)
     */
    cancelOrder: function () {
        const { orderDetail, orderId } = this.data;
        
        // ⭐ 【修正获取 userId 逻辑】
        const userInfo = wx.getStorageSync('userInfo');
        const userId = userInfo ? userInfo.userId : null;

        if (!userId) {
            wx.showToast({ title: '用户身份信息缺失，请重试', icon: 'none' });
            return;
        }
        if (!orderDetail || orderDetail.orderStatus !== '待支付') {
            wx.showToast({ title: `订单状态为 ${orderDetail ? orderDetail.orderStatus : '未知'}，无法取消`, icon: 'none' });
            return;
        }
        if (!orderId) {
            wx.showToast({ title: '订单ID缺失', icon: 'none' });
            return;
        }
        
        wx.showModal({
            title: '提示',
            content: '确定要取消该订单吗？',
            success: (res) => {
                if (res.confirm) {
                    wx.showLoading({ title: '取消中...' });
                    wx.cloud.callFunction({
                        name: 'orderActions', 
                        data: {
                            action: 'cancel',
                            orderId: orderId,
                            userId: userId // 传递 userId 
                        },
                        success: (res) => {
                            wx.hideLoading();
                            const result = res.result;
                            if (result.success) {
                                wx.showToast({ title: '订单已取消', icon: 'success' });
                                
                                // 成功后刷新订单详情并返回上一页
                                this.fetchOrderDetail(orderId); 
                                setTimeout(() => {
                                  wx.navigateBack(); 
                                }, 1500);

                            } else {
                                wx.showModal({ title: '取消失败', content: result.errMsg || '操作失败', showCancel: false });
                            }
                        },
                        fail: (err) => {
                            wx.hideLoading();
                            console.error('取消订单云函数调用失败', err);
                            wx.showToast({ title: '网络错误', icon: 'none' });
                        }
                    });
                }
            }
        });
    },
    
    /**
     * 去支付 (调用统一的云函数 orderActions)
     */
    payNow: function () {
        const { orderDetail, orderId } = this.data;
        
        const userInfo = wx.getStorageSync('userInfo');
        const userId = userInfo ? userInfo.userId : null;
        
        // 假设订单金额在 orderDetail.totalAmount
        const totalFee = orderDetail.totalAmount; 

        if (!userId) {
            wx.showToast({ title: '用户身份信息缺失，无法支付', icon: 'none' });
            return;
        }
        if (!orderDetail || orderDetail.orderStatus !== '待支付') {
            wx.showToast({ title: `订单状态为 ${orderDetail ? orderDetail.orderStatus : '未知'}，无法支付`, icon: 'none' });
            return;
        }
        if (!orderId || !totalFee) {
            wx.showToast({ title: '订单ID或金额缺失', icon: 'none' });
            return;
        }
        
        // 添加确认支付的弹出框
        wx.showModal({
            title: '确认支付',
            content: `确定支付 ¥${totalFee} 吗？`,
            success: (res) => {
                if (res.confirm) {
                    wx.showLoading({ title: '发起支付...' });
                    wx.cloud.callFunction({
                        name: 'orderActions', 
                        data: {
                            action: 'pay',
                            orderId: orderId,
                            totalFee: totalFee,
                            userId: userId // 传递 userId
                        },
                        success: (res) => {
                            wx.hideLoading();
                            const result = res.result;
                            if (result.success) {
                                
                                // ⭐ 【修正逻辑：清空购物车缓存，使用正确的键名 'cartList'】
                                try {
                                    // 尝试移除购物车内容
                                    wx.removeStorageSync('cartList'); 
                                    console.log('购物车缓存已清空: cartList');
                                } catch (e) {
                                    console.error('清空购物车缓存失败', e);
                                }
                                
                                wx.showToast({ title: '支付成功', icon: 'success' });
                                // 刷新订单详情并返回上一页
                                this.fetchOrderDetail(orderId);
                                setTimeout(() => {
                                    wx.navigateBack();
                                }, 1500);
                            } else {
                                wx.showModal({ title: '支付失败', content: result.errMsg || '支付操作未完成', showCancel: false });
                            }
                        },
                        fail: (err) => {
                            wx.hideLoading();
                            console.error('支付云函数调用失败', err);
                            wx.showToast({ title: '网络错误', icon: 'none' });
                        }
                    });
                }
            }
        });
    }
});
