const app = getApp()

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
        isSubmitting: false, // 控制按钮状态
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
        const orderId = options.cocktailId;
        console.log(orderId)
        if (orderId) {
            this.setData({ orderId });
            this.fetchOrderDetail(orderId);
        } else {
            wx.showToast({ title: '缺少订单ID', icon: 'none' });
            this.setData({ loading: false });
        }
    },
    
    fetchOrderDetail: function (orderId) {
        wx.cloud.callFunction({
            name: 'getStockDetailById',
            data: {
                stockId: orderId
            },
            success: (res) => {
                const result = res.result;
                if (result.success && result.data) {
                    let detail = result.data;
                    
                    if (detail.products && Array.isArray(detail.products)) {
                        detail.products = detail.products.map(function(item) {
                            item.formattedSpec = formatOptions(item);
                            item.price = item.price ? item.price : '0.00'; 
                            item.quantity = item.quantity ? item.quantity : 1;
                            return item;
                        });
                    }

                    const totalCount = detail.products.reduce((sum, item) => sum + (item.quantity || 0), 0);
                    const totalAmount = detail.totalAmount || '0.00'; 
                    
                    const initialRecipeName = detail.name || '';
                    const initialRemark = detail.remark || '';
                    const initialImages = detail.image && detail.image !== '/images/default.png' ? [detail.image] : [];
                    
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
    // 🚀 模拟支付逻辑
    // ------------------------------------------------
    mockPayNow: function () {
        const { orderDetail, totalAmount } = this.data;
        
        if (!orderDetail) {
            wx.showToast({ title: '订单信息未加载', icon: 'none' });
            return;
        }

        this.setData({ isSubmitting: true });
        wx.showLoading({ title: `模拟支付 ¥${totalAmount}...` });
        
        // 模拟支付成功
        setTimeout(() => {
            wx.hideLoading();
            this.setData({ isSubmitting: false });
            
            // 模拟清空购物车缓存 (可选)
            try { wx.removeStorageSync('cartList'); } catch (e) { console.error(e); }
            
            wx.showToast({ title: '支付成功', icon: 'success' });

            // 0.5秒后跳转回上级页面
            setTimeout(() => { 
                this.setRefreshFlag(); // 设置刷新标记
                wx.navigateBack(); 
            }, 500); 

        }, 1500); // 模拟网络延迟 1.5 秒
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