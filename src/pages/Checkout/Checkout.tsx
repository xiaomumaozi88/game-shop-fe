import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/hooks/useCart';
import { useUser } from '@/hooks/useUser';
import { useLoginGuard } from '@/hooks/useLoginGuard';
import { formatPrice, storage, STORAGE_KEYS } from '@/utils';
import { Order, OrderStatus } from '@/types';
import { Button } from '@/components/Button';
import { LoginModal } from '@/components/LoginModal';
import styles from './Checkout.module.less';

const ORDER_STORAGE_KEY = STORAGE_KEYS.ORDERS;

export const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const { items, totalPrice, clear } = useCart();
  const { user } = useUser();
  const { requireLogin, showLoginModal, setShowLoginModal } = useLoginGuard();
  const [loading, setLoading] = useState(false);

  if (items.length === 0) {
    return (
      <div className={styles.checkout}>
        <div className={styles.container}>
          <div className={styles.empty}>
            <h2>购物车是空的</h2>
            <Button variant="primary" onClick={() => navigate('/cart')}>
              返回购物车
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleConfirm = async () => {
    requireLogin(() => {
      handleConfirmOrder();
    });
  };

  const handleConfirmOrder = async () => {
    if (!user) {
      alert('请先绑定游戏账号');
      return;
    }

    setLoading(true);

    try {
      // 模拟API调用
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 创建订单
      const order: Order = {
        id: `order_${Date.now()}`,
        userId: user.id,
        items: items,
        totalAmount: totalPrice,
        currency: items[0]?.product.currency || '金币',
        status: OrderStatus.PAID,
        createdAt: new Date().toISOString(),
      };

      // 保存订单到本地存储（实际应该发送到服务器）
      const orders = storage.get<Order[]>(ORDER_STORAGE_KEY, []);
      orders.unshift(order);
      storage.set(ORDER_STORAGE_KEY, orders);

      // 清空购物车
      clear();

      // 跳转到订单确认页面
      navigate(`/order/${order.id}`);
    } catch (error) {
      console.error('订单创建失败:', error);
      alert('订单创建失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.checkout}>
      <div className={styles.container}>
        <h1 className={styles.title}>结算</h1>

        <div className={styles.content}>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>订单信息</h2>
            <div className={styles.orderItems}>
              {items.map((item) => (
                <div key={item.product.id} className={styles.orderItem}>
                  <img
                    src={item.product.image}
                    alt={item.product.name}
                    className={styles.orderItemImage}
                  />
                  <div className={styles.orderItemInfo}>
                    <h3>{item.product.name}</h3>
                    <p>
                      {formatPrice(item.product.price, item.product.currency)} × {item.quantity}
                    </p>
                  </div>
                  <div className={styles.orderItemTotal}>
                    {formatPrice(item.product.price * item.quantity, item.product.currency)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>用户信息</h2>
            <div className={styles.userInfo}>
              <p>
                <span>游戏账号:</span>
                <span>{user?.gameAccount || user?.username || '未绑定'}</span>
              </p>
              {user?.balance && (
                <p>
                  <span>账户余额:</span>
                  <span>
                    {Object.entries(user.balance)
                      .map(([currency, amount]) => `${amount} ${currency}`)
                      .join(', ')}
                  </span>
                </p>
              )}
            </div>
          </div>

          <div className={styles.summary}>
            <div className={styles.summaryRow}>
              <span>商品总数:</span>
              <span>{items.reduce((sum, item) => sum + item.quantity, 0)}件</span>
            </div>
            <div className={styles.summaryRow}>
              <span>总计:</span>
              <span className={styles.totalPrice}>
                {formatPrice(totalPrice, items[0]?.product.currency || '金币')}
              </span>
            </div>
            <div className={styles.actions}>
              <Button variant="outline" onClick={() => navigate('/cart')}>
                返回购物车
              </Button>
              <Button
                variant="primary"
                size="large"
                fullWidth
                loading={loading}
                onClick={handleConfirm}
              >
                确认订单
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 登录弹窗 */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
};

