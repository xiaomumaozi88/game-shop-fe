import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Order, OrderStatus } from '@/types';
import { formatPrice, storage, STORAGE_KEYS, resolveOrdersListPath } from '@/utils';
import { Button } from '@/components/Button';
import styles from './OrderDetail.module.less';

const ORDER_STORAGE_KEY = STORAGE_KEYS.ORDERS;

export const OrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (id) {
      const orders = storage.get<Order[]>(ORDER_STORAGE_KEY, []);
      const foundOrder = orders.find((o) => o.id === id);
      setOrder(foundOrder || null);
    }
  }, [id]);

  if (!order) {
    return (
      <div className={styles.orderDetail}>
        <div className={styles.container}>
          <div className={styles.empty}>
            <h2>订单不存在</h2>
            <Button variant="primary" onClick={() => navigate(resolveOrdersListPath(location.pathname))}>
              返回订单列表
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const getStatusText = (status: OrderStatus): string => {
    const statusMap: Record<OrderStatus, string> = {
      [OrderStatus.PENDING]: '待支付',
      [OrderStatus.PAID]: '已支付',
      [OrderStatus.SHIPPED]: '已发货',
      [OrderStatus.COMPLETED]: '已完成',
      [OrderStatus.CANCELLED]: '已取消',
    };
    return statusMap[status] || status;
  };

  return (
    <div className={styles.orderDetail}>
      <div className={styles.container}>
        <h1 className={styles.title}>订单详情</h1>

        <div className={styles.content}>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>订单信息</h2>
            <div className={styles.orderInfo}>
              <p>
                <span>订单号:</span>
                <span>{order.id}</span>
              </p>
              <p>
                <span>订单状态:</span>
                <span className={styles.status}>{getStatusText(order.status)}</span>
              </p>
              <p>
                <span>创建时间:</span>
                <span>{new Date(order.createdAt).toLocaleString('zh-CN')}</span>
              </p>
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>商品列表</h2>
            <div className={styles.orderItems}>
              {order.items.map((item) => (
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

          <div className={styles.summary}>
            <div className={styles.summaryRow}>
              <span>商品总数:</span>
              <span>{order.items.reduce((sum, item) => sum + item.quantity, 0)}件</span>
            </div>
            <div className={styles.summaryRow}>
              <span>订单总额:</span>
              <span className={styles.totalPrice}>
                {formatPrice(order.totalAmount, order.currency)}
              </span>
            </div>
          </div>

          <div className={styles.actions}>
            <Button variant="outline" onClick={() => navigate(resolveOrdersListPath(location.pathname))}>
              返回订单列表
            </Button>
            <Button variant="primary" onClick={() => navigate('/')}>
              继续购物
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

