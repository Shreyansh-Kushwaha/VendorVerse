import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import VendorDashboard from './pages/VendorDashboard.jsx';
import SupplierDashboard from './pages/SupplierDashboard.jsx';
import Profile from './pages/Profile.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import SupplierProfile from './pages/SupplierProfile.jsx';
import About from './pages/About.jsx';
import Contact from './pages/Contact.jsx';
import Privacy from './pages/Privacy.jsx';
import Terms from './pages/Terms.jsx';
import Help from './pages/Help.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />

        <Route path="vendor" element={
          <ProtectedRoute role="vendor"><VendorDashboard /></ProtectedRoute>
        } />
        <Route path="supplier" element={
          <ProtectedRoute role="supplier"><SupplierDashboard /></ProtectedRoute>
        } />
        <Route path="profile" element={
          <ProtectedRoute><Profile /></ProtectedRoute>
        } />
        <Route path="cart" element={
          <ProtectedRoute role="vendor"><Cart /></ProtectedRoute>
        } />
        <Route path="checkout" element={
          <ProtectedRoute role="vendor"><Checkout /></ProtectedRoute>
        } />
        <Route path="orders/:id" element={
          <ProtectedRoute><OrderDetail /></ProtectedRoute>
        } />

        <Route path="suppliers/:id" element={<SupplierProfile />} />

        <Route path="about" element={<About />} />
        <Route path="contact" element={<Contact />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />
        <Route path="help" element={<Help />} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
