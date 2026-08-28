import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

// The landing page is the first paint, so it ships in the main bundle. Every
// other page loads as its own chunk the first time it is visited — a vendor on
// mobile data does not download the supplier dashboard to browse onions.
import Home from './pages/Home.jsx';

const Login = lazy(() => import('./pages/Login.jsx'));
const Signup = lazy(() => import('./pages/Signup.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));
const VendorDashboard = lazy(() => import('./pages/VendorDashboard.jsx'));
const SupplierDashboard = lazy(() => import('./pages/SupplierDashboard.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Cart = lazy(() => import('./pages/Cart.jsx'));
const Checkout = lazy(() => import('./pages/Checkout.jsx'));
const Orders = lazy(() => import('./pages/Orders.jsx'));
const OrderDetail = lazy(() => import('./pages/OrderDetail.jsx'));
const Invoice = lazy(() => import('./pages/Invoice.jsx'));
const SupplierProfile = lazy(() => import('./pages/SupplierProfile.jsx'));
const Suppliers = lazy(() => import('./pages/Suppliers.jsx'));
const About = lazy(() => import('./pages/About.jsx'));
const Contact = lazy(() => import('./pages/Contact.jsx'));
const Privacy = lazy(() => import('./pages/Privacy.jsx'));
const Terms = lazy(() => import('./pages/Terms.jsx'));
const Help = lazy(() => import('./pages/Help.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

function PageFallback() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="space-y-3">
        <div className="skel h-8 w-1/3" />
        <div className="skel h-24 rounded-xl" />
        <div className="skel h-24 rounded-xl" />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
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
          <Route path="orders" element={
            <ProtectedRoute role="vendor"><Orders /></ProtectedRoute>
          } />
          <Route path="orders/:id" element={
            <ProtectedRoute><OrderDetail /></ProtectedRoute>
          } />
          <Route path="orders/:id/invoice" element={
            <ProtectedRoute><Invoice /></ProtectedRoute>
          } />

          <Route path="suppliers" element={<Suppliers />} />
          <Route path="suppliers/:id" element={<SupplierProfile />} />

          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="terms" element={<Terms />} />
          <Route path="help" element={<Help />} />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
