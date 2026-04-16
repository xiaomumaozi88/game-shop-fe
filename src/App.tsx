import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Loading } from '@/components/Loading';
import { Message } from '@/components/Message';
import '@/styles/index.less';

// 懒加载页面组件
const Home = lazy(() => import('@/pages/Home'));
const Products = lazy(() => import('@/pages/Products'));
const Cart = lazy(() => import('@/pages/Cart'));
const Checkout = lazy(() => import('@/pages/Checkout'));
const OrderDetail = lazy(() => import('@/pages/OrderDetail'));
const History = lazy(() => import('@/pages/History'));

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Layout>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/products" element={<Products />} />
              <Route path="/game/:gameId" element={<Products />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/order/:id" element={<OrderDetail />} />
              <Route path="/game/:gameId/history" element={<History />} />
              <Route path="/history" element={<History />} />
            </Routes>
          </Suspense>
        </Layout>
        <Message />
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;

