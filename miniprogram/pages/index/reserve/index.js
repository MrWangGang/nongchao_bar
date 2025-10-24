// 页面 JS 文件

Page({
  data: {
      // 模拟用户信息
      userInfo: {
          name: '测试用户',
          vipLevel: 5,
          avatar: 'https://placehold.co/60x60/333333/FFFFFF?text=AV' 
      },
      // 分类数据
      categories: [
          { id: 1, name: '包厢', type: '包厢', isActive: true },
          { id: 2, name: '卡座', type: '卡座', isActive: false },
          { id: 3, name: '散台', type: '散台', isActive: false },
      ],
      currentCategoryId: 1,
      currentCategoryName: '包厢',
      currentCategoryType: '包厢',

      // 日期数据
      dateList: [],
      currentDate: '', // 格式 YYYY-MM-DD

      // 渲染的座位列表数据
      seatList: [],

      // **恢复：用于存储当前日期下所有类型座位的原始数据**
      allSeatsData: [], 
      item:null,
  },

  /**
   * @function fetchSeatsData
   * @description 调用云函数获取【当前日期】下所有座位的最新状态
   */
  fetchSeatsData: function() {
      const { currentDate } = this.data;

      if (!currentDate) {
          console.warn('日期未初始化，跳过数据拉取');
          return;
      }

      wx.showLoading({
          title: `加载中`,
          mask: true
      });

      // 仅传入日期，获取该日期下所有分类的座位数据和预订状态
      wx.cloud.callFunction({
          name: 'getSeats',
          data: {
              date: currentDate,
              // type: this.data.currentCategoryType // 此处不再传入 type，拉取所有类型
          },
      })
      .then(res => {
          wx.hideLoading();
          let rawData = [];
          if (res.result && res.result.code === 0 && Array.isArray(res.result.data)) {
              rawData = res.result.data;
          } else {
              console.error('云函数返回数据结构错误或code不为0', res);
              wx.showToast({ title: '数据获取失败', icon: 'error' });
          }

          this.setData({
              // 将当前日期下所有座位的原始数据存入 allSeatsData
              allSeatsData: rawData
          }, () => {
              // 数据更新后，进行本地过滤
              this.filterSeats();
          });
      })
      .catch(err => {
          wx.hideLoading();
          console.error('调用云函数失败', err);
          wx.showToast({ title: '网络错误或云函数调用失败', icon: 'error' });
          this.setData({ allSeatsData: [], seatList: [] });
      });
  },

  /**
   * @function getDatesForMonth
   * @description 格式化日期：获取未来一个月日期 (保持不变)
   */
  getDatesForMonth: function() {
      const dateList = [];
      const today = new Date();
      const currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      const getDisplayInfo = (date) => {
          const year = date.getFullYear();
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const day = date.getDate().toString().padStart(2, '0');
          const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
          const dayOfWeek = date.getDay();
          
          const fullDate = `${year}-${month}-${day}`;
          let displayDay = `周${weekDays[dayOfWeek]}`;

          const diffTime = date.getTime() - currentDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays === 0) {
              displayDay = '今天';
          } else if (diffDays === 1) {
              displayDay = '明天';
          }

          return {
              fullDate: fullDate,
              displayDay: displayDay,
              displayMonthDate: `${month}月${day}日`,
              isActive: false
          };
      };

      for (let i = 0; i < 30; i++) {
          const date = new Date(today);
          date.setDate(today.getDate() + i);
          dateList.push(getDisplayInfo(date));
      }

      if (dateList.length > 0) {
          dateList[0].isActive = true;
          this.setData({
              currentDate: dateList[0].fullDate,
              dateList: dateList
          });
      }
  },
  
  /**
   * @function filterSeats
   * @description **恢复：** 根据当前分类类型过滤本地 allSeatsData
   */
  filterSeats: function() {
      const { currentCategoryType, allSeatsData } = this.data; 

      if (!allSeatsData || allSeatsData.length === 0) {
          this.setData({ seatList: [] });
          return;
      }

      // 1. 过滤分类 (根据 type 字符串过滤)
      const filteredByType = allSeatsData.filter(seat => 
          seat.type === currentCategoryType
      );

      // 2. 格式化数据，准备渲染
      const seatList = filteredByType.map(seat => {
          return {
              id: seat._id,
              name: seat.name,
              description: seat.description, 
              type: seat.type, 
              // 假设 allSeatsData 中的数据已经带有了 isBooked 状态
              isBooked: seat.isBooked || false, 
              // 从数据库获取 imageUrl，如果没有则使用占位图
              imageUrl: seat.img || `https://placehold.co/100x100/333333/FFFFFF?text=${seat.name}` 
          };
      });

      this.setData({
          seatList: seatList
      });
  },

  /**
   * @function changeDate
   * @description 切换顶部日期，并重新拉取**该日期下所有**座位数据
   */
  changeDate: function(e) {
      const newDate = e.currentTarget.dataset.date;
      const newDateList = this.data.dateList.map(item => ({
          ...item,
          isActive: item.fullDate === newDate
      }));

      this.setData({
          dateList: newDateList,
          currentDate: newDate
      }, () => {
          // 日期切换后，调用拉取函数，它会拉取数据并自动触发 filterSeats
          this.fetchSeatsData(); 
      });
  },

  /**
   * @function changeCategory
   * @description 切换左侧分类，并重新进行**本地过滤**
   */
  changeCategory: function(e) {
      const newCategoryId = parseInt(e.currentTarget.dataset.id);
      
      const newCategories = this.data.categories.map(item => ({
          ...item,
          isActive: item.id === newCategoryId
      }));
      
      const currentCategory = newCategories.find(item => item.id === newCategoryId);
      const currentCategoryName = currentCategory.name;
      const currentCategoryType = currentCategory.type;

      this.setData({
          categories: newCategories,
          currentCategoryId: newCategoryId,
          currentCategoryName: currentCategoryName,
          currentCategoryType: currentCategoryType 
      }, () => {
          // 分类切换后，直接调用本地过滤函数
          this.filterSeats();
      });
  },

  /**
   * @function onBookSeat
   * @description 点击“可预定”按钮的事件处理
   */
  onBookSeat: function(e) {
    const seatId = e.currentTarget.dataset.seatId;
    const seatName = e.currentTarget.dataset.seatName;
    const seatDesc= e.currentTarget.dataset.seatDesc;
    const { currentDate } = this.data; // 获取当前选择的日期
    const item = this.data.item;
    const currentCategoryType = this.data.currentCategoryType;
      // 实际应用中：跳转到预订详情页 / 弹出预订确认框
    
    // *** 增加跳转逻辑 ***
    wx.redirectTo({
        url: `/pages/index/reserve/detail/index?seatId=${seatId}&date=${currentDate}&seatName=${seatName}&item=${item}&seatDesc=${seatDesc}&currentCategoryType=${currentCategoryType}`,
        success: () => {
            console.log(`跳转到预订页，座位类型: ${currentCategoryType} , 座位ID: ${seatId}, 日期: ${currentDate} , 名字: ${seatName}, 套餐类型: ${item} , 人数: ${seatDesc}`);
        },
        fail: (err) => {
            console.error('跳转失败', err);
        }
    });
  },



  /**
   * @function onLoad
   * @description 页面加载生命周期
   */
  onLoad: function(options) {
      // 2. 从 options 中获取名为 'item' 的参数
      const item = options.item;

      // 3. 将接收到的数据存入页面的 data 中，以便在 WXML 中使用
      this.setData({
        item: item
      });


      this.getDatesForMonth(); // 1. 初始化日期数据 (设置 currentDate)
      
      // 2. 首次加载时，如果 currentDate 已经设置，则拉取数据
      if (this.data.currentDate) {
          this.fetchSeatsData();
      }
  }
});