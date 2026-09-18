import React, { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation, useParams, useNavigate } from 'react-router-dom';
import api from './api';
import { initSmooth, scrollTop } from './lib/smooth';
import RouteVeil from './components/RouteVeil';
import Header from './components/store/Header';
import Footer from './components/store/Footer';
import CartDrawer from './components/store/CartDrawer';
import SearchOverlay from './components/store/SearchOverlay';
import { useApp } from './store';

import Home from './pages/store/Home';
import Shop from './pages/store/Shop';
const StoreBrands = lazy(() => import('./pages/store/Brands'));
import ProductDetail from './pages/store/ProductDetail';
import Checkout from './pages/store/Checkout';
import TrackOrder from './pages/store/TrackOrder';
import Journal from './pages/store/Journal';
import JournalPost from './pages/store/JournalPost';
import Faq from './pages/store/Faq';
import Routine from './pages/store/Routine';
import Contact from './pages/store/Contact';
import StaticPage from './pages/store/StaticPage';
import Sitemap from './pages/store/Sitemap';
import NotFound from './pages/store/NotFound';

import AdminLogin from './pages/admin/Login';
import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import Products from './pages/admin/Products';
import ProductForm from './pages/admin/ProductForm';
import Categories from './pages/admin/Categories';
import Brands from './pages/admin/Brands';
import Orders from './pages/admin/Orders';
import OrderDetail from './pages/admin/OrderDetail';
import Customers from './pages/admin/Customers';
import Reviews from './pages/admin/Reviews';
import Coupons from './pages/admin/Coupons';
import Banners from './pages/admin/Banners';
import JournalAdmin from './pages/admin/JournalAdmin';
import Faqs from './pages/admin/Faqs';
import Pages from './pages/admin/Pages';
import RoutineAdmin from './pages/admin/RoutineAdmin';
import Media from './pages/admin/Media';
import Settings from './pages/admin/Settings';
import Toast from './components/store/Toast';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { scrollTop(true); }, [pathname]);
  return null;
}

function AdminLoginRedirect() {
  const location = useLocation();
  useEffect(() => {
    if (localStorage.getItem('pr-admin-token')) {
      window.location.href = '/admin';
    }
  }, []);
  return <AdminLogin key={location.pathname} />;
}

// banners (and old links) may point at /products/<id> — send them to the real /product/<slug> page
function ProductIdRedirect() {
  const { id } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    let live = true;
    api.get('/api/products/all-min')
      .then((r) => {
        if (!live) return;
        const p = (r.data || []).find((x) => String(x.id) === String(id));
        navigate(p ? `/product/${p.slug}` : '/shop', { replace: true });
      })
      .catch(() => { if (live) navigate('/shop', { replace: true }); });
    return () => { live = false; };
  }, [id, navigate]);
  return null;
}

export default function App() {
  const { toast, cartOpen } = useApp();
  useEffect(() => { initSmooth(); }, []); // lenis smooth scrolling
  return (
    <>
      <ScrollToTop />
      <Toast toast={toast} />
      <Routes>
        <Route path="/admin/login" element={<AdminLoginRedirect />} />
        <Route path="/products/:id" element={<ProductIdRedirect />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="products/:id" element={<ProductForm />} />
          <Route path="products/new" element={<ProductForm />} />
          <Route path="categories" element={<Categories />} />
          <Route path="brands" element={<Brands />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="customers" element={<Customers />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="coupons" element={<Coupons />} />
          <Route path="banners" element={<Banners />} />
          <Route path="journal" element={<JournalAdmin />} />
          <Route path="faqs" element={<Faqs />} />
          <Route path="pages" element={<Pages />} />
          <Route path="routine" element={<RoutineAdmin />} />
          <Route path="media" element={<Media />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="/" element={<StoreLayout />}>
          <Route index element={<Home />} />
          <Route path="shop" element={<Shop />} />
          <Route path="brands" element={<StoreBrands />} />
          <Route path="product/:slug" element={<ProductDetail />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="track" element={<TrackOrder />} />
          <Route path="journal" element={<Journal />} />
          <Route path="journal/:slug" element={<JournalPost />} />
          <Route path="faqs" element={<Faq />} />
          <Route path="routine" element={<Routine />} />
          <Route path="contact" element={<Contact />} />
          <Route path="sitemap" element={<Sitemap />} />
          <Route path="page/:key" element={<StaticPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <CartDrawer open={cartOpen} />
      <SearchOverlay />
      <RouteVeil />
    </>
  );
}

function StoreLayout() {
  const location = useLocation();
  return (
    <div className="app">
      <Header />
      {/* keyed by pathname: each route swap remounts the page fresh (query-only updates don't) */}
      <main className="content" key={location.pathname}>
        <Suspense fallback={<div className="loading"><span className="spinner" /></div>}>
        <Routes>
          <Route index element={<Home />} />
          <Route path="shop" element={<Shop />} />
          <Route path="brands" element={<StoreBrands />} />
          <Route path="product/:slug" element={<ProductDetail />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="track" element={<TrackOrder />} />
          <Route path="journal" element={<Journal />} />
          <Route path="journal/:slug" element={<JournalPost />} />
          <Route path="faqs" element={<Faq />} />
          <Route path="routine" element={<Routine />} />
          <Route path="contact" element={<Contact />} />
          <Route path="sitemap" element={<Sitemap />} />
          <Route path="page/:key" element={<StaticPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}