import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/hooks/useCart';
import { useLoginGuard } from '@/hooks/useLoginGuard';
import { formatPrice } from '@/utils';
import { Button } from '@/components/Button';
import { CloseIcon } from '@/components/Icons/CloseIcon';
import { LoginModal } from '@/components/LoginModal';
import styles from './Cart.module.less';

export const Cart: React.FC = () => {
  const navigate = useNavigate();
  const { items, totalPrice, removeItem, updateQuantity, clear } = useCart();
  const { requireLogin, showLoginModal, setShowLoginModal } = useLoginGuard();

  if (items.length === 0) {
    return (
      <div className={styles.cart}>
        <div className={styles.container}>
          <div className={styles.empty}>
            <h2>购物车是空的</h2>
            <p>快去挑选心仪的商品吧！</p>
            <Button variant="primary" onClick={() => navigate('/')}>
              去购物
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleCheckout = () => {
    requireLogin(() => {
      navigate('/checkout');
    });
  };

  return (
    <div className={styles.cart}>
      <div className={styles.container}>
        <h1 className={styles.title}>购物车</h1>

        <div className={styles.content}>
          <div className={styles.items}>
            {items.map((item) => (
              <div key={item.product.id} className={styles.item}>
                <img
                  src={item.product.image}
                  alt={item.product.name}
                  className={styles.itemImage}
                />
                <div className={styles.itemInfo}>
                  <h3 className={styles.itemName}>{item.product.name}</h3>
                  <p className={styles.itemPrice}>
                    {formatPrice(item.product.price, item.product.currency)}
                  </p>
                </div>
                <div className={styles.itemActions}>
                  <div className={styles.quantityControl}>
                    <button
                      className={styles.quantityButton}
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                    >
                      -
                    </button>
                    <span className={styles.quantity}>{item.quantity}</span>
                    <button
                      className={styles.quantityButton}
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      disabled={item.quantity >= item.product.stock}
                    >
                      +
                    </button>
                  </div>
                  <button
                    className={styles.removeButton}
                    onClick={() => removeItem(item.product.id)}
                    aria-label="删除"
                  >
                    <CloseIcon size={16} />
                  </button>
                </div>
                <div className={styles.itemTotal}>
                  {formatPrice(item.product.price * item.quantity, item.product.currency)}
                </div>
              </div>
            ))}
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
              <Button variant="outline" onClick={clear}>
                清空购物车
              </Button>
              <Button variant="primary" size="large" fullWidth onClick={handleCheckout}>
                去结算
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

