import { Routes, Route, Link } from 'react-router-dom';
import Layout from './components/Layout';
import { ProtectedRoute, StaffRoute } from './components/ProtectedRoute';

import Home from './pages/Home';
import Listing from './pages/Listing';
import ProductDetail from './pages/ProductDetail';
import Reviews from './pages/Reviews';
import NotFound from './pages/NotFound';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import GuestOrder from './pages/GuestOrder';
import Wishlist from './pages/Wishlist';
import InfoPage from './pages/InfoPage';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

import AccountLayout from './pages/account/AccountLayout';
import Profile from './pages/account/Profile';
import Addresses from './pages/account/Addresses';
import Orders from './pages/account/Orders';
import OrderDetail from './pages/account/OrderDetail';
import Loyalty from './pages/account/Loyalty';
import MyReviews from './pages/account/MyReviews';

import AdminLayout from './pages/admin/AdminLayout';
import StaffLogin from './pages/admin/StaffLogin';
import Dashboard from './pages/admin/Dashboard';
import AdminProducts from './pages/admin/Products';
import ProductForm from './pages/admin/ProductForm';
import AdminAttributes from './pages/admin/Attributes';
import AdminOrders from './pages/admin/Orders';
import AdminPaymentConfirmations from './pages/admin/PaymentConfirmations';
import AdminOrderDetail from './pages/admin/OrderDetail';
import AdminReviews from './pages/admin/Reviews';
import AdminCoupons from './pages/admin/Coupons';
import AdminCustomers from './pages/admin/Customers';
import AdminStaff from './pages/admin/Staff';
import AdminSettings from './pages/admin/Settings';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="covers" element={<Listing categorySlug="iphone-covers" />} />
        <Route path="shop" element={<Listing />} />
        <Route path="p/:slug" element={<ProductDetail />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="faq" element={<InfoPage type="faq" />} />
        <Route path="shipping" element={<InfoPage type="shipping" />} />
        <Route path="returns" element={<InfoPage type="returns" />} />
        <Route path="terms" element={<InfoPage type="terms" />} />
        <Route path="privacy" element={<InfoPage type="privacy" />} />
        <Route path="contact" element={<InfoPage type="contact" />} />
        <Route path="cart" element={<Cart />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="order/guest/:token" element={<GuestOrder />} />
        <Route
          path="wishlist"
          element={
            <ProtectedRoute>
              <Wishlist />
            </ProtectedRoute>
          }
        />

        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />

        <Route
          path="account"
          element={
            <ProtectedRoute>
              <AccountLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Profile />} />
          <Route path="addresses" element={<Addresses />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="loyalty" element={<Loyalty />} />
          <Route path="reviews" element={<MyReviews />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>

      <Route path="/admin/login" element={<StaffLogin />} />
      <Route
        path="/admin"
        element={
          <StaffRoute>
            <AdminLayout />
          </StaffRoute>
        }
      >
        <Route index element={<StaffRoute permission="view_analytics"><Dashboard /></StaffRoute>} />
        <Route path="products" element={<StaffRoute permission="manage_products"><AdminProducts /></StaffRoute>} />
        <Route path="products/new" element={<StaffRoute permission="manage_products"><ProductForm /></StaffRoute>} />
        <Route path="products/:id" element={<StaffRoute permission="manage_products"><ProductForm /></StaffRoute>} />
        <Route path="attributes" element={<StaffRoute permission="manage_products"><AdminAttributes /></StaffRoute>} />
        <Route path="orders" element={<StaffRoute permission="manage_orders"><AdminOrders /></StaffRoute>} />
        <Route path="orders/:id" element={<StaffRoute permission="manage_orders"><AdminOrderDetail /></StaffRoute>} />
        <Route path="payment-confirmations" element={<StaffRoute permission="manage_order_payments"><AdminPaymentConfirmations /></StaffRoute>} />
        <Route path="reviews" element={<StaffRoute permission="manage_reviews"><AdminReviews /></StaffRoute>} />
        <Route path="coupons" element={<StaffRoute permission="manage_coupons"><AdminCoupons /></StaffRoute>} />
        <Route path="customers" element={<StaffRoute permission="manage_customers"><AdminCustomers /></StaffRoute>} />
        <Route path="staff" element={<StaffRoute permission="manage_staff"><AdminStaff /></StaffRoute>} />
        <Route path="settings" element={<StaffRoute permission="manage_settings"><AdminSettings /></StaffRoute>} />
        <Route
          path="*"
          element={
            <div className="admin-main">
              <h1>Page not found</h1>
              <p><Link to="/admin">Back to the dashboard</Link></p>
            </div>
          }
        />
      </Route>
    </Routes>
  );
}
