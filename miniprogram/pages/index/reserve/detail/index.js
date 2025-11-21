// /pages/index/reserve/detail/index.js
const app = getApp()

Page({
    data: {
        // 座位信息
        seatInfo: {
            id: null,
            name: '加载中...',
            seatType: '', // 用于存储座位类型 (如：包厢, 卡座, 散台)
        },
        // 预订日期信息
        bookingDate: {
            original: '',
            formattedDate: '加载中...',
            dayOfWeek: '加载中...',
        },
        // 🚀 存储所有套餐列表
        packageList: [], 
        // 🚀 当前选中的套餐索引
        currentPackageIndex: 0, 
        
        // packageInfo 用于渲染当前选中项
        packageInfo: {
            name: '加载中...',
            description: '',
            price: null, // 初始价格为 null
            imageUrl: '',
            capacity: '',
            comboType: '', 
        },

        // 🚀 控制套餐选择弹窗的显示/隐藏
        showPackageSelector: false, 

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

        const seatType = options.currentCategoryType;
        const date = options.date || new Date().toISOString().split('T')[0];
        // 🚀 接收初始选中的套餐名称
        const initialPackageName = options.item; 
        
        // 明确打印接收到的 item
        console.log('初始选中的套餐名称 (options.item):', initialPackageName);
        
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
            // 默认设置一个加载中状态
            'packageInfo.name': '套餐加载中...', 
            'packageInfo.price': 0.00,
        });

        // 🚀 调用获取套餐的函数，传入 seatType (用于内部逻辑) 和 initialPackageName
        this.fetchPackageDetails(seatType, initialPackageName); 
    },

    /**
     * @function fetchPackageDetails
     * @description 调用云函数获取指定套餐的详细信息（将 item 的值赋给 type 字段）
     * @param {string} type - 座位类型 (用于内部逻辑，不传给云函数)
     * @param {string} initialPackageName - 初始选中的套餐名称 (options.item)
     */
    fetchPackageDetails: function(type, initialPackageName) {
        // 1. 检查 item 是否传入 (因为这是现在唯一的过滤条件)
        if (!initialPackageName) {
            this.handlePackageLoadFailure('初始套餐名称 (item) 缺失，无法查询套餐');
            return;
        }
        
        // 🚀 关键修改：只传入 type 字段，但其值是 initialPackageName
        const dataToSend = { type: initialPackageName };
        
        console.log('调用云函数 getCombo 传入的数据 (item 的值赋给了 type):', dataToSend);
        
        wx.showLoading({ title: '加载套餐...' });
        wx.cloud.callFunction({
            name: 'getCombo',
            // 🚀 仅使用包含 type 的数据对象
            data: dataToSend 
        }).then(res => {
            wx.hideLoading();
            
            // 检查结果是否成功，数据是否为有效数组
            if (res.result && res.result.code === 0 && Array.isArray(res.result.data) && res.result.data.length > 0) {
                
                // 优化：在存储前对列表中的所有价格进行格式化 (toFixed(2))
                const packageList = res.result.data.map(item => ({
                    ...item,
                    price: parseFloat(item.price || 0).toFixed(2)
                }));
                
                // 关键逻辑：查找初始套餐的索引
                let initialIndex = 0;
                // 即使云函数只按 item 过滤，我们仍然需要通过名称找到它在 packageList 中的索引
                const foundIndex = packageList.findIndex(item => item.name === initialPackageName);
                if (foundIndex !== -1) {
                    initialIndex = foundIndex;
                } else {
                    console.warn(`云函数返回的列表中未找到套餐 "${initialPackageName}"，默认选中第一个。`);
                }
                

                this.setData({
                    packageList: packageList, // 存储格式化后的套餐列表
                    currentPackageIndex: initialIndex // 默认选中传入的套餐或第一个
                }, () => {
                    this.updateCurrentPackage(initialIndex); // 更新 packageInfo
                });

            } else {
                // 查询失败或无数据时，设置“未配置”状态
                this.handlePackageLoadFailure(res.result ? res.result.errMsg : '未查询到任何有效套餐');
            }
        }).catch(err => {
            wx.hideLoading();
            // 网络错误时，设置“未配置”状态
            this.handlePackageLoadFailure('网络请求失败，请稍后重试');
            console.error('调用 getCombo 云函数失败:', err);
        });
    },
    
    /**
     * @function handlePackageLoadFailure
     * @description 处理套餐加载失败或查询无数据时的逻辑
     * @param {string} toastMessage - 提示信息
     */
    handlePackageLoadFailure: function(toastMessage) {
        this.setData({
            // 关键修改：设置未配置状态
            'packageInfo.name': '套餐未配置', 
            'packageInfo.description': '请联系客服添加此座位类型的套餐。',
            'packageInfo.price': '0.00', // 价格为 0.00
            packageList: []
        });
        wx.showToast({ title: toastMessage, icon: 'none' });
    },


    /**
     * @function updateCurrentPackage
     * @description 根据索引更新当前选中的套餐信息
     */
    updateCurrentPackage: function(index) {
        const { packageList } = this.data;
        if (index >= 0 && index < packageList.length) {
            const selectedPackage = packageList[index];
            this.setData({
                currentPackageIndex: index,
                'packageInfo.name': selectedPackage.name,
                'packageInfo.description': selectedPackage.description,
                // 使用列表里已经格式化好的价格
                'packageInfo.price': selectedPackage.price, 
                // 假设 item.type 字段存储了套餐的类型，否则使用 name 
                'packageInfo.comboType': selectedPackage.type || selectedPackage.name  
            });
        }
    },
    
    /**
     * @function togglePackageSelector
     * @description 切换套餐选择弹窗的显示状态
     */
    togglePackageSelector: function() {
        // 只有在套餐列表加载成功且有数据时才允许打开弹窗
        if (this.data.packageList.length > 0 || this.data.showPackageSelector) {
             this.setData({
                showPackageSelector: !this.data.showPackageSelector
            });
        } else {
            wx.showToast({title: '当前没有可供选择的套餐', icon: 'none'});
        }
    },

    /**
     * @function selectPackage
     * @description 用户点击选择不同的套餐，并关闭弹窗
     */
    selectPackage: function(e) {
        const newIndex = parseInt(e.currentTarget.dataset.index);
        if (newIndex !== this.data.currentPackageIndex) {
            this.updateCurrentPackage(newIndex);
        }
        // 选中后关闭弹窗
        this.setData({
            showPackageSelector: false
        });
    },

    /**
     * 优化 formatDate 逻辑...
     */
    formatDate(dateString) {
        const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        
        const parts = dateString.split('-');
        if (parts.length !== 3) {
            return { date: dateString, day: '未知' };
        }
        
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
        const { 
            packageInfo, 
            packageList, 
            currentPackageIndex 
        } = this.data; 

        // 1. 套餐信息校验 (必须有价格且价格大于 0)
        const price = parseFloat(packageInfo.price);
        if (packageInfo.name === '套餐未配置' || price <= 0 || isNaN(price)) {
            wx.showToast({ title: '请选择有效套餐或联系客服配置', icon: 'none' }); 
            return;
        }

        // 2. 基础信息校验 
        if (!this.data.phone) { wx.showToast({ title: '请输入手机号', icon: 'none' }); return; }
        if (!this.data.name) { wx.showToast({ title: '请输入姓名', icon: 'none' }); return; }
        if (!this.data.idCard) { wx.showToast({ title: '请输入身份证', icon: 'none' }); return; }
        if (!this.data.verificationCode) { wx.showToast({ title: '请输入验证码', icon: 'none' }); return; }

        // 3. 验证码校验 (模拟) 
        if (this.data.verificationCode !== '888888') { wx.showToast({ title: '验证码错误', icon: 'none' }); return; }

        // 4. 从缓存获取 userId 
        const userInfo = wx.getStorageSync('userInfo');
        const userId = userInfo ? userInfo.userId : null;
        if (!userId) { wx.showToast({ title: '获取用户信息失败，请重新登录', icon: 'none' }); return; }

        // 关键：直接获取选中的 item 对象
        const selectedComboItem = packageList[currentPackageIndex];
        
        if (!selectedComboItem) {
            wx.showToast({ title: '无法获取完整套餐信息，请重试', icon: 'none' }); 
            return;
        }

        // 5. 格式化到店时间 
        const formattedArrivalTime = `${this.data.bookingDate.original} ${this.data.arrivalTime}:00`;

        // 6. 构建要提交到云函数的数据对象 
        const bookingData = {
            // 席位信息
            seatId: this.data.seatInfo.id,
            seatName: this.data.seatInfo.name,
            seatDesc: this.data.packageInfo.capacity,
            seatType: this.data.seatInfo.seatType, 
            
            // 关键：直接使用 item 的字段来构造 combo 信息
            comboName: selectedComboItem.name,
            comboPrice: parseFloat(selectedComboItem.price), // price 在 fetchPackageDetails 中已格式化
            comboDesc: selectedComboItem.description,
            // 假设 item.type 对应 comboType
            comboType: selectedComboItem.type || selectedComboItem.name, 
            
            // 用户和时间信息
            userId: userId,
            name: this.data.name,
            idCard: this.data.idCard,
            arrivalTime: formattedArrivalTime,
            phone: this.data.phone
        };

        console.log('提交预订到云函数 createBooking 的 comboType:', bookingData.comboType); 
        console.log('准备提交到云函数的预订数据:', bookingData);

        // 7. 调用云函数进行真实预订 
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
        if (this.data.timer) {
            clearInterval(this.data.timer);
        }
    }
})