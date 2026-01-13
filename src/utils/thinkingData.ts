import ta from 'thinkingdata-browser';

/**
 * ThinkingData 配置接口
 */
export interface ThinkingDataConfig {
  appId: string;
  serverUrl: string;
}

/**
 * ThinkingData 分析工具类
 * 封装了 ThinkingData SDK 的常用方法
 * 支持按游戏 appKey 动态初始化
 * 注意：由于 ThinkingData SDK 单页只能初始化一次，切换 appKey 时会重新初始化
 */
class ThinkingData {
  private currentAppKey: string | null = null;
  private currentConfig: ThinkingDataConfig | null = null;
  private initialized = false;

  /**
   * 初始化指定游戏(appKey)的 ThinkingData SDK
   * 如果已经初始化过其他 appKey，会重新初始化为新的配置
   * @param appKey 游戏 appKey
   * @param config 数数配置
   * @returns 是否初始化成功
   */
  initForGame(appKey: string, config: ThinkingDataConfig): boolean {
    if (this.currentAppKey === appKey && this.initialized) {
      return true;
    }

    if (!config.appId || !config.serverUrl) {
      return false;
    }

    try {
      const taConfig = {
        appId: config.appId,
        serverUrl: config.serverUrl,
        autoTrack: {
          pageShow: false, // 开启页面展示事件，事件名 ta_page_show
          pageHide: false, // 开启页面隐藏事件，事件名 ta_page_hide
        },
      };

      // 重新初始化（如果之前已经初始化过，会覆盖之前的配置）
      ta.init(taConfig);
      this.currentAppKey = appKey;
      this.currentConfig = config;
      this.initialized = true;
      return true;
    } catch (error) {
      this.initialized = false;
      return false;
    }
  }

  /**
   * 检查指定游戏是否已初始化
   */
  isGameInitialized(appKey: string): boolean {
    return this.initialized && this.currentAppKey === appKey;
  }

  /**
   * 设置当前 appKey（用于后续的事件上报）
   * 如果未初始化，会返回 false
   */
  setCurrentGame(appKey: string): boolean {
    if (this.isGameInitialized(appKey)) {
      return true;
    } else {
      console.warn(`appKey ${appKey} 未初始化，无法设置为当前游戏`);
      return false;
    }
  }

  /**
   * 设置用户账号 ID
   * @param accountId 用户账号 ID
   */
  login(accountId: string) {
    if (!this.initialized) {
      console.warn('ThinkingData SDK 未初始化，无法设置账号 ID');
      return;
    }

    try {
      ta.login(accountId);
    } catch (error) {
    }
  }

  /**
   * 用户登出
   */
  logout() {
    if (!this.initialized) {
      return;
    }

    try {
      ta.logout();
    } catch (error) {
      console.error('ThinkingData 登出失败:', error);
    }
  }

  /**
   * 设置公共事件属性
   * @param properties 公共事件属性对象
   */
  setSuperProperties(properties: Record<string, any>) {
    if (!this.initialized) {
      console.warn('ThinkingData SDK 未初始化，无法设置公共事件属性');
      return;
    }

    try {
      ta.setSuperProperties(properties);
      console.log('ThinkingData 公共事件属性设置成功:', properties);
    } catch (error) {
      console.error('ThinkingData 设置公共事件属性失败:', error);
    }
  }

  /**
   * 发送事件
   * @param eventName 事件名称
   * @param properties 事件属性
   */
  track(eventName: string, properties?: Record<string, any>) {
    if (!this.initialized) {
      console.warn(`⚠️ ThinkingData SDK 未初始化，无法发送事件 "${eventName}"。事件将在SDK初始化后自动上报。`);
      return;
    }

    try {
      // 调试输出当次上报的事件名与参数
      console.log('[ThinkingData track]', eventName, properties || {});
      ta.track(eventName, properties || {});
    } catch (error) {
      console.error('ThinkingData 发送事件失败:', error);
    }
  }

  /**
   * 设置用户属性
   * @param properties 用户属性对象
   */
  userSet(properties: Record<string, any>) {
    if (!this.initialized) {
      console.warn('ThinkingData SDK 未初始化，无法设置用户属性');
      return;
    }

    try {
      ta.userSet(properties);
      console.log('ThinkingData 用户属性设置成功:', properties);
    } catch (error) {
      console.error('ThinkingData 设置用户属性失败:', error);
    }
  }

  /**
   * 检查 SDK 是否已初始化
   */
  isInitialized(): boolean {
    const result = this.initialized;
    if (!result) {
      console.warn(`⚠️ ThinkingData SDK 未初始化检查 - currentAppKey: ${this.currentAppKey}, initialized: ${this.initialized}`);
    }
    return result;
  }
}

export const thinkingData = new ThinkingData();

