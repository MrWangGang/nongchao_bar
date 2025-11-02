const app = getApp()

// 格式化日期函数
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

// 格式化商品规格函数
function formatOptions(item) {
    const specs = item.selectedSpecs || [];
    
    var optionsText = specs.map(function(spec) {
        return spec && spec.value ? spec.value : null;
    });

    return optionsText.filter(Boolean).join('，');
}

Page({
    data: {
        orderId: '',
        orderDetail: null,
        loading: true,
        showAllProducts: false,
        personCount: 2,
        tableNumber: 23, 

        orderItems: [],
        totalCount: 0,
        totalAmount: '0.00',

        recipeName: '',
        remark: '',
        uploadedImages: [],
        isSubmitting: false, 
        
        countdownDisplay: '15:00', 
        timer: null, 

        // 订单状态映射
        orderStatusMap: {
            '待支付': { title: '待支付', tip: '请在指定时间内完成支付' },
            '已支付': { title: '订单已支付', tip: '商家正在准备您的商品' },
            '已取消': { title: '订单已取消', tip: '订单已关闭' },
            '已过期': { title: '订单已过期', tip: '支付超时，订单已关闭' },
        }
    },

    /**
     * 启动订单支付倒计时，使用 createTime 为基准计算 (15分钟)
     * @param {string} createTime - 订单创建时间字符串
     */
    startCountdown: function (createTime) {
        if (this.data.timer) {
            clearInterval(this.data.timer);
        }

        const createTimestamp = new Date(createTime).getTime();
        const expirationSeconds = 15 * 60; 
        
        const updateTimer = () => {
            const now = Date.now();
            const elapsedSeconds = Math.floor((now - createTimestamp) / 1000);
            const remainingSeconds = expirationSeconds - elapsedSeconds;

            if (remainingSeconds <= 0) {
                clearInterval(this.data.timer);
                this.setData({
                    countdownDisplay: '00:00',
                    'orderDetail.orderStatus': '已过期'
                });
                return;
            }

            const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
            const seconds = String(remainingSeconds % 60).padStart(2, '0');

            this.setData({
                countdownDisplay: `${minutes}:${seconds}`
            });
        };

        updateTimer();
        const timer = setInterval(updateTimer, 1000);
        this.setData({ timer: timer });
    },

    onUnload: function () {
        // 页面卸载时清理计时器，防止内存泄漏
        if (this.data.timer) {
            clearInterval(this.data.timer);
            this.setData({ timer: null });
        }
    },

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
        const orderId = options.orderId || options.cocktailId;
        console.log('加载订单ID:', orderId);
        if (orderId) {
            this.setData({ orderId });
            this.fetchOrderDetail(orderId);
        } else {
            wx.showToast({ title: '缺少订单ID', icon: 'none' });
            this.setData({ loading: false });
        }
    },
    
    /**
     * 调用 getCocktailOrderDetail 云函数获取订单详情
     */
    fetchOrderDetail: function (orderId) {
        wx.cloud.callFunction({
            name: 'getCocktailOrderDetail', 
            data: {
                orderId: orderId 
            },
            success: (res) => {
                const result = res.result;
                if (result.success && result.data) {
                    let detail = result.data;
                    
                    if (detail.products && Array.isArray(detail.products)) {
                        detail.products = detail.products.map(function(item) {
                            item.formattedSpec = formatOptions(item);
                            item.price = item.price !== undefined ? item.price : '0.00'; 
                            item.quantity = item.quantity !== undefined ? item.quantity : 1;
                            return item;
                        });
                    }

                    const totalCount = detail.products.reduce((sum, item) => sum + (item.quantity || 0), 0);
                    const totalAmount = detail.payment && detail.payment.totalAmount !== undefined 
                                        ? String(detail.payment.totalAmount) 
                                        : '0.00'; 
                    
                    const initialRecipeName = detail.recipeName || '';
                    const initialRemark = detail.remark || '';
                    const initialImages = detail.images && Array.isArray(detail.images) ? detail.images : []; 
                    
                    const seatNumber = detail.seatInfo ? detail.seatInfo.name : '未知';

                    const createTimeDate = new Date(detail.createTime);
                    detail.formattedCreateTime = formatDate(createTimeDate, 'yyyy/MM/dd hh:mm:ss');

                    this.setData({
                        orderDetail: detail,
                        loading: false,
                        tableNumber: seatNumber,
                        
                        orderItems: detail.products, 
                        totalCount: totalCount, 
                        totalAmount: totalAmount, 

                        recipeName: initialRecipeName,
                        remark: initialRemark,
                        uploadedImages: initialImages, 
                    });

                    // 如果订单待支付，启动倒计时
                    if (detail.orderStatus === '待支付' && detail.createTime) {
                        this.startCountdown(detail.createTime);
                    }
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

    // ------------------------------------------------
    // 图片处理逻辑 (仅预览)
    // ------------------------------------------------
    onChooseImage: function() {
        if (this.data.uploadedImages.length > 0) {
            wx.previewImage({
                current: this.data.uploadedImages[0], 
                urls: this.data.uploadedImages      
            });
        }
    },

    // ------------------------------------------------
    // 🚀 立即支付 / 下单函数 (已对接 manageOrderActions)
    // ------------------------------------------------
    payNow: function () {
        const { orderDetail, totalAmount } = this.data; 

        // 1. 确保是已创建的待支付订单，否则执行下单逻辑
        if (orderDetail && orderDetail.orderStatus === '待支付' && orderDetail._id) {
            
            const currentOrderId = orderDetail._id;

            // 【新增】支付确认框
            wx.showModal({
                title: '确认支付',
                content: `您将支付 ¥${totalAmount}，是否确认付款？`,
                success: (res) => {
                    if (res.confirm) {
                        wx.showLoading({ title: '正在支付...' });
                        this.setData({ isSubmitting: true });
    
                        // *** 对接集成云函数：action=pay ***
                        wx.cloud.callFunction({
                            name: 'manageOrderActions', 
                            data: {
                                action: 'pay', 
                                orderId: currentOrderId,
                                transactionId: 'MOCK' + Date.now(), // 模拟交易ID
                                paymentMethod: '微信支付' 
                            },
                            success: (res) => {
                                wx.hideLoading();
                                this.setData({ isSubmitting: false });
                                const result = res.result;
    
                                if (result.success) {
                                    wx.showToast({ title: '支付成功', icon: 'success' });
                                    
                                    // 💥 关键修改：操作成功后 0.5 秒返回上级页面 💥
                                    setTimeout(() => { 
                                        this.setRefreshFlag(); 
                                        wx.navigateBack(); 
                                    }, 500); 
    
                                } else {
                                    wx.showModal({ 
                                        title: '支付失败', 
                                        content: result.errMsg || '请稍后再试', 
                                        showCancel: false 
                                    });
                                }
                            },
                            fail: (err) => {
                                wx.hideLoading();
                                this.setData({ isSubmitting: false });
                                console.error('调用云函数失败', err);
                                wx.showToast({ title: '网络错误', icon: 'none' });
                            }
                        });
                    }
                }
            });
            return;
        }

        // 2. 订单创建逻辑 (如果当前页面被用于创建订单)
        const userInfo = wx.getStorageSync('userInfo') || {};
        const userId = userInfo.userId || userInfo.openid;
        const { orderItems, totalCount, recipeName, remark, uploadedImages } = this.data; 

        if (!userId || orderItems.length === 0 || !totalAmount) {
            wx.showToast({ title: '数据不完整，无法下单', icon: 'none' });
            return;
        }

        this.setData({ isSubmitting: true });
        wx.showLoading({ title: `正在创建订单...` });
        
        const productsToSend = orderItems; 

        wx.cloud.callFunction({
            name: 'createCocktailOrder',
            data: {
                userId: userId, 
                products: productsToSend, 
                totalAmount: totalAmount,
                totalCount: totalCount,
                recipeName: recipeName,
                remark: remark,
                uploadedImages: uploadedImages,
                orderStatus: '待支付' 
            },
            success: (res) => {
                wx.hideLoading();
                this.setData({ isSubmitting: false });
                
                const result = res.result;
                if (result.success) {
                    const newOrderId = result.data._id;
                    
                    wx.showToast({ title: '订单已创建', icon: 'success' });
                    
                    // 订单创建成功后：跳转到新的支付页
                    setTimeout(() => { 
                        this.setRefreshFlag(); 
                        wx.navigateTo({
                            url: '/pages/cocktail/choose/pay/index?orderId='+newOrderId,
                        }); 
                    }, 500); 
                } else {
                    wx.showModal({ 
                        title: '下单失败', 
                        content: result.errMsg || '请稍后再试', 
                        showCancel: false 
                    });
                }
            },
            fail: (err) => {
                wx.hideLoading();
                this.setData({ isSubmitting: false });
                console.error('调用下单云函数失败', err);
                wx.showToast({ title: '网络错误，下单失败', icon: 'none' });
            }
        });
    },
    
    /**
     * 取消订单功能 (对接集成云函数：action='cancel')
     */
    cancelOrder: function() {
        if (!this.data.orderDetail || !this.data.orderDetail._id) {
            wx.showToast({ title: '订单信息缺失', icon: 'none' });
            return;
        }
        if (this.data.orderDetail.orderStatus !== '待支付') {
            wx.showToast({ title: '当前状态不可取消', icon: 'none' });
            return;
        }

        const currentOrderId = this.data.orderDetail._id;

        wx.showModal({
            title: '确认取消订单',
            content: '取消订单将无法恢复，是否确认？',
            success: (res) => {
                if (res.confirm) {
                    wx.showLoading({ title: '正在取消...' });
                    
                    // *** 对接集成云函数：action=cancel ***
                    wx.cloud.callFunction({
                        name: 'manageOrderActions', 
                        data: {
                            action: 'cancel',
                            orderId: currentOrderId
                        },
                        success: (res) => {
                            wx.hideLoading();
                            const result = res.result;
                            if (result.success) {
                                wx.showToast({ title: '订单已取消', icon: 'success' });
                                
                                // 💥 关键修改：操作成功后 0.5 秒返回上级页面 💥
                                setTimeout(() => { 
                                    this.setRefreshFlag(); 
                                    wx.navigateBack(); 
                                }, 500); 

                            } else {
                                wx.showToast({ title: result.errMsg || '取消失败', icon: 'none' });
                            }
                        },
                        fail: (err) => {
                            wx.hideLoading();
                            console.error('调用取消云函数失败', err);
                            wx.showToast({ title: '网络错误，取消失败', icon: 'none' });
                        }
                    });
                }
            }
        });
    },

    // ------------------------------------------------
    // 其它辅助功能
    // ------------------------------------------------
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
    setRefreshFlag: function() {
      wx.setStorageSync('orderListShouldRefresh', true);
    },
});