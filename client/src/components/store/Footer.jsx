import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="brand" style={{ marginBottom: 10 }}>Petal <em>&</em> Rose</div>
            <p className="muted" style={{ maxWidth: 300 }}>Authentic beauty and skincare, carefully curated for radiant, healthy skin.</p>
          </div>
          <div>
            <h4 className="footer-col-title">Shop</h4>
            <Link className="block" to="/shop">All Products</Link>
            <Link className="block" to="/shop?sort=best">Best Sellers</Link>
            <Link className="block" to="/shop?sort=discount">On Sale</Link>
            <Link className="block" to="/routine">Find Your Routine</Link>
          </div>
          <div>
            <h4 className="footer-col-title">Help</h4>
            <Link className="block" to="/track">Track Your Order</Link>
            <Link className="block" to="/faqs">FAQs</Link>
            <Link className="block" to="/page/shipping">Shipping & Delivery</Link>
            <Link className="block" to="/page/returns">Returns & Refunds</Link>
            <Link className="block" to="/contact">Contact Us</Link>
          </div>
          <div>
            <h4 className="footer-col-title">Company</h4>
            <Link className="block" to="/page/about">About Us</Link>
            <Link className="block" to="/brands">Brands</Link>
            <Link className="block" to="/journal">Journal</Link>
            <Link className="block" to="/sitemap">Sitemap</Link>
            <Link className="block" to="/page/privacy">Privacy Policy</Link>
            <Link className="block" to="/page/terms">Terms & Conditions</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="social-row">
            <a href="https://x.com/mhshan7" target="_blank" rel="noopener noreferrer" title="X" aria-label="X"><i className="fa-brands fa-x-twitter" /></a>
            <a href="https://wa.me/8801874460244" target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label="WhatsApp"><i className="fa-brands fa-whatsapp" /></a>
            <a href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer" title="Facebook" aria-label="Facebook"><i className="fa-brands fa-facebook" /></a>
            <a href="https://instagram.com/mhshan7" target="_blank" rel="noopener noreferrer" title="Instagram" aria-label="Instagram"><i className="fa-brands fa-instagram" /></a>
          </div>
          <div className="legal">
            <span>© {new Date().getFullYear()} Petal &amp; Rose. All rights reserved.</span>
            <span className="powered">Powered by <a href="https://mhshan.pages.dev/" target="_blank" rel="noopener noreferrer" className="powered-logo" title="Shawon"><img src="/Images/logo/shawon_logo.svg" alt="Shawon" /></a></span>
          </div>
        </div>
      </div>
    </footer>
  );
}