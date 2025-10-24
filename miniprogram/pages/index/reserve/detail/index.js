// /pages/index/reserve/detail/index.js
const app = getApp()

Page({
    data: {
        // 座位信息
        seatInfo: {
            id: null,
            name: '加载中...',
            seatType: '', // 【新增】用于存储座位类型 (如：包厢, 卡座, 散台)
        },
        // 预订日期信息
        bookingDate: {
            original: '',
            formattedDate: '加载中...',
            dayOfWeek: '加载中...',
        },
        // 套餐信息
        packageInfo: {
            name: '加载中...',
            description: '加载中...',
            price: '0.00',
            imageUrl: '',
            capacity: '',
            comboType: '', // 【新增】用于存储套餐类型 (如：小酌套餐, VIP套餐)
        },

        // 为了方便表单绑定，将phone和name提升到顶层
        phone: '',
        name: '',

        // 表单输入
        verificationCode: '',
        idCard: '',
        // 选择的到店时间
        arrivalTime: '21:00',

        // 用于验证码按钮倒计时
        countdownText: '发送验证码', // 按钮显示的文本
        counting: false, // 是否正在倒计时
        timer: null // 用于存储定时器
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
        console.log('页面加载，接收到的参数:', options);

        const comboType = options.item;
        const seatType = options.currentCategoryType;

        // 确保 date 总是 YYYY-MM-DD 格式
        const date = options.date || new Date().toISOString().split('T')[0];
        
        // 【注意】formatDate 函数已优化，以避免时区问题导致日期错误。
        const formattedDate = this.formatDate(date);
        
        const imageMap = {
            '包厢': 'cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/预约_包厢.png',
            '卡座': 'cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/预约_卡座.png',
            '散台': 'cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/预约_散台.png'
        };

        this.setData({
            seatInfo: {
                id: options.seatId || '未知',
                name: options.seatName || '未知',
                seatType: seatType || '' // 存储 seatType
            },
            'bookingDate.original': date,
            'bookingDate.formattedDate': formattedDate.date,
            'bookingDate.dayOfWeek': formattedDate.day,
            'packageInfo.capacity': options.seatDesc || '1-4人',
            'packageInfo.imageUrl': imageMap[seatType] || '/static/images/default_seat.png',
            'packageInfo.comboType': comboType || '' // 存储 comboType
        });

        if (comboType && comboType !== 'undefined' && comboType !== 'null') {
            this.fetchPackageDetails(comboType);
        } else {
            console.error("上个页面未传递有效的套餐类型(item)");
            wx.showToast({ title: '加载套餐信息失败', icon: 'none' });
        }
    },

    fetchPackageDetails: function(type) {
        wx.showLoading({ title: '加载套餐...' });
        wx.cloud.callFunction({
            name: 'getCombo',
            data: { type: type }
        }).then(res => {
            wx.hideLoading();
            if (res.result && res.result.code === 0 && res.result.data.length > 0) {
                const packageDetails = res.result.data[0];
                this.setData({
                    'packageInfo.name': packageDetails.name,
                    'packageInfo.description': packageDetails.description,
                    'packageInfo.price': packageDetails.price.toFixed(2)
                });
            } else {
                wx.showToast({ title: res.result.errMsg || '套餐信息加载失败', icon: 'none' });
            }
        }).catch(err => {
            wx.hideLoading();
            wx.showToast({ title: '网络错误', icon: 'none' });
        });
    },

    /**
     * 【关键修改】优化 formatDate 逻辑，避免使用 new Date(string) 带来的时区解析问题。
     */
    formatDate(dateString) {
        const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        
        // 分割 YYYY-MM-DD 字符串
        const parts = dateString.split('-');
        if (parts.length !== 3) {
            // 如果格式不正确，返回默认值或原始字符串
            return { date: dateString, day: '未知' };
        }
        
        // 使用年、月（-1）、日来构造 Date 对象，避免时区解析歧义
        // 传入的月份是 1-12，Date构造函数中月份是 0-11
        const date = new Date(parts[0], parts[1] - 1, parts[2]);

        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const dayOfWeek = days[date.getDay()];
        
        return {
            date: `${year}年${month}月${day}日`,
            day: dayOfWeek
        };
    },

    bindTimeChange(e) { this.setData({ arrivalTime: e.detail.value }); },

    handleInputChange(e) {
        const field = e.currentTarget.dataset.field;
        this.setData({ [field]: e.detail.value });
    },

    sendVerificationCode() {
        if (this.data.counting) { return; }
        const phoneRegex = /^1[3-9]\d{9}$/;
        if (!this.data.phone || !phoneRegex.test(this.data.phone)) {
            wx.showToast({ title: '手机号格式不正确', icon: 'none' });
            return;
        }
        console.log(`模拟向手机 ${this.data.phone} 发送验证码: 888888`);
        wx.showToast({ title: '验证码已发送', icon: 'success' });
        this.startCountdown();
    },

    startCountdown() {
        let seconds = 60;
        this.setData({ counting: true, countdownText: `${seconds}秒后重发` });
        const timer = setInterval(() => {
            seconds--;
            if (seconds <= 0) {
                clearInterval(timer);
                this.setData({ counting: false, countdownText: '重新发送', timer: null });
            } else {
                this.setData({ countdownText: `${seconds}秒后重发` });
            }
        }, 1000);
        this.setData({ timer: timer });
    },

    makePhoneCall: function() { wx.makePhoneCall({ phoneNumber: app.globalData.shopInfo.phone }); },

    openLocation: function() {
        const { latitude, longitude, name, address } = app.globalData.shopInfo;
        wx.openLocation({ latitude, longitude, name, address, scale: 18 });
    },

    /**
     * 点击提交预订按钮
     */
    submitBooking() {
        // 1. 基础信息校验 (不变)
        if (!this.data.phone) { wx.showToast({ title: '请输入手机号', icon: 'none' }); return; }
        if (!this.data.name) { wx.showToast({ title: '请输入姓名', icon: 'none' }); return; }
        if (!this.data.idCard) { wx.showToast({ title: '请输入身份证', icon: 'none' }); return; }
        if (!this.data.verificationCode) { wx.showToast({ title: '请输入验证码', icon: 'none' }); return; }

        // 2. 验证码校验 (模拟) (不变)
        if (this.data.verificationCode !== '888888') { wx.showToast({ title: '验证码错误', icon: 'none' }); return; }

        // 3. 从缓存获取 userId (不变)
        const userInfo = wx.getStorageSync('userInfo');
        const userId = userInfo ? userInfo.userId : null;
        if (!userId) { wx.showToast({ title: '获取用户信息失败，请重新登录', icon: 'none' }); return; }

        // 4. 格式化到店时间 (不变)
        const formattedArrivalTime = `${this.data.bookingDate.original} ${this.data.arrivalTime}:00`;

        // 5. 构建要提交到云函数的数据对象 (不变)
        const bookingData = {
            seatId: this.data.seatInfo.id,
            seatName: this.data.seatInfo.name,
            seatDesc: this.data.packageInfo.capacity,
            
            // 【新增】传递座位类型
            seatType: this.data.seatInfo.seatType, 
            
            comboName: this.data.packageInfo.name,
            comboPrice: parseFloat(this.data.packageInfo.price),
            comboDesc: this.data.packageInfo.description,
            
            // 【新增】传递套餐类型
            comboType: this.data.packageInfo.comboType, 
            
            userId: userId,
            name: this.data.name,
            idCard: this.data.idCard,
            arrivalTime: formattedArrivalTime,
            phone: this.data.phone
        };

        console.log('准备提交到云函数的预订数据:', bookingData);

        // 6. 调用云函数进行真实预订 (不变)
        wx.showLoading({ title: '正在提交...' });
        wx.cloud.callFunction({
            name: 'createBooking',
            data: bookingData
        }).then(res => {
            wx.hideLoading();
            console.log('云函数返回结果:', res);
            if (res.result && res.result.success) {
                wx.showToast({ title: '预订成功！', icon: 'success' });
                setTimeout(() => {
                    // 跳转到订单详情页，并传递订单的 _id
                    wx.redirectTo({
                        url: `/pages/index/reserve/bill/index?orderId=${res.result.data.orderId}`
                    });
                }, 1500);
            } else {
                wx.showToast({
                    title: res.result.errMsg || '预订失败，请重试',
                    icon: 'none',
                    duration: 2500
                });
            }
        }).catch(err => {
            wx.hideLoading();
            console.error('调用createBooking云函数失败:', err);
            wx.showToast({ title: '网络请求失败，请稍后重试', icon: 'none' });
        });
    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload() {
        // 清除倒计时定时器，防止内存泄漏
        if (this.data.timer) {
            clearInterval(this.data.timer);
        }
    }
})